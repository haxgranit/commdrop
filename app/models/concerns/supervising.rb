module Supervising
  extend ActiveSupport::Concern
  
  def generate_link_code
    return nil unless self.premium?
    code = Security.nonce('link_code')[0, 5]
    self.settings['link_codes'] ||= []
    self.settings['link_codes'].select!{|c| id, nonce, ts = c.split(/-/, 3); Time.at(ts.to_i) > 6.hours.ago }
    code = "#{self.global_id}-#{code}-#{Time.now.to_i}"
    self.settings['link_codes'] << code
    self.save
    code
  end
  
  def link_to_supervisee_by_code(code)
    return false unless code
    id, nonce, ts = code.split(/-/, 3)
    user = User.find_by_global_id(id)
    user = nil unless user && user.premium? &&
        (user.settings['link_codes'] || []).include?(code) && 
        Time.at(ts.to_i) > 6.hours.ago
    return false unless user && user != self
    supervisors = User.find_all_by_global_id(user.supervisor_user_ids)
    non_premium_supervisors = supervisors.select{|u| !u.premium? }
    return false if non_premium_supervisors.length >= 5
    self.save unless self.id
    self.class.link_supervisor_to_user(self, user, code)
    true
  end
  
  def supervisor_user_ids
    (self.settings['supervisors'] || []).map{|s| s['user_id'] }
  end
  
  def supervisor_for?(user)
    user.supervisor_user_ids.include?(self.global_id) || Organization.manager_for?(self, user)
  end
  
  def supervisors
    if !self.supervisor_user_ids.blank?
      User.find_all_by_global_id(self.supervisor_user_ids)
    else
      []
    end
  end
  
  def organization_hash
    res = []
    if self.managed_organization_id
      o = self.managed_organization
      res << {
        'id' => o.global_id,
        'name' => o.settings['name'],
        'type' => 'manager',
        'full_manager' => !!self.settings['full_manager'],
        'added' => nil
      } if o
    end
    if self.managing_organization_id
      o = self.managing_organization
      res << {
        'id' => o.global_id,
        'name' => o.settings['name'],
        'type' => 'user',
        'added' => (self.settings['subscription'] || {})['added_to_organization'],
        'pending' => !!(self.settings['subscription'] || {})['org_pending'],
        'sponsored' => (self.settings['subscription'] || {})['org_sponsored'] != false
      } if o
    end
    res += Organization.attached_orgs(self)
    res.reverse.uniq{|e| [e['id'], e['type']] }.sort_by{|e| e['id'] }
  end

  def supervised_user_ids
    return [] unless self.settings && self.settings['supervisees']
    (self.settings['supervisees'] || []).map{|s| s['user_id'] }
  end
  
  def managed_users
    if self.managed_organization_id && self.managed_organization && self.managed_organization.manager?(self)
      self.managed_organization.users
    else
      []
    end
  end
  
  def supervisees
    if !self.supervised_user_ids.blank?
      User.find_all_by_global_id(self.supervised_user_ids).sort_by(&:user_name)
    else
      []
    end
  end
  
  def edit_permission_for?(supervisee)
    !!(supervisee.settings['supervisors'] || []).detect{|s| s['user_id'] == self.global_id && s['edit_permission'] }
  end
  
  def process_supervisor_key(key)
    action, key = key.split(/-/, 2)
    if action == 'add' || action == 'add_edit'
      return false unless self.premium? && self.id
      if key.match(/@/)
        # TODO: implemented email invitation using supervisee_code
        return false
      else
        supervisor = User.find_by_path(key)
        return false if !supervisor || self == supervisor
        self.class.link_supervisor_to_user(supervisor, self, nil, action == 'add_edit')
        return true
      end
    elsif action == 'approve' && key == 'org'
      self.settings['pending'] = false
      self.update_subscription_organization(self.managing_organization.global_id, false)
      true
    elsif action == 'approve_supervision'
      org = Organization.find_by_global_id(key)
      if org.pending_supervisor?(self)
        org.add_supervisor(self.user_name, false)
        true
      elsif org.supervisor?(self)
        true
      else
        false
      end
    elsif action == 'remove_supervision'
      org = Organization.find_by_global_id(key)
      org.remove_supervisor(self.user_name)
      true
    elsif action == 'remove_supervisor'
      if key == 'org'
        self.update_subscription_organization(nil)
      else
        supervisor = User.find_by_path(key)
        user = self
        return false unless supervisor && user
        self.class.unlink_supervisor_from_user(supervisor, user)
      end
      true
    elsif action == 'remove_supervisee'
      supervisor = self
      user = User.find_by_path(key)
      return false unless supervisor && user
      self.class.unlink_supervisor_from_user(supervisor, user)
    else
      return false
    end
  end
  
  module ClassMethods  
    def unlink_supervisor_from_user(supervisor, user)
      user.settings['supervisors'] = (user.settings['supervisors'] || []).select{|s| s['user_id'] != supervisor.global_id }
      user.save
      supervisor.settings['supervisees'] = (supervisor.settings['supervisees'] || []).select{|s| s['user_id'] != user.global_id }
      # TODO: force browser refresh for supervisor after an unlink?
      supervisor.save
    end
    
    def link_supervisor_to_user(supervisor, user, code=nil, editor=true)
      user.settings['supervisors'] = (user.settings['supervisors'] || []).select{|s| s['user_id'] != supervisor.global_id }
      user.settings['supervisors'] << {
        'user_id' => supervisor.global_id,
        'user_name' => supervisor.user_name,
        'edit_permission' => editor
      }
      user.settings['link_codes'] -= [code] if code
      user.save
      # first-time supervisors should automatically be set to the supporter role
      if !supervisor.settings['supporter_role_auto_set']
        supervisor.settings['supporter_role_auto_set'] = true
        supervisor.settings['preferences']['role'] = 'supporter'
      end
      supervisor.settings['supervisees'] = (supervisor.settings['supervisees'] || []).select{|s| s['user_id'] != user.global_id }
      supervisor.settings['supervisees'] << {
        'user_id' => user.global_id,
        'user_name' => user.user_name,
        'edit_permission' => editor
      }
      supervisor.save
    end
  end
end