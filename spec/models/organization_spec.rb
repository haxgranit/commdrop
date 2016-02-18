require 'spec_helper'

describe Organization, :type => :model do
  describe "managing managers" do
    it "should correctly add a manager" do
      o = Organization.create
      u = User.create
      expect(u.managed_organization_id).to eq(nil)
      
      res = o.add_manager(u.user_name, true)
      expect(res).to eq(true)
      u.reload
      expect(u.managed_organization_id).to eq(o.id)
      expect(u.settings['full_manager']).to eq(true)
    end
    
    it "should correctly add an assistant" do
      o = Organization.create
      u = User.create
      expect(u.managed_organization_id).to eq(nil)
      
      res = o.add_manager(u.user_name)
      expect(res).to eq(true)
      u.reload
      expect(u.managed_organization_id).to eq(o.id)
      expect(u.settings['full_manager']).not_to eq(true)
    end
    
    it "should error on adding a manager that doesn't exist" do
      o = Organization.create
      expect{ o.add_manager('frog') }.to raise_error("invalid user")
    end
    
    it "should error on adding a manager that is managing a different organization" do
      o = Organization.create
      u = User.create(:managed_organization_id => o.id + 1)
      
      expect{ o.add_manager(u.user_name, true) }.to raise_error("already associated with a different organization")
      u.reload
      expect(u.managed_organization_id).to eq(o.id + 1)
      expect(u.settings['full_manager']).not_to eq(true)
    end
    
    it "should correctly remove a manager" do
      o = Organization.create
      u = User.create
      o.add_manager(u.user_name, true)
      expect(o.manager?(u.reload)).to eq(true)
      expect(o.assistant?(u)).to eq(true)
      
      res = o.remove_manager(u.user_name)
      expect(res).to eq(true)
      u.reload
      expect(u.managed_organization_id).to eq(nil)
      expect(u.settings['full_manager']).not_to eq(true)
    end
    
    it "should correctly remove an assistant" do
      o = Organization.create
      u = User.create
      o.add_manager(u.user_name)
      expect(o.manager?(u.reload)).to eq(false)
      expect(o.assistant?(u)).to eq(true)
      
      res = o.remove_manager(u.user_name)
      expect(res).to eq(true)
      u.reload
      expect(u.managed_organization_id).to eq(nil)
      expect(u.settings['full_manager']).not_to eq(true)
    end
    
    it "should error on removing a manager that doesn't exist" do
      o = Organization.create
      expect{ o.remove_manager('frog') }.to raise_error("invalid user")
    end
    
    it "should error on removing a manager that is managing a different organization" do
      o = Organization.create
      u = User.create(:managed_organization_id => o.id + 1)
      
      expect{ o.remove_manager(u.user_name) }.to raise_error("associated with a different organization")
      u.reload
      expect(u.managed_organization_id).to eq(o.id + 1)
      expect(u.settings['full_manager']).not_to eq(true)
    end
  end
  
  describe "managing users" do
    it "should correctly add a user" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      
      res = o.add_user(u.user_name, true)
      u.reload
      expect(res).to eq(true)
      expect(u.managing_organization_id).to eq(o.id)
    end
    
    it "should error on adding a user that doesn't exist" do
      o = Organization.create
      expect{ o.add_user('bacon', false) }.to raise_error('invalid user')
    end
     
    it "should error on adding a user when there aren't any allotted" do
      o = Organization.create
      u = User.create
      expect{ o.add_user(u.user_name, false) }.to raise_error("no licenses available")
    end
    
    it "should remember how much time was left on the subscription" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create(:expires_at => Time.now + 100)
      expect(u.expires_at) == Time.now + 100
      o.add_user(u.user_name, false)
      u.reload
      expect(u.settings['subscription']['seconds_left']).to be > 90
      expect(u.settings['subscription']['seconds_left']).to be <= 100
    end

    it "should notify the user when they are added by an org" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_assigned, u.global_id, o.global_id)
      res = o.add_user(u.user_name, true)
      u.reload
      expect(res).to eq(true)
      expect(u.managing_organization_id).to eq(o.id)
    end
    
    it "should error on adding a user that is managed by a different organization" do
      o = Organization.create
      u = User.create(:managing_organization_id => o.id + 1)
      
      expect{ o.add_user(u.user_name, false) }.to raise_error("already associated with a different organization")
    end
    
    it "should correctly remove a user" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      
      res = o.add_user(u.user_name, false)
      u.reload
      expect(res).to eq(true)
      expect(u.managing_organization_id).to eq(o.id)
      
      res = o.remove_user(u.user_name)
      u.reload
      expect(res).to eq(true)
      expect(u.managing_organization_id).to eq(nil)
    end
    
    it "should update a user's expires_at when they are removed" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create(:expires_at => Time.now + 100, :settings => {'subscription' => {'seconds_left' => 3.weeks.to_i}}, :managing_organization_id => o.id)
      o.remove_user(u.user_name)
      u.reload
      expect(u.settings['subscription_left']) == nil
      expect(u.expires_at).to be >= Time.now + (3.weeks.to_i - 10)
      expect(u.expires_at).to be <= Time.now + (3.weeks.to_i + 10)
    end
    
    it "should give the user a window of time when they are removed if they have no expires_at time left" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create(:expires_at => Time.now + 100, :settings => {'subscription' => {'seconds_left' => 5}}, :managing_organization_id => o.id)
      o.remove_user(u.user_name)
      u.reload
      expect(u.settings['subscription_left']) == nil
      expect(u.expires_at).to be >= Time.now + (2.weeks.to_i - 10)
      expect(u.expires_at).to be <= Time.now + (2.weeks.to_i + 10)
    end
    
    it "should notify a user when they are removed by an org" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      
      res = o.add_user(u.user_name, false)
      u.reload
      expect(res).to eq(true)
      expect(u.managing_organization_id).to eq(o.id)
      
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_unassigned, u.global_id, o.global_id)
      res = o.remove_user(u.user_name)
      u.reload
      expect(res).to eq(true)
      expect(u.managing_organization_id).to eq(nil)
    end
    
    it "should error on removing a user that doesn't exist" do
      o = Organization.create
      expect{ o.remove_user('fred') }.to raise_error("invalid user")
    end
    
    it "should error on removing a user that is managed by a different organization" do
      o = Organization.create
      u = User.create(:managing_organization_id => o.id + 1)
      
      expect{ o.remove_user(u.user_name) }.to raise_error("associated with a different organization")
    end
  end
  
  describe "permissions" do
    it "should allow a manager to supervise org-linked users" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      u2 = User.create
      m = User.create
      
      expect(u.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(u2.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(m.permissions_for(u)).to eq({'user_id' => u.global_id, 'view_existence' => true})
      
      o.add_manager(m.user_name, true)
      u.reload
      m.reload
      expect(u.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(u2.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(m.permissions_for(u)).to eq({'user_id' => u.global_id, 'view_existence' => true})

      o.add_user(u.user_name, false)
      u.reload
      m.reload
      expect(u.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true, 'view_detailed' => true, 'supervise' => true, 'manage_supervision' => true, 'support_actions' => true, 'view_deleted_boards' => true})
      expect(u2.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(m.permissions_for(u)).to eq({'user_id' => u.global_id, 'view_existence' => true})
    end
    
    it "should not allow a manager to supervise pending org-linked users" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      u2 = User.create
      m = User.create
      
      expect(u.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(u2.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(m.permissions_for(u)).to eq({'user_id' => u.global_id, 'view_existence' => true})
      
      o.add_manager(m.user_name, true)
      u.reload
      m.reload
      expect(u.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(u2.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(m.permissions_for(u)).to eq({'user_id' => u.global_id, 'view_existence' => true})

      o.add_user(u.user_name, true)
      u.reload
      m.reload
      expect(u.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(u2.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(m.permissions_for(u)).to eq({'user_id' => u.global_id, 'view_existence' => true})
    end
    
    it "should not allow an assistant to supervisor org-linked users" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      m = User.create
      
      expect(u.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(m.permissions_for(u)).to eq({'user_id' => u.global_id, 'view_existence' => true})
      
      o.add_manager(m.user_name, false)
      u.reload
      m.reload
      expect(u.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(m.permissions_for(u)).to eq({'user_id' => u.global_id, 'view_existence' => true})

      o.add_user(u.user_name, false)
      u.reload
      m.reload
      expect(u.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(m.permissions_for(u)).to eq({'user_id' => u.global_id, 'view_existence' => true})
    end
    
    it "should allow an admin to supervise any users" do
      o = Organization.create(:admin => true, :settings => {'total_licenses' => 1})
      u = User.create
      u2 = User.create
      m = User.create
      
      o.add_manager(m.user_name, true)
      m.reload
      o.add_user(u2.user_name, false)
      u2.reload
      
      expect(u.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true, 'view_detailed' => true, 'supervise' => true, 'manage_supervision' => true, 'support_actions' => true, 'admin_support_actions' => true, 'view_deleted_boards' => true})
      expect(u2.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true, 'view_detailed' => true, 'supervise' => true, 'manage_supervision' => true, 'support_actions' => true, 'admin_support_actions' => true, 'view_deleted_boards' => true})
    end
    
    it "should not allow an admin assistant to supervise users" do
      o = Organization.create(:admin => true, :settings => {'total_licenses' => 1})
      u = User.create
      u2 = User.create
      m = User.create
      
      o.add_manager(m.user_name, false)
      m.reload
      o.add_user(u2.user_name, false)
      u2.reload
      
      expect(u.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
      expect(u2.permissions_for(m)).to eq({'user_id' => m.global_id, 'view_existence' => true})
    end
    
    it "should allow a manager to edit organization settings" do
      o = Organization.create
      m = User.create
      expect(o.permissions_for(m.reload)).to eq({'user_id' => m.global_id})

      o.add_manager(m.user_name, true)
      expect(o.permissions_for(m.reload)).to eq({'user_id' => m.global_id, 'view' => true, 'edit' => true, 'manage' => true})
    end
    
    it "should allow an assistant to edit organization settings" do
      o = Organization.create
      m = User.create
      expect(o.permissions_for(m)).to eq({'user_id' => m.global_id})

      o.add_manager(m.user_name, false)
      expect(o.permissions_for(m.reload)).to eq({'user_id' => m.global_id, 'view' => true, 'edit' => true})
    end
    
    it "should allow viewing for an organization that is set to public" do
      o = Organization.create
      expect(o.permissions_for(nil)).to eq({'user_id' => nil})
      
      o.settings['public'] = true
      o.updated_at = Time.now
      expect(o.permissions_for(nil)).to eq({'user_id' => nil, 'view' => true})
    end
    
  end
  
  describe "manager_for?" do
    it "should not error on null values" do
      u = User.create
      expect(Organization.manager_for?(nil, nil)).to eq(false)
      expect(Organization.manager_for?(u, nil)).to eq(false)
      expect(Organization.manager_for?(nil, u)).to eq(false)
    end
    
    it "should return true for an org manager over the user's account" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      m = User.create
      o.add_user(u.user_name, false)
      o.add_manager(m.user_name, true)
      u.reload
      m.reload
      
      expect(Organization.manager_for?(m, u)).to eq(true)
      expect(Organization.manager_for?(u, m)).to eq(false)
    end
    
    it "should return false for an org assistant over the user's account" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      m = User.create
      o.add_user(u.user_name, false)
      o.add_manager(m.user_name, false)
      u.reload
      m.reload
      
      expect(Organization.manager_for?(m, u)).to eq(false)
      expect(Organization.manager_for?(u, m)).to eq(false)
    end
    
    it "should return false for an org manager over a different user's account" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      o2 = Organization.create
      u = User.create
      m = User.create
      o.add_user(u.user_name, false)
      o2.add_manager(m.user_name, true)
      u.reload
      m.reload
      
      expect(Organization.manager_for?(m, u)).to eq(false)
      expect(Organization.manager_for?(u, m)).to eq(false)
    end
    
    it "should return false for a user tied to no org" do
      o = Organization.create
      u = User.create
      m = User.create
      o.add_manager(m.user_name, true)
      u.reload
      m.reload
      
      expect(Organization.manager_for?(m, u)).to eq(false)
      expect(Organization.manager_for?(u, m)).to eq(false)
    end
    
    it "should return false for a manager tied to no org" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      m = User.create
      o.add_user(u.user_name, false)
      u.reload
      m.reload
      
      expect(Organization.manager_for?(m, u)).to eq(false)
      expect(Organization.manager_for?(u, m)).to eq(false)
    end
    
    it "should return true for an admin" do
      o = Organization.create(:admin => true, :settings => {'total_licenses' => 1})
      u = User.create
      u2 = User.create
      m = User.create
      o.add_user(u.user_name, false)
      o.add_manager(m.user_name, true)
      u.reload
      m.reload
      
      expect(Organization.manager_for?(m, u)).to eq(true)
      expect(Organization.manager_for?(m, u2)).to eq(true)
      expect(Organization.manager_for?(u, m)).to eq(false)
      expect(Organization.manager_for?(u2, m)).to eq(false)
    end
  end
  
  describe "permissions cache" do
    it "should invalidate the cache when a manager is added" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      u2 = User.create
      Organization.where(:id => o.id).update_all(:updated_at => 2.weeks.ago)
      expect(o.reload.updated_at).to be < 1.hour.ago
      o.add_user(u.user_name, false)
      expect(o.reload.updated_at).to be < 1.hour.ago
      o.add_manager(u2.user_name)
      expect(o.reload.updated_at).to be > 1.hour.ago
    end
    
    it "should invalidate the cache when a manager is removed" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      u2 = User.create
      o.add_user(u.user_name, false)
      o.add_manager(u2.user_name)
      Organization.where(:id => o.id).update_all(:updated_at => 2.weeks.ago)
      expect(o.reload.updated_at).to be < 1.hour.ago
      o.remove_user(u.user_name)
      expect(o.reload.updated_at).to be < 1.hour.ago
      o.remove_manager(u2.user_name)
      expect(o.reload.updated_at).to be > 1.hour.ago
    end
  end
  
  describe "process" do
    it "should allow updating allotted_licenses" do
      o = Organization.create
      o.process({
        :allotted_licenses => 5
      })
      expect(o.settings['total_licenses']).to eq(5)
    end
    
    it "should error greacefully if allotted_licenses is decreased to fewer than are already used" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      o.add_user(u.user_name, false)
      res = o.process({:allotted_licenses => 0})
      expect(res).to eq(false)
      expect(o.processing_errors).to eq(["too few licenses, remove some users first"])
    end
  end
  
  describe "log_sessions" do
    it "should return sessions only for attached org users" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      d = Device.create(:user => u)
      u2 = User.create
      d2 = Device.create(:user => u2)
      o.add_user(u.user_name, false)
      LogSession.process_new({
        :events => [
          {'timestamp' => 4.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
          {'timestamp' => 3.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => u, :device => d, :author => u})
      LogSession.process_new({
        :events => [
          {'timestamp' => 4.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
          {'timestamp' => 3.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => u2, :device => d2, :author => u2})
      expect(o.reload.log_sessions.count).to eq(1)
    end
    
    it "should return all sessions for the admin org" do
      o = Organization.create(:admin => true, :settings => {'total_licenses' => 1})
      u = User.create
      d = Device.create(:user => u)
      u2 = User.create
      d2 = Device.create(:user => u2)
      o.add_user(u.user_name, false)
      LogSession.process_new({
        :events => [
          {'timestamp' => 4.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
          {'timestamp' => 3.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => u, :device => d, :author => u})
      LogSession.process_new({
        :events => [
          {'timestamp' => 4.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
          {'timestamp' => 3.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => u2, :device => d2, :author => u2})
      expect(o.reload.log_sessions.count).to eq(2)
    end
  end
end
