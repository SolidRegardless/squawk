#!/usr/bin/env ruby
# Injects build settings into the existing Capacitor post_install hook.
# Disables code signing on Pod targets entirely so they don't get
# a provisioning profile baked into the archive.
# Unsigned frameworks are valid for App Store builds — Xcode re-signs on export.

podfile_path = 'Podfile'
content = File.read(podfile_path)

if content.include?('CODE_SIGNING_ALLOWED')
  puts 'Podfile already patched, skipping'
  exit 0
end

injection = <<~RUBY
      # CI: disable signing on Pod targets entirely.
      # Xcode will sign them correctly during export using the App's identity.
      installer.pods_project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['CODE_SIGNING_ALLOWED']          = 'NO'
          config.build_settings['CODE_SIGNING_REQUIRED']         = 'NO'
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
