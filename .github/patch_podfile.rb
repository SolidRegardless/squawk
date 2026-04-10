#!/usr/bin/env ruby
# Injects build settings into the existing Capacitor post_install hook.
# Sets Pod targets to Automatic signing so frameworks are signed with
# the available identity only (no provisioning profile).

podfile_path = 'Podfile'
content = File.read(podfile_path)

if content.include?('CODE_SIGNING_ALLOWED')
  puts 'Podfile already patched, skipping'
  exit 0
end

injection = <<~RUBY
      # CI: Pod targets use Automatic signing — signed with identity only, no profile.
      installer.pods_project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['CODE_SIGN_STYLE']               = 'Automatic'
          config.build_settings['CODE_SIGNING_ALLOWED']          = 'YES'
          config.build_settings['CODE_SIGNING_REQUIRED']         = 'YES'
          config.build_settings['PROVISIONING_PROFILE']          = ''
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
