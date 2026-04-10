#!/usr/bin/env ruby
# Injects build settings into the existing Capacitor post_install hook.
# Sets Pod targets to Manual signing with identity only (no provisioning profile).
# The App target's provisioning profile is set separately via set_app_profile.rb.

podfile_path = 'Podfile'
content = File.read(podfile_path)

if content.include?('CODE_SIGNING_ALLOWED')
  puts 'Podfile already patched, skipping'
  exit 0
end

injection = <<~RUBY
      # CI: Pod targets sign with distribution identity only (no provisioning profile).
      # Frameworks need a valid signature in the archive but don't use profiles.
      installer.pods_project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
          config.build_settings['CODE_SIGNING_REQUIRED'] = 'YES'
          config.build_settings['CODE_SIGNING_ALLOWED'] = 'YES'
          config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = ''
          config.build_settings.delete('PROVISIONING_PROFILE')
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
