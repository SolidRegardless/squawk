#!/usr/bin/env ruby
# Injects build settings into the existing Capacitor post_install hook.
# - Disables code signing on Pod targets (frameworks don't need profiles)
# - Assigns unique PRODUCT_BUNDLE_IDENTIFIER to each Pod target to prevent
#   CFBundleIdentifier collision errors on App Store upload.

podfile_path = 'Podfile'
content = File.read(podfile_path)

if content.include?('CODE_SIGNING_ALLOWED')
  puts 'Podfile already patched, skipping'
  exit 0
end

injection = <<~RUBY
      # CI signing + bundle ID collision fix
      installer.pods_project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['CODE_SIGNING_ALLOWED']           = 'NO'
          config.build_settings['CODE_SIGNING_REQUIRED']          = 'NO'
          config.build_settings['PROVISIONING_PROFILE']           = ''
          config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = ''
          # Give each pod a unique bundle ID based on its target name
          safe_name = target.name.downcase.gsub(/[^a-z0-9]/, '-').gsub(/-+/, '-').gsub(/^-|-$/, '')
          config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = "com.pods.#{safe_name}"
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
