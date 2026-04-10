#!/usr/bin/env ruby
# Injects CODE_SIGNING_ALLOWED=NO into the existing post_install hook in the Podfile.
# Capacitor generates a post_install hook already; we can't add a second one.

podfile_path = 'Podfile'
content = File.read(podfile_path)

if content.include?('CODE_SIGNING_ALLOWED')
  puts 'Podfile already patched, skipping'
  exit 0
end

injection = <<~RUBY
      # CI: disable signing on Pod targets so only App target uses the provisioning profile
      installer.pods_project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
          config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
          config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
        end
      end
RUBY

# Insert our code at the start of the existing post_install block
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
