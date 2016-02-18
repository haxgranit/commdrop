require 'spec_helper'

describe Supervising, :type => :model do
  describe "linking" do
    it "should grant permissions to supervisors" do
      u = User.create
      u2 = User.create
      expect(u.permissions_for(u2)).to eq({
        'user_id' => u2.global_id,
        'view_existence' => true
      })
      u.settings['supervisors'] = [{'user_id' => u2.global_id}]
      u.updated_at = Time.now
      expect(u.permissions_for(u2)).to eq({
        'user_id' => u2.global_id,
        'view_existence' => true,
        'view_detailed' => true,
        'view_deleted_boards' => true,
        'supervise' => true
      })
      u.settings['supervisors'] = [{'user_id' => u2.global_id, 'edit_permission' => true}]
      u.updated_at = Time.now
      expect(u.permissions_for(u2)).to eq({
        'user_id' => u2.global_id,
        'manage_supervision' => true,
        'view_existence' => true,
        'view_detailed' => true,
        'view_deleted_boards' => true,
        'supervise' => true,
        'edit' => true
      })
    end
    
    it "should generate a link code for the user" do
      u = User.create
      code = u.generate_link_code
      expect(code).not_to eq(nil)
      id, nonce, ts = code.split(/-/, 3)
      expect(u.settings['link_codes']).to eq([code])
      expect(Time.at(ts.to_i)).to be > 10.seconds.ago
      expect(id).to eq(u.global_id)
    end
    
    it "should flush old link codes when generating a new link code" do
      u = User.create
      good_code = "#{u.global_id}-def-#{Time.now.to_i}"
      u.settings['link_codes'] = ["#{u.global_id}-abc-1389652558", good_code]
      code = u.generate_link_code
      expect(code).not_to eq(nil)
      expect(u.settings['link_codes'].length).to eq(2)
      expect(u.settings['link_codes']).to eq([good_code, code])
    end
    
    it "should not generate a link code for a non-premium user" do
      u = User.create('expires_at' => 12.months.ago)
      expect(u.generate_link_code).to eq(nil)
      expect(u.settings['link_codes']).to eq(nil)
    end
    
    it "should link a user to a new supervisor" do
      u = User.create
      code = u.generate_link_code
      u2 = User.create
      u2.link_to_supervisee_by_code(code)
      expect(u2.settings['supervisees']).to eq([{'user_id' => u.global_id, 'user_name' => u.user_name, 'edit_permission' => true}])
      u.reload
      expect(u.settings['supervisors']).to eq([{'user_id' => u2.global_id, 'user_name' => u2.user_name, 'edit_permission' => true}])
    end
    
    it "should link to a supervisee by code when editing" do
      u = User.create
      code = u.generate_link_code
      expect(code).not_to eq(nil)
      u2 = User.create
      u2.process({:supervisee_code => code})
      expect(u2.settings['supervisees']).to eq([{'user_id' => u.global_id, 'user_name' => u.user_name, 'edit_permission' => true}])
      u.reload
      expect(u.settings['supervisors']).to eq([{'user_id' => u2.global_id, 'user_name' => u2.user_name, 'edit_permission' => true}])
    end
    
    it "should error on supervisee failure when editing" do
      res = User.process_new({:supervisee_code => "1_1"})
      expect(res.errored?).to eq(true)
      expect(res.processing_errors).to eq(["can't modify supervisees on create"])
      
      u = User.create
      code = u.generate_link_code
      expect(code).not_to eq(nil)
      u.expires_at = 12.months.ago
      u.save
      res = User.create
      res.process({:supervisee_code => code})
      expect(res.errored?).to eq(true)
      expect(res.processing_errors).to eq(["supervisee add failed"])
    end
    
    it "should remove the link code once it has been used" do
      u = User.create
      code = u.generate_link_code
      u2 = User.create
      expect(u.settings['link_codes'].length).to eq(1)
      expect(u2.link_to_supervisee_by_code(code)).to eq(true)
      expect(u.reload.settings['link_codes'].length).to eq(0)
    end
    
    it "should not create multiple links to the same supervisor" do
      u = User.create
      u2 = User.create
      u.settings['supervisors'] = [{'user_id' => u2.global_id}]
      u.save

      code = u.generate_link_code
      expect(u2.link_to_supervisee_by_code(code)).to eq(true)
      u.reload
      expect(u.settings['supervisors']).to eq([{'user_id' => u2.global_id, 'user_name' => u2.user_name, 'edit_permission' => true}])
    end
    
    it "should not allow a user to supervise themself" do
      u = User.create

      code = u.generate_link_code
      expect(u.link_to_supervisee_by_code(code)).to eq(false)
    end

    it "should not accept an expired link code" do
      u = User.create
      u2 = User.create

      code = "#{u.global_id}-abc-1379652558"
      u.settings['link_codes'] = [code]
      u.save
      
      expect(u2.link_to_supervisee_by_code(code)).to eq(false)
      expect(u2.settings['supervisees']).to eq(nil)
      u.reload
      expect(u.settings['supervisors']).to eq(nil)
    end
    
    it "should not link a non-premium supervisor to a user with too many non-premium supervisors" do
      u = User.create
      u.settings['supervisors'] = []
      supers = []
      5.times do |i|
        s = User.create(:expires_at => 12.months.ago)
        u.settings['supervisors'] << {'user_id' => s.global_id}
        supers << s
      end
      u.save
      u2 = User.create
      code = u.generate_link_code
      expect(u2.link_to_supervisee_by_code(code)).to eq(false)
      
      s = supers.last
      s.expires_at = 12.hours.from_now
      s.save
      expect(u2.link_to_supervisee_by_code(code)).to eq(true)
    end
    
    it "should not link a supervisor to a non-premium user" do
      u = User.create
      code = u.generate_link_code
      expect(code).not_to eq(nil)
      u.expires_at = 12.months.ago
      u.save
      u2 = User.create
      expect(u2.link_to_supervisee_by_code(code)).to eq(false)
    end
    
    it "should unlink a user and supervisor" do
      u = User.create
      u2 = User.create(:settings => {'supervisees' => [{'user_id' => u.global_id}]})
      u.settings['supervisors'] = [{'user_id' => u2.global_id}]
      u.save
      User.unlink_supervisor_from_user(u2, u)
      expect(u2.settings['supervisees']).to eq([])
      expect(u.settings['supervisors']).to eq([])
    end
    
    it "should auto-set a supervisor as a supporter role" do
      u = User.create
      u2 = User.create
      expect(u2.settings['preferences']['role']).to eq('communicator')
      User.link_supervisor_to_user(u2, u)
      expect(u2.settings['preferences']['role']).to eq('supporter')
    end
    
    it "should not auto-set a supervisor as a supporter role if already set" do
      u = User.create
      u2 = User.create
      expect(u2.settings['preferences']['role']).to eq('communicator')
      User.link_supervisor_to_user(u2, u)
      expect(u2.settings['preferences']['role']).to eq('supporter')
      u2.settings['preferences']['role'] = 'communicator'
      u2.save
      u3 = User.create
      User.link_supervisor_to_user(u2, u3)
      expect(u2.settings['preferences']['role']).to eq('communicator')
    end
  end
  
  describe "adding and removing" do
    it "should allow adding a supervisor by key when editing" do
      u = User.create
      u2 = User.create
      u2.process({'supervisor_key' => "add-#{u.global_id}"})
      expect(u2.reload.settings['supervisors']).to eq([{'user_id' => u.global_id, 'user_name' => u.user_name, 'edit_permission' => false}])
      expect(u.reload.settings['supervisees']).to eq([{'user_id' => u2.global_id, 'user_name' => u2.user_name, 'edit_permission' => false}])
    end

    it "should allow adding an edit supervisor by key when editing" do
      u = User.create
      u2 = User.create
      u2.process({'supervisor_key' => "add_edit-#{u.global_id}"})
      expect(u2.reload.settings['supervisors']).to eq([{'user_id' => u.global_id, 'user_name' => u.user_name, 'edit_permission' => true}])
      expect(u.reload.settings['supervisees']).to eq([{'user_id' => u2.global_id, 'user_name' => u2.user_name, 'edit_permission' => true}])
    end

    it "should raise an error when supervisor adding fails" do
      res = User.process_new({'supervisor_key' => "add-bacon"})
      expect(res.errored?).to eql(true)
    end
    
    it "should allow removing a supervisor by key when editing" do
      u = User.create
      u2 = User.create
      User.link_supervisor_to_user(u2, u)
      expect(u.reload.settings['supervisors']).to eq([{'user_id' => u2.global_id, 'user_name' => u2.user_name, 'edit_permission' => true}])
      expect(u2.reload.settings['supervisees']).to eq([{'user_id' => u.global_id, 'user_name' => u.user_name, 'edit_permission' => true}])
      u.process({'supervisor_key' => "remove_supervisor-#{u2.global_id}"})
      expect(u.reload.settings['supervisors']).to eq([])
      expect(u2.reload.settings['supervisees']).to eq([])
    end
    it "should raise an error when supervisor remove fails" do
      u = User.create
      u.process({'supervisor_key' => "remove_supervisor-0_1"})
      expect(u.errored?).to eql(true)
    end
    
    it "should allow removing a supervisee by key when editing" do
      u = User.create
      u2 = User.create
      User.link_supervisor_to_user(u2, u)
      expect(u.reload.settings['supervisors']).to eq([{'user_id' => u2.global_id, 'user_name' => u2.user_name, 'edit_permission' => true}])
      expect(u2.reload.settings['supervisees']).to eq([{'user_id' => u.global_id, 'user_name' => u.user_name, 'edit_permission' => true}])
      u2.process({'supervisor_key' => "remove_supervisee-#{u.global_id}"})
      expect(u.reload.settings['supervisors']).to eq([])
      expect(u2.reload.settings['supervisees']).to eq([])
    end
    
    it "should raise an error when supervisee remove fails" do
      u = User.create
      u.process({'supervisor_key' => "remove_supervisee-0_1"})
      expect(u.errored?).to eql(true)
    end
    
    it "should allow approving a pending org" do
      u = User.create
      o = Organization.create(:settings => {'total_licenses' => 1})
      expect(o.reload.managed_user?(u)).to eq(false)
      o.add_user(u.user_name, true)
      expect(o.reload.managed_user?(u)).to eq(false)
      u.reload.process({'supervisor_key' => "approve-org"})
      expect(o.reload.managed_user?(u)).to eq(true)
    end
    
    it "should set a user to not-pending if they approve a pending org" do
      u = User.create
      o = Organization.create(:settings => {'total_licenses' => 1})
      expect(o.reload.managed_user?(u)).to eq(false)
      o.add_user(u.user_name, true)
      expect(o.reload.managed_user?(u)).to eq(false)
      u.reload.process({'supervisor_key' => "approve-org"})
      expect(o.reload.managed_user?(u)).to eq(true)
      expect(u.settings['pending']).to eq(false)
    end
    
    it "should allow rejecting a pending org" do
      u = User.create
      o = Organization.create(:settings => {'total_licenses' => 1})
      expect(o.reload.managed_user?(u)).to eq(false)
      o.add_user(u.user_name, true)
      expect(o.reload.managed_user?(u)).to eq(false)
      u.reload.process({'supervisor_key' => "remove_supervisor-org"})
      expect(o.reload.managed_user?(u)).to eq(false)
      expect(u.reload.managing_organization).to eq(nil)
    end
  end
  
  describe "managed_users" do
    it "should should return nothing for a non-manager" do
      u = User.create
      u2 = User.create
      o = Organization.create(:settings => {'total_licenses' => 1})
      o.add_user(u2.user_name, false)
      
      u.reload
      expect(u.managed_users).to eq([])
    end

    it "should return nothing for an assistant manager" do
      u = User.create
      u2 = User.create
      o = Organization.create(:settings => {'total_licenses' => 1})
      o.add_manager(u.user_name)
      o.add_user(u2.user_name, false)
      
      u.reload
      expect(u.managed_users).to eq([])
    end
    

    it "should return a list of users" do
      u = User.create
      u2 = User.create
      o = Organization.create(:settings => {'total_licenses' => 1})
      o.add_manager(u.user_name, true)
      o.add_user(u2.user_name, false)
      
      u.reload
      expect(u.managed_users).not_to eq([])
      expect(u.managed_users.length).to eq(1)
      expect(u.managed_users).to eq([u2])
    end
    
    it "should not grant permissions for the manager of a pending org invite" do
      u = User.create
      u2 = User.create
      o = Organization.create(:settings => {'total_licenses' => 1})
      o.add_manager(u.user_name, true)
      o.add_user(u2.user_name, true)
      
      u2.reload
      u.reload
      expect(u2.permissions_for(u)).not_to be_include('manage_supervision')
    end
    
    it "should grant manage_supervision permission for the manager of a managing org" do
      u = User.create
      u2 = User.create
      o = Organization.create(:settings => {'total_licenses' => 1})
      o.add_manager(u.user_name, true)
      o.add_user(u2.user_name, false)
      
      u2.reload
      u.reload
      expect(u2.permissions_for(u)).to be_include('manage_supervision')
    end
    
    it "should not grand manage_supervision permission for the assistant of a managing org" do
      u = User.create
      u2 = User.create
      o = Organization.create(:settings => {'total_licenses' => 1})
      o.add_manager(u.user_name, false)
      o.add_user(u2.user_name, false)
      
      u2.reload
      u.reload
      expect(u2.permissions_for(u)).not_to be_include('manage_supervision')
    end
  end
end
