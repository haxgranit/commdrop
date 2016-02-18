class Organization < ActiveRecord::Base
  include Permissions
  include Processable
  include GlobalId
  include SecureSerialize
  secure_serialize :settings
  before_save :generate_defaults
  has_many :users, :foreign_key => :managing_organization_id
  has_many :managers, :class_name => User, :foreign_key => :managed_organization_id
  
  # cache should be invalidated if:
  # - a manager/assistant is added or removed
  add_permissions('view') { self.settings && self.settings['public'] == true }
  add_permissions('view', 'edit') {|user| self.assistant?(user) }
  add_permissions('view', 'edit', 'manage') {|user| self.manager?(user) }
  add_permissions('view', 'edit', 'manage', 'update_licenses') {|user| Organization.admin && Organization.admin.manager?(user) }
  add_permissions('delete') {|user| Organization.admin && !self.admin && Organization.admin.manager?(user) }
  cache_permissions

  def generate_defaults
    self.settings ||= {}
    self.settings['name'] ||= "Unnamed Organization"
    true
  end
  
  def self.admin
    self.where(:admin => true).first
  end
  
  def log_sessions
    sessions = LogSession.where(:log_type => 'session')
    if !self.admin
      user_ids = self.users.map(&:id)
      sessions = sessions.where(:user_id => user_ids)
    end
    sessions.where(['started_at > ?', 6.months.ago]).order('started_at DESC')
  end
  
  def add_manager(user_key, full=false)
    user = User.find_by_path(user_key)
    raise "invalid user" unless user
    raise "already associated with a different organization" if user.managed_organization_id && user.managed_organization_id != self.id
    user.managed_organization_id = self.id
    if full
      user.settings ||= {}
      user.settings['full_manager'] = true
    end
    # TODO: trigger notification
    user.save
    self.touch
    true
  end
  
  def remove_manager(user_key)
    user = User.find_by_path(user_key)
    raise "invalid user" unless user
    raise "associated with a different organization" if user.managed_organization_id && user.managed_organization_id != self.id
    user.managed_organization_id = nil
    user.settings ||= {}
    user.settings['full_manager'] = false
    # TODO: trigger notification
    user.save
    self.touch
    true
  end
  
  # TODO: code smell, using columns and settings to define levels of permissions. Maybe this
  # should be a separate table, even with slight perf hit..
  def manager?(user)
    !!(user.managed_organization_id == self.id && user.settings && user.settings['full_manager'])
  end
  
  def assistant?(user)
    !!(user.managed_organization_id == self.id)
  end
  
  def managed_user?(user)
    !!(user.managing_organization_id == self.id)
  end
  
  def self.manager_for?(manager, user)
    if user && manager && user.managing_organization_id && user.managing_organization_id == manager.managed_organization_id && 
          manager.settings && manager.settings['full_manager'] && 
          user.settings && user.settings['subscription'] && !user.settings['subscription']['org_pending']
      # if user and manager are part of the same org
      return true
    else
      return admin_manager?(manager)
    end
  end
  
  def self.admin_manager?(manager)
    if manager && manager.managed_organization_id && manager.settings && manager.settings['full_manager']
      # if manager is part of the global org (the order of lookups seems weird, but should be a little more efficient)
      org = self.admin
      return true if org && manager.managed_organization_id == org.id
    end
    false
  end

  def user?(user)
    user.managing_organization_id == self.id
  end
  
  def add_user(user_key, pending)
    user = User.find_by_path(user_key)
    raise "invalid user" unless user
    raise "already associated with a different organization" if user.managing_organization_id && user.managing_organization_id != self.id
    user_count = User.where(['managing_organization_id = ? AND id != ?', self.id, user.id]).count
    raise "no licenses available" unless ((self.settings || {})['total_licenses'] || 0) > user_count
    user.update_subscription_organization(self.global_id, pending)
    true
  end
  
  def remove_user(user_key)
    user = User.find_by_path(user_key)
    raise "invalid user" unless user
    raise "associated with a different organization" if user.managing_organization_id && user.managing_organization_id != self.id
    user.update_subscription_organization(nil)
    true
  end
  
  def process_params(params, non_user_params)
    self.settings ||= {}
    self.settings['name'] = params['name'] if params['name']
    if params[:allotted_licenses]
      total = params[:allotted_licenses].to_i
      used = User.where(:managing_organization_id => self.id).count
      if total < used
        add_processing_error("too few licenses, remove some users first")
        return false
      end
      self.settings['total_licenses'] = total
    end
    if params[:management_action]
      if !self.id
        add_processing_error("can't manage users on create") 
        return false
      end

      action, key = params[:management_action].split(/-/, 2)
      begin
        if action == 'add_user'
          self.add_user(key, true)
        elsif action == 'add_assistant' || action == 'add_manager'
          self.add_manager(key, action == 'add_manager')
        elsif action == 'remove_user'
          self.remove_user(key)
        elsif action == 'remove_assistant' || action == 'remove_manager'
          self.remove_manager(key)
        end
      rescue => e
        add_processing_error("user management action failed: #{e.message}")
        return false
      end
    end
    true
  end
end
