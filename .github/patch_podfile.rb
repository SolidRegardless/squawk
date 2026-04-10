#!/usr/bin/env ruby
# Appends a post_install hook to the Podfile that disables code signing
# on all CocoaPods targets. Run from client/ios/App directory.

podfile_path = 'Podfile'
content = File.read(podfile_path)

if content.include?('CODE_SIGNING_ALLOWED')
  puts 'Podfile already patched, skipping'
  exit 0
end

patch = <<~RUBY

  post_install do |installer|
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
        config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
      end
    end
  end
RUBY

File.open(podfile_path, 'a') { |f| f.write(patch) }
puts 'Podfile patched'
