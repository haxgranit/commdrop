class OrganizationUnit < ActiveRecord::Base
  include Permissions
  include Processable
  include GlobalId
  include Async
  include SecureSerialize
  secure_serialize :settings
  before_save :generate_defaults
  replicated_model  

  belongs_to :organization
  
  add_permissions('view', 'edit', 'delete') {|user| self.organization && self.organization.allows?(user, 'edit') }
  
  def generate_defaults
    self.settings ||= {}
  end
  
  def process_params(params, non_user_params)
    self.organization ||= non_user_params[:organization]
    raise "organization required" unless self.organization
    self.settings ||= {}
    self.settings['name'] = params['name'] if params['name']
    if params['management_action'] && params['management_action'] != ''
      process_result = process_action(params['management_action']) 
      if !process_result
        add_processing_error("management_action was unsuccessful, #{params['management_action']}")
        return false
      end
    end
    true
  end
  
  def process_action(key)
    action, user_name = key.split(/-/, 2)
    if action == 'add_supervisor'
      add_supervisor(user_name, false)
    elsif action == 'add_edit_supervisor'
      add_supervisor(user_name, true)
    elsif action == 'remove_supervisor'
      remove_supervisor(user_name)
    elsif action == 'add_communicator'
      add_communicator(user_name)
    elsif action == 'remove_communicator'
      remove_communicator(user_name)
    else
      false
    end
  end
  
  def add_supervisor(user_name, edit_permission=false)
    user = User.find_by_path(user_name)
    org = self.organization
    return false unless user && org && org.supervisor?(user)
    assert_list('supervisors', user.global_id)
    self.settings['supervisors'] << {
      'user_id' => user.global_id,
      'user_name' => user.user_name,
      'edit_permission' => !!edit_permission
    }
    self.schedule(:assert_supervision, {user_id: user.global_id, add_supervisor: user_name})
    self.save
  end
  
  def all_user_ids
    res = []
    res += (self.settings['supervisors'] || []).map{|s| s['user_id'] }
    res += (self.settings['communicators'] || []).map{|s| s['user_id'] }
    res.uniq
  end
  
  def supervisor?(user)
    self.settings ||= {}
    (self.settings['supervisors'] || []).map{|c| c['user_id'] }.include?(user && user.global_id)
  end
  
  def communicator?(user)
    self.settings ||= {}
    (self.settings['communicators'] || []).map{|c| c['user_id'] }.include?(user && user.global_id)
  end
  
  def remove_supervisor(user_name)
    user = User.find_by_path(user_name)
    org = self.organization
    return false unless user && org
    assert_list('supervisors', user.global_id)
    schedule(:assert_supervision, {user_id: user.global_id, remove_supervisor: user_name})
    self.save
  end
  
  def add_communicator(user_name)
    user = User.find_by_path(user_name)
    org = self.organization
    return false unless user && org && org.managed_user?(user) && !org.pending_user?(user)
    assert_list('communicators', user.global_id)
    self.settings['communicators'] << {
      'user_id' => user.global_id,
      'user_name' => user.user_name
    }
    schedule(:assert_supervision, {user_id: user.global_id, add_communicator: user_name})
    self.save
  end
  
  def remove_communicator(user_name)
    user = User.find_by_path(user_name)
    org = self.organization
    return false unless user && org
    assert_list('communicators', user.global_id)
    schedule(:assert_supervision, {user_id: user.global_id, remove_communicator: user_name})
    self.save
  end
  
  def self.remove_as_member(user_name, member_type, organization_id)
    org = Organization.find_by_global_id(organization_id)
    # TODO: sharding
    OrganizationUnit.where(:organization_id => org.id).each do |unit|
      if member_type == 'supervisor'
        unit.remove_supervisor(user_name)
      elsif member_type == 'communicator'
        unit.remove_communicator(user_name)
      end
    end
  end
  
  def assert_list(list, exclude_user_id)
    self.settings[list] = (self.settings[list] || []).select{|s| s['user_id'] != exclude_user_id }
  end
  
  def assert_supervision(opts={})
    communicators = User.find_all_by_global_id((self.settings['communicators'] || []).map{|s| s['user_id'] })
    supervisors = User.find_all_by_global_id((self.settings['supervisors'] || []).map{|s| s['user_id'] })
    ref_user = User.find_by_path(opts['user_id'])
    return false unless ref_user
    if opts['remove_supervisor']
      communicators.each do |user|
        User.unlink_supervisor_from_user(ref_user, user, self.global_id)
      end
    elsif opts['remove_communicator']
      supervisors.each do |user|
        User.unlink_supervisor_from_user(user, ref_user, self.global_id)
      end
    elsif opts['add_supervisor']
      sup = self.settings['supervisors'].detect{|s| s['user_id'] == ref_user.global_id } || {}
      communicators.each do |user|
        User.link_supervisor_to_user(ref_user, user, nil, !!sup['edit_permission'], self.global_id)
      end
    elsif opts['add_communicator']
      supervisors.each do |user|
        sup = self.settings['supervisors'].detect{|s| s['user_id'] == user.global_id } || {}
        User.link_supervisor_to_user(user, ref_user, nil, !!sup['edit_permission'], self.global_id)
      end
    end
  end
end
