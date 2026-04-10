#!/usr/bin/env ruby
# Sets Manual signing + provisioning profile on the App target only
# in App.xcodeproj. Pod targets are handled separately via the Podfile.
#
# Usage: ruby set_app_profile.rb <path/to/App.xcodeproj> <profile-uuid>

require 'xcodeproj'

proj_path    = ARGV[0]
profile_uuid = ARGV[1]

unless proj_path && profile_uuid && !profile_uuid.empty?
  warn "Usage: #{$0} <App.xcodeproj> <profile-uuid>"
  exit 1
end

project    = Xcodeproj::Project.open(proj_path)
app_target = project.targets.find { |t| t.name == 'App' }

unless app_target
  warn "Could not find 'App' target. Available: #{project.targets.map(&:name).join(', ')}"
  exit 1
end

identity = ENV['CODE_SIGN_IDENTITY'] || 'iPhone Distribution'

app_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_STYLE']                = 'Manual'
  config.build_settings['CODE_SIGN_IDENTITY']             = identity
  config.build_settings['PROVISIONING_PROFILE']           = profile_uuid
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = ''
  puts "  [#{config.name}] PROVISIONING_PROFILE = #{profile_uuid}, IDENTITY = #{identity}"
end

project.save
puts 'App.xcodeproj saved.'

# Also patch Info.plist with export compliance key
info_plist_path = File.join(File.dirname(proj_path), 'App', 'Info.plist')
if File.exist?(info_plist_path)
  system("/usr/libexec/PlistBuddy -c 'Add :ITSAppUsesNonExemptEncryption bool false' '#{info_plist_path}' 2>/dev/null || " \
         "/usr/libexec/PlistBuddy -c 'Set :ITSAppUsesNonExemptEncryption false' '#{info_plist_path}'")
  puts "Set ITSAppUsesNonExemptEncryption = false in #{info_plist_path}"
else
  puts "Warning: Info.plist not found at #{info_plist_path}"
end
