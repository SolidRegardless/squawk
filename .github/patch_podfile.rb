#!/usr/bin/env ruby
# Injects build settings into the existing Capacitor post_install hook.
# Sets Pod targets to Automatic signing so they get signed with the
# distribution identity (no provisioning profile) during archive.
# The App target keeps Manual signing via xcodebuild command-line overrides.

podfile_path = 'Podfile'
content = File.read(podfile_path)

if content.include?('CODE_SIGN_STYLE')
  puts 'Podfile already patched, skipping'
  exit 0
end

injection = <<~RUBY
      # CI: set Pod targets to Automatic code signing.
      # They will be signed with the distribution identity only (no profile),
      # which is correct for embedded frameworks.
      installer.pods_project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
          config.build_settings.delete('PROVISIONING_PROFILE')
          config.build_settings.delete('PROVISIONING_PROFILE_SPECIFIER')
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
