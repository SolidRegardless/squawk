#!/usr/bin/env ruby
# Sets PROVISIONING_PROFILE on the App target's build configurations
# in App.xcodeproj/project.pbxproj by using Xcodeproj gem.
#
# Usage: ruby set_app_profile.rb <path/to/App.xcodeproj> <profile-uuid>

require 'xcodeproj'

proj_path   = ARGV[0]
profile_uuid = ARGV[1]

unless proj_path && profile_uuid && !profile_uuid.empty?
  warn "Usage: #{$0} <App.xcodeproj> <profile-uuid>"
  exit 1
end

project = Xcodeproj::Project.open(proj_path)

# Find the native App target (not Pods)
app_target = project.targets.find { |t| t.name == 'App' }
unless app_target
  warn "Could not find 'App' target in #{proj_path}"
  warn "Available targets: #{project.targets.map(&:name).join(', ')}"
  exit 1
end

app_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_STYLE']                 = 'Manual'
  config.build_settings['PROVISIONING_PROFILE']            = profile_uuid
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER']  = ''
  puts "Set profile on App target [#{config.name}]: #{profile_uuid}"
end

project.save
puts 'Project saved.'
