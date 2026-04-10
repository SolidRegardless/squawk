#!/usr/bin/env ruby
# Injects build settings into the existing Capacitor post_install hook.
# Sets Pod targets to sign with the distribution identity but NO provisioning
# profile. This produces properly-signed frameworks in the archive, while
# keeping the provisioning profile scoped to the App target only.

podfile_path = 'Podfile'
content = File.read(podfile_path)

if content.include?('CODE_SIGNING_ALLOWED')
  puts 'Podfile already patched, skipping'
  exit 0
end

injection = <<~RUBY
      # CI: sign Pod frameworks with the distribution identity only (no profile).
      # The App target gets the provisioning profile via xcodebuild CLI overrides.
      installer.pods_project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['CODE_SIGNING_ALLOWED'] = 'YES'
          config.build_settings['CODE_SIGNING_REQUIRED'] = 'YES'
          config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
          config.build_settings.delete('PROVISIONING_PROFILE')
          config.build_settings.delete('PROVISIONING_PROFILE_SPECIFIER')
          config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = ''
        end
      end
RUBY

patched = content.sub(
  /^(post_install do \|installer\|)/,
  "\\1\n#{injection}"
)

if patched == content
  warn 'ERROR: Could not find post_install hook to patch'
  exit 1
end

File.write(podfile_path, patched)
puts 'Podfile patched successfully'
