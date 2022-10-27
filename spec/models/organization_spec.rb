require 'spec_helper'

describe Organization, :type => :model do
  describe "managing managers" do
    it "should correctly add a manager" do
      o = Organization.create
      u = User.create
      expect(o.manager?(u)).to eq(false)
      
      res = o.add_manager(u.user_name, true)
      expect(res).to eq(true)
      u.reload
      expect(o.manager?(u)).to eq(true)
      expect(o.assistant?(u)).to eq(true)
    end
    
    it "should correctly add an assistant" do
      o = Organization.create
      u = User.create
      expect(o.manager?(u)).to eq(false)
      
      res = o.add_manager(u.user_name, false)
      expect(res).to eq(true)
      u.reload
      expect(o.manager?(u)).to eq(false)
      expect(o.assistant?(u)).to eq(true)
    end
    
    it "should error on adding a manager that doesn't exist" do
      o = Organization.create
      expect{ o.add_manager('frog') }.to raise_error("invalid user")
    end
    
    it "should not error on adding a manager that is managing a different organization" do
      o = Organization.create
      o2 = Organization.create
      u = User.create
      o2.add_manager(u.user_name, true)
      
      expect { o.add_manager(u.user_name, true) }.to_not raise_error
      u.reload
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
      expect(o.manager?(u.reload)).to eq(false)
    end
    
    it "should allow being a manager for more than one org" do
      o1 = Organization.create
      o2 = Organization.create
      u = User.create
      o1.add_manager(u.user_name, true)
      o2.add_manager(u.user_name, true)
      u.reload
      expect(u.settings['manager_for'].keys.sort).to eq([o1.global_id, o2.global_id].sort)
      expect(o1.reload.manager?(u)).to eq(true)
      expect(o2.reload.manager?(u)).to eq(true)
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
      expect(o.manager?(u.reload)).to eq(false)
      expect(o.assistant?(u)).to eq(false)
    end
    
    it "should error on removing a manager that doesn't exist" do
      o = Organization.create
      expect{ o.remove_manager('frog') }.to raise_error("invalid user")
    end
    
    it "should not error on removing a manager that is managing a different organization" do
      o = Organization.create
      o2 = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      o2.add_manager(u.user_name, true)
      u.reload
      
      expect { o.remove_manager(u.user_name) }.to_not raise_error
    end
  end
  
  describe "managing supervisors" do
    it "should correctly add a supervisor" do
      o = Organization.create
      u = User.create
      o.add_supervisor(u.user_name, true)
      expect(o.supervisor?(u.reload)).to eq(true)
      expect(o.pending_supervisor?(u.reload)).to eq(true)
      
      o.add_supervisor(u.user_name, false)
      expect(o.supervisor?(u.reload)).to eq(true)
      expect(o.pending_supervisor?(u.reload)).to eq(false)
    end
    
    it "should allow being a supervisor for multiple organizations" do
      o1 = Organization.create
      o2 = Organization.create
      u = User.create
      o1.add_supervisor(u.user_name, true)
      o2.add_supervisor(u.user_name, false)
      u.reload
      expect(o1.supervisor?(u)).to eq(true)
      expect(o1.pending_supervisor?(u)).to eq(true)
      expect(o2.supervisor?(u)).to eq(true)
      expect(o2.pending_supervisor?(u)).to eq(false)
    end
    
    it "should error adding a null user as a supervisor" do
      o = Organization.create
      u = User.create
      expect { o.add_supervisor('bacon', true) }.to raise_error("invalid user")
    end
    
    it "should error removing a null user as a supervisor" do
      o = Organization.create
      u = User.create
      expect { o.remove_supervisor('bacon') }.to raise_error("invalid user")
    end
    
    it "should correctly remove a supervisor" do
      o = Organization.create
      u = User.create
      o.add_supervisor(u.user_name, true)
      expect(o.supervisor?(u.reload)).to eq(true)
      expect(o.pending_supervisor?(u.reload)).to eq(true)
      
      o.remove_supervisor(u.user_name)
      expect(o.supervisor?(u.reload)).to eq(false)
      expect(o.pending_supervisor?(u.reload)).to eq(false)
    end
    
    it "should keep other supervision settings intact when being removed as a supervisor" do
      o = Organization.create
      o2 = Organization.create
      u = User.create
      o.add_supervisor(u.user_name, true)
      expect(o.supervisor?(u.reload)).to eq(true)
      expect(o.pending_supervisor?(u.reload)).to eq(true)
      o2.add_supervisor(u.user_name, true)
      expect(o2.supervisor?(u.reload)).to eq(true)
      expect(o2.pending_supervisor?(u.reload)).to eq(true)
      
      o.remove_supervisor(u.user_name)
      expect(o.supervisor?(u.reload)).to eq(false)
      expect(o.pending_supervisor?(u.reload)).to eq(false)
      expect(o2.supervisor?(u.reload)).to eq(true)
      expect(o2.pending_supervisor?(u.reload)).to eq(true)
    end
    
    it "should allow org admins to see basic information about added supervisors" do
      o = Organization.create
      u = User.create
      u2 = User.create
      o.add_manager(u.user_name, true)
      o.add_supervisor(u2.user_name, false)
      o.reload
      expect(Organization.manager_for?(u.reload, u2.reload)).to eq(true)
      expect(u2.allows?(u, 'supervise')).to eq(true)
      expect(u2.allows?(u, 'manage_supervision')).to eq(true)
      expect(u2.allows?(u, 'view_detailed')).to eq(true)
    end

    it "should not allow org admins to see basic information about pending added supervisors" do
      o = Organization.create
      u = User.create
      u2 = User.create
      o.add_manager(u.user_name, true)
      o.add_supervisor(u2.user_name, true)
      perms = u2.reload.permissions_for(u.reload)
      expect(u2.allows?(u, 'supervise')).to eq(false)
      expect(u2.allows?(u, 'manage_supervision')).to eq(false)
      expect(u2.allows?(u, 'view_detailed')).to eq(false)
    end
  end
  
  describe "user types" do
    it "should correctly identify sponsored_user?" do
      o = Organization.create
      u = User.new
      u.settings = {'managed_by' => {}}
      u.settings['managed_by'][o.global_id] = {'sponsored' => true, 'pending' => false}
      expect(o.sponsored_user?(u)).to eq(true)
    end
    
    it "should correctly identify manager?" do
      o = Organization.create
      u = User.new
      u.settings = {'manager_for' => {}}
      u.settings['manager_for'][o.global_id] = {'full_manager' => true}
      expect(o.manager?(u)).to eq(true)
      expect(o.assistant?(u)).to eq(true)
    end
    
    it "should correctly identify assistant?" do
      o = Organization.create
      u = User.new
      u.settings = {'manager_for' => {}}
      u.settings['manager_for'][o.global_id] = {'full_manager' => false}
      expect(o.manager?(u)).to eq(false)
      expect(o.assistant?(u)).to eq(true)
    end
    
    it "should correctly identify supervisor?" do
      o = Organization.create
      u = User.new
      u.settings = {'supervisor_for' => {}}
      u.settings['supervisor_for'][o.global_id] = {'pending' => false}
      expect(o.supervisor?(u)).to eq(true)
      expect(o.pending_supervisor?(u)).to eq(false)
    end

    it "should correctly identify pending_supervisor?" do
      o = Organization.create
      u = User.new
      u.settings = {'supervisor_for' => {}}
      u.settings['supervisor_for'][o.global_id] = {'pending' => true}
      expect(o.supervisor?(u)).to eq(true)
      expect(o.pending_supervisor?(u)).to eq(true)
    end
    
    it "should correctly identify managed_user?" do
      o = Organization.create
      u = User.new
      u.settings = {'managed_by' => {}}
      u.settings['managed_by'][o.global_id] = {'pending' => false, 'sponsored' => false}
      expect(o.managed_user?(u)).to eq(true)
    end
    
    it "should correctly identify pending_user?" do
      o = Organization.create
      u = User.new
      u.settings = {'managed_by' => {}}
      u.settings['managed_by'][o.global_id] = {'pending' => true, 'sponsored' => false}
      expect(o.pending_user?(u)).to eq(true)
    end
  end
  
  describe "managing users" do
    it "should correctly add a user" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      
      res = o.add_user(u.user_name, true)
      u.reload
      expect(res).to eq(true)
      expect(o.sponsored_user?(u)).to eq(true)
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
    
    it "should not allow being a user in more than one org" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      o2 = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create(:expires_at => Time.now + 100)
      expect(u.expires_at) == Time.now + 100
      res = o.add_user(u.user_name, false)
      expect(res).to eq(true)
      u.reload
      expect(o.managed_user?(u)).to eq(true)
      expect(o2.managed_user?(u)).to eq(false)
      expect { o2.add_user(u.user_name, false) }.to raise_error("already associated with a different organization")
    end

    it "should notify the user when they are added by an org" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_assigned, u.global_id, o.global_id)
      res = o.add_user(u.user_name, true)
      u.reload
      expect(res).to eq(true)
      expect(o.sponsored_user?(u)).to eq(true)
    end
    
    it "should error on adding a user that is managed by a different organization" do
      o = Organization.create
      o2 = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      o2.add_user(u.user_name, false, true)
      
      expect{ o.add_user(u.user_name, false) }.to raise_error("already associated with a different organization")
    end
    
    it "should correctly remove a user" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      
      res = o.add_user(u.user_name, false)
      u.reload
      expect(res).to eq(true)
      expect(o.sponsored_user?(u)).to eq(true)
      
      res = o.remove_user(u.user_name)
      u.reload
      expect(res).to eq(true)
      expect(o.sponsored_user?(u)).to eq(false)
    end
    
    it "should update a user's expires_at when they are removed" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create(:expires_at => Time.now + 100, :settings => {'subscription' => {'org_sponsored' => true, 'seconds_left' => 3.weeks.to_i}})
      u.settings['managed_by'] = {}
      u.settings['managed_by'][o.global_id] = {'sponsored' => true, 'pending' => false}
      u.save
      o.remove_user(u.user_name)
      u.reload
      expect(u.settings['subscription_left']) == nil
      expect(u.expires_at).to be >= Time.now + (3.weeks.to_i - 10)
      expect(u.expires_at).to be <= Time.now + (3.weeks.to_i + 10)
    end
    
    it "should not update a user's non-sponsored expires_at when they are removed" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create(:expires_at => Time.now + 100, :settings => {'subscription' => {'org_sponsored' => false, 'seconds_left' => 3.weeks.to_i}})
      u.settings['managed_by'] = {}
      u.settings['managed_by'][o.global_id] = {'sponsored' => true, 'pending' => false}
      u.save
      o.remove_user(u.user_name)
      u.reload
      expect(u.settings['subscription_left']) == nil
      expect(u.expires_at).to be >= Time.now + 90
      expect(u.expires_at).to be <= Time.now + 110
    end
    
    it "should give the user a window of time when they are removed if they have no expires_at time left" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create(:expires_at => Time.now + 100, :settings => {'subscription' => {'org_sponsored' => true, 'seconds_left' => 5}})
      u.settings['managed_by'] = {}
      u.settings['managed_by'][o.global_id] = {'sponsored' => true, 'pending' => false}
      u.save
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
      expect(o.user?(u)).to eq(true)
      
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_unassigned, u.global_id, o.global_id)
      res = o.remove_user(u.user_name)
      u.reload
      expect(res).to eq(true)
      expect(o.user?(u)).to eq(false)
    end
    
    it "should error on removing a user that doesn't exist" do
      o = Organization.create
      expect{ o.remove_user('fred') }.to raise_error("invalid user")
    end
    
    it "should error on removing a user that is managed by a different organization" do
      o = Organization.create
      o2 = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      o2.add_user(u.user_name, false, true)
      
      expect{ o.remove_user(u.user_name) }.to raise_error("already associated with a different organization")
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
      expect(o.reload.updated_at).to be > 1.hour.ago
      Organization.where(:id => o.id).update_all(:updated_at => 2.weeks.ago)
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
      expect(o.reload.updated_at).to be > 1.hour.ago
      Organization.where(:id => o.id).update_all(:updated_at => 2.weeks.ago)
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
      }, {'updater' => User.create})
      expect(o.settings['total_licenses']).to eq(5)
    end
    
    it "should error gracefully if allotted_licenses is decreased to fewer than are already used" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      o.add_user(u.user_name, false, true)
      expect(o.reload.sponsored_users.count).to eq(1)
      res = o.process({:allotted_licenses => 0}, {'updater' => u})
      expect(res).to eq(false)
      expect(o.processing_errors).to eq(["too few licenses, remove some users first"])
    end
    
    it "should handle management actions without overwriting changes in a subsequent save" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
      o.process({
        :management_action => 'add_user-#{u.user_name}'
      }, {'updater' => User.create})
      expect(res).to eq(true)
      expect(o.users.length).to eq(1)
      u.reload
      expect(o.attached_users('user').length).to eq(1)
      expect(o.attached_users('pending_user').length).to eq(1)
      expect(o.attached_users('sponsored_user').length).to eq(0)
      expect(u.settings['managed_by']).to eq({})
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
  
  describe "process" do
    it "should log an event if the total licenses has changed" do
      o = Organization.create
      u = User.create
      o.process({'allotted_licenses' => 2}, {'updater' => u})
      expect(o.settings['purchase_events']).to_not eq(nil)
      expect(o.settings['purchase_events'].length).to eq(1)
      expect(o.settings['purchase_events'][0]['type']).to eq('update_license_count')
    end
    
    it "should not log an event if the total licenses is set to the same value" do
      o = Organization.create(:settings => {'total_licenses' => 2})
      u = User.create
      o.process({'allotted_licenses' => 2}, {'updater' => u})
      expect(o.settings['purchase_events']).to eq(nil)
    end
  end
  
  describe "subscription management" do
    it "should add a monitored subscription" do
      o = Organization.create
      u = User.create
      o.add_subscription(u.user_name)
      expect(o.reload.subscriptions).to eq([u])
    end
    
    it "should error when adding a subscription user that doesn't exist" do
      o = Organization.create
      expect { o.add_subscription('bacon') }.to raise_error("invalid user")
    end
    
    it "should log a purchase event when adding a subscription user" do
      o = Organization.create
      u = User.create
      o.add_subscription(u.user_name)
      expect(o.reload.subscriptions).to eq([u])
      expect(o.purchase_history).not_to eq(nil)
      expect(o.purchase_history.length).to eq(1)
      expect(o.purchase_history[0]['type']).to eq('add_subscription')
    end
    
    it "should remove a monitored subscription" do
      o = Organization.create
      u = User.create
      o.add_subscription(u.user_name)
      expect(o.reload.subscriptions).to eq([u])
      o.remove_subscription(u.user_name)
      expect(o.reload.subscriptions).to eq([])
    end
    
    it "should erorr when removing a subscription user that doesn't exist" do
      o = Organization.create
      expect { o.remove_subscription('bacon') }.to raise_error("invalid user")
    end
    
    it "should log a purchase event when removing a subscription user" do
      o = Organization.create
      u = User.create
      o.add_subscription(u.user_name)
      expect(o.reload.subscriptions).to eq([u])
      o.remove_subscription(u.user_name)
      expect(o.reload.subscriptions).to eq([])
      expect(o.purchase_history).not_to eq(nil)
      expect(o.purchase_history.length).to eq(2)
      expect(o.purchase_history[1]['type']).to eq('add_subscription')
      expect(o.purchase_history[0]['type']).to eq('remove_subscription')
    end
    
    it "should return a list of purchase events" do
      o = Organization.create
      u = User.create
      o.add_subscription(u.user_name)
      expect(o.reload.subscriptions).to eq([u])
      o.remove_subscription(u.user_name)
      expect(o.reload.subscriptions).to eq([])
      expect(o.purchase_history).not_to eq(nil)
      expect(o.purchase_history.length).to eq(2)
      expect(o.purchase_history[1]['type']).to eq('add_subscription')
      expect(o.purchase_history[0]['type']).to eq('remove_subscription')
    end
    
    it "should log the specified purchase event" do
      o = Organization.create
      o.log_purchase_event({'asdf' => 1})
      o.log_purchase_event({'jkl' => 1})
      expect(o.settings['purchase_events']).to_not eq(nil)
      expect(o.settings['purchase_events'].length).to eq(2)
      es = o.settings['purchase_events'].sort_by{|e| e['asdf'] || 0 }
      expect(es[1]['asdf']).to eq(1)
      expect(Time.parse(es[1]['logged_at'])).to be > (Time.now - 10)
      expect(Time.parse(es[1]['logged_at'])).to be < (Time.now + 10)
      expect(es[0]['jkl']).to eq(1)
      expect(Time.parse(es[0]['logged_at'])).to be > (Time.now - 10)
      expect(Time.parse(es[0]['logged_at'])).to be < (Time.now + 10)
    end
    
    it "should return a list of subscription users" do
      o = Organization.create
      u1 = User.create
      u2 = User.create
      o.add_subscription(u1.user_name)
      expect(o.reload.subscriptions).to eq([u1])
      o.add_subscription(u2.user_name)
      expect(o.reload.subscriptions).to eq([u1, u2])
    end
  end
  
  describe "new user management" do
    it "should add a user" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
    
      res = o.add_user(u.user_name, true)
      expect(res).to eq(true)
      expect(o.reload.users.count).to eq(1)
    
      u.reload
      expect(u.org_sponsored?).to eq(true)
      expect(u.org_sponsored?).to eq(true)
      expect(o.managed_user?(u)).to eq(true)
    end
  
    it "should remove a user" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
    
      res = o.add_user(u.user_name, true)
      expect(res).to eq(true)
      expect(o.reload.users.count).to eq(1)
      expect(o.pending_user?(u.reload)).to eq(true)
      expect(o.managed_user?(u)).to eq(true)
    
      o.remove_user(u.user_name)
      expect(o.reload.users.count).to eq(0)
    end
  
    it "should add an unsponsored user" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
    
      res = o.add_user(u.user_name, false, false)
      expect(res).to eq(true)
      expect(o.reload.users.count).to eq(1)
      expect(o.managed_user?(u.reload)).to eq(true)
      expect(o.pending_user?(u)).to eq(false)
      expect(o.sponsored_user?(u)).to eq(false)
    end
  
    it "should add a manager" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
    
      res = o.add_manager(u.user_name, true)
      expect(res).to eq(true)
      expect(o.reload.managers.count).to eq(1)

      expect(o.manager?(u.reload)).to eq(true)
      expect(o.manager?(u)).to eq(true)
    end
  
    it "should add an assistant" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
    
      res = o.add_manager(u.user_name, false)
      expect(res).to eq(true)
      expect(o.reload.managers.count).to eq(1)
    end

    it "should remove a manager" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
    
      res = o.add_manager(u.user_name, true)
      expect(res).to eq(true)
      expect(o.reload.managers.count).to eq(1)
      expect(o.manager?(u.reload)).to eq(true)

      o.remove_manager(u.user_name)
      expect(o.reload.managers.count).to eq(0)
    end
  
    it "should add a supervisor" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
    
      res = o.add_supervisor(u.user_name)
      expect(res).to eq(true)
      expect(o.reload.supervisors.count).to eq(1)
      expect(o.supervisor?(u.reload)).to eq(true)
    end
  
    it "should remove a supervisor" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
    
      res = o.add_supervisor(u.user_name)
      expect(res).to eq(true)
      expect(o.reload.supervisors.count).to eq(1)
    
      o.remove_supervisor(u.user_name)
      expect(o.reload.supervisors.count).to eq(0)
    end
  end
end
