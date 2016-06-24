require 'spec_helper'

describe OrganizationUnit, :type => :model do
  describe "generate_defaults" do
    it "should generate default values" do
      u = OrganizationUnit.new
      expect(u.settings).to eq(nil)
      u.generate_defaults
      expect(u.settings).to eq({})
    end
  end
  
  describe "permissions" do
    it "should allow org editors to access" do
      o = Organization.create
      ou = OrganizationUnit.create(:organization => o)
      u = User.create
      o.add_manager(u.user_name)
      u.reload
      expect(ou.permissions_for(u)).to eq({'user_id' => u.global_id, 'view' => true, 'edit' => true, 'delete' => true})
    end
    
    it "should not allow non-org editos to access" do
      o = Organization.create(:admin => true)
      ou = OrganizationUnit.create
      u = User.create
      o.add_manager(u.user_name)
      u.reload
      expect(ou.permissions_for(u)).to eq({'user_id' => u.global_id})
    end
  end
  
  describe "process_params" do
    it "should raise error if organization is not set" do
      expect{ OrganizationUnit.process_new({}, {}) }.to raise_error("organization required")
    end
    
    it "should set the name" do
      o = Organization.create
      ou = OrganizationUnit.process_new({'name' => 'Best Room'}, {'organization' => o})
      expect(ou.settings['name']).to eq('Best Room')
    end
    
    it "should call process_action if needed" do
      o = Organization.create
      ou = OrganizationUnit.create(:organization => o)
      expect(ou).to receive(:process_action).with('whatever').and_return(true)
      ou.process({'management_action' => 'whatever'})
    end
    
    it "should fail if process_action returns false" do
      o = Organization.create
      ou = OrganizationUnit.create(:organization => o)
      res = ou.process({'management_action' => 'whatever'})
      expect(res).to eq(false)
      expect(ou.processing_errors).to eq(["management_action was unsuccessful, whatever"])
    end
  end

  describe "process_action" do
    it "should call the correct action" do
      ou = OrganizationUnit.new
      expect(ou).to receive(:add_supervisor).with('chuck', false)
      expect(ou).to receive(:add_supervisor).with('nellie', true)
      expect(ou).to receive(:remove_supervisor).with('blast')
      expect(ou).to receive(:add_communicator).with('alexis')
      expect(ou).to receive(:remove_communicator).with('charles-in_charge')
      ou.process_action('add_supervisor-chuck')
      ou.process_action('add_edit_supervisor-nellie')
      ou.process_action('remove_supervisor-blast')
      ou.process_action('add_communicator-alexis')
      ou.process_action('remove_communicator-charles-in_charge')
      ou.process_action('nothing')
    end
  end

  describe "add_supervisor" do
    it "should return false if not an org supervisor" do
      ou = OrganizationUnit.create
      expect(ou.add_supervisor('asdf')).to eq(false)
      u = User.create
      expect(ou.add_supervisor(u.user_name)).to eq(false)
    end
    
    it "should add to the list of supervisors if valid" do
      o = Organization.create
      ou = OrganizationUnit.create(:organization => o)
      u = User.create
      o.add_supervisor(u.user_name)
      expect(ou.add_supervisor(u.user_name, true)).to eq(true)
      expect(ou.settings['supervisors'].length).to eq(1)
      expect(ou.settings['supervisors'][0]['user_id']).to eq(u.global_id)
      expect(ou.settings['supervisors'][0]['edit_permission']).to eq(true)
    end
    
    it "should not duplicate the user in the list of supervisors" do
      o = Organization.create
      ou = OrganizationUnit.create(:organization => o)
      u = User.create
      ou.settings['supervisors'] = [{'user_id' => u.global_id}]
      ou.save
      o.add_supervisor(u.user_name)
      expect(ou.add_supervisor(u.user_name, true)).to eq(true)
      expect(ou.add_supervisor(u.user_name, true)).to eq(true)
      expect(ou.add_supervisor(u.user_name, true)).to eq(true)
      expect(ou.settings['supervisors'].length).to eq(1)
    end
    
    it "should schedule supervisor assertion" do
      o = Organization.create
      ou = OrganizationUnit.create(:organization => o)
      u = User.create
      o.add_supervisor(u.user_name)
      expect(ou.add_supervisor(u.user_name, true)).to eq(true)
      args = [{'user_id' => u.global_id, 'add_supervisor' => u.user_name}]
      opts = {'id' => ou.id, 'method' => 'assert_supervision', 'arguments' => args}
      expect(Worker.scheduled?(OrganizationUnit, :perform_action, opts)).to eq(true)
    end
  end  
  
  describe "all_user_ids" do
    it "should return all supervisors and communicators" do
      ou = OrganizationUnit.new(:settings => {})
      expect(ou.all_user_ids).to eq([])
      ou.settings['supervisors'] = []
      expect(ou.all_user_ids).to eq([])
      ou.settings['communicators'] = []
      expect(ou.all_user_ids).to eq([])
      ou.settings['supervisors'] = [{'user_id' => 'asdf'}]
      expect(ou.all_user_ids).to eq(['asdf'])
      ou.settings['communicators'] = [{'user_id' => 'asdf'}, {'user_id' => 'jkl'}]
      expect(ou.all_user_ids).to eq(['asdf', 'jkl'])
    end
  end
  
  describe "remove_supervisor" do
    it "should return false if no user or org" do
      ou = OrganizationUnit.new
      expect(ou.remove_supervisor('bacon')).to eq(false)
      u = User.create
      expect(ou.remove_supervisor(u.user_name)).to eq(false)
    end
    
    it "should remove from the list of supervisors" do
      o = Organization.create
      u = User.create
      ou = OrganizationUnit.create(:organization => o, :settings => {
        'supervisors' => [{'user_id' => 'asdf'}, {'user_id' => u.global_id}]
      })
      expect(ou.remove_supervisor(u.global_id)).to eq(true)
      expect(ou.settings['supervisors'].length).to eq(1)
      expect(ou.settings['supervisors'].map{|s| s['user_id'] }).to eq(['asdf'])
    end
    
    it "should schedule supervisor assertion" do
      o = Organization.create
      ou = OrganizationUnit.create(:organization => o)
      u = User.create
      expect(ou.remove_supervisor(u.user_name)).to eq(true)
      args = [{'user_id' => u.global_id, 'remove_supervisor' => u.user_name}]
      opts = {'id' => ou.id, 'method' => 'assert_supervision', 'arguments' => args}
      expect(Worker.scheduled?(OrganizationUnit, :perform_action, opts)).to eq(true)
    end
  end
  
  describe "add_communicator" do
    it "should return false if the user is not an org-managed user" do
      ou = OrganizationUnit.new
      expect(ou.add_communicator('bacon')).to eq(false)
      u = User.create
      expect(ou.add_communicator(u.user_name)).to eq(false)
    end
    
    it "should add to the list of communicators if valid" do
      o = Organization.create
      ou = OrganizationUnit.create(:organization => o)
      u = User.create
      o.add_user(u.user_name, true, false)
      expect(ou.add_communicator(u.user_name)).to eq(true)
      expect(ou.settings['communicators'].length).to eq(1)
      expect(ou.settings['communicators'][0]['user_id']).to eq(u.global_id)
    end
    
    it "should not duplicate the user in the list" do
      o = Organization.create
      ou = OrganizationUnit.create(:organization => o)
      u = User.create
      ou.settings['communicators'] = [{'user_id' => u.global_id}]
      ou.save
      o.add_user(u.user_name, true, false)
      expect(ou.add_communicator(u.user_name)).to eq(true)
      expect(ou.add_communicator(u.user_name)).to eq(true)
      expect(ou.add_communicator(u.user_name)).to eq(true)
      expect(ou.settings['communicators'].length).to eq(1)
    end
    
    it "should schedule supervisor assertion" do
      o = Organization.create
      ou = OrganizationUnit.create(:organization => o)
      u = User.create
      o.add_user(u.user_name, true, false)
      expect(ou.add_communicator(u.user_name)).to eq(true)
      args = [{'user_id' => u.global_id, 'add_communicator' => u.user_name}]
      opts = {'id' => ou.id, 'method' => 'assert_supervision', 'arguments' => args}
      expect(Worker.scheduled?(OrganizationUnit, :perform_action, opts)).to eq(true)
    end
  end
  
  describe "remove_communicator" do
    it "should return false if no user or org" do
      ou = OrganizationUnit.new
      expect(ou.remove_communicator('bacon')).to eq(false)
      u = User.create
      expect(ou.remove_communicator(u.user_name)).to eq(false)
    end
    
    it "should remove from the list of communicators" do
    end
    
    it "should schedule supervisor assertion" do
      o = Organization.create
      ou = OrganizationUnit.create(:organization => o)
      u = User.create
      expect(ou.remove_communicator(u.user_name)).to eq(true)
      args = [{'user_id' => u.global_id, 'remove_communicator' => u.user_name}]
      opts = {'id' => ou.id, 'method' => 'assert_supervision', 'arguments' => args}
      expect(Worker.scheduled?(OrganizationUnit, :perform_action, opts)).to eq(true)
    end
  end
  
  describe "assert_list" do
    it "should update the list correctly" do
      ou = OrganizationUnit.new(:settings => {
        'supervisors' => [{'user_id' => 'asdf'}, {'user_id' => 'jkl'}, {'user_id' => 'jkl'}]
      })
      ou.assert_list('supervisors', 'jkl')
      expect(ou.settings['supervisors']).to eq([{'user_id' => 'asdf'}])
    end
    
    it "should handle when list not initialized" do
      ou = OrganizationUnit.new(:settings => {})
      ou.assert_list('something', nil)
      expect(ou.settings['something']).to eq([])
    end
  end  

  describe "assert_supervision" do
    it "should return false if no user found" do
      ou = OrganizationUnit.new(:settings => {})
      res = ou.assert_supervision({'user_id' => 'asdf'})
      expect(res).to eq(false)
    end
    
    it "should remove the supervisor from all room communicators if specified" do
      u1 = User.create
      u2 = User.create
      u3 = User.create
      u4 = User.create
      ou = OrganizationUnit.new
      ou.settings = {
        'communicators' => [{'user_id' => u1.global_id}, {'user_id' => u2.global_id}],
        'supervisors' => [{'user_id' => u3.global_id}, {'user_id' => u4.global_id}]
      }
      expect(User).to receive(:unlink_supervisor_from_user).with(u4, u1)
      expect(User).to receive(:unlink_supervisor_from_user).with(u4, u2)
      ou.assert_supervision({'user_id' => u4.global_id, 'remove_supervisor' => true})
    end
    
    it "should add the supervisor to all room communicators if specified" do
      u1 = User.create
      u2 = User.create
      u3 = User.create
      u4 = User.create
      ou = OrganizationUnit.create
      ou.settings = {
        'communicators' => [{'user_id' => u1.global_id}, {'user_id' => u2.global_id}],
        'supervisors' => [{'user_id' => u3.global_id}, {'user_id' => u4.global_id, 'edit_permission' => true}]
      }
      expect(User).to receive(:link_supervisor_to_user).with(u4, u1, nil, true, ou.global_id)
      expect(User).to receive(:link_supervisor_to_user).with(u4, u2, nil, true, ou.global_id)
      ou.assert_supervision({'user_id' => u4.global_id, 'add_supervisor' => true})
    end
    
    it "should add all room supervisors to the communicator if specified" do
      u1 = User.create
      u2 = User.create
      u3 = User.create
      u4 = User.create
      ou = OrganizationUnit.create
      ou.settings = {
        'communicators' => [{'user_id' => u1.global_id}, {'user_id' => u2.global_id}],
        'supervisors' => [{'user_id' => u3.global_id}, {'user_id' => u4.global_id, 'edit_permission' => true}]
      }
      expect(User).to receive(:link_supervisor_to_user).with(u4, u1, nil, true, ou.global_id)
      expect(User).to receive(:link_supervisor_to_user).with(u3, u1, nil, false, ou.global_id)
      ou.assert_supervision({'user_id' => u1.global_id, 'add_communicator' => true})
    end
    
    it "should remove all room supervisors from the communicator if specified" do
      u1 = User.create
      u2 = User.create
      u3 = User.create
      u4 = User.create
      ou = OrganizationUnit.new
      ou.settings = {
        'communicators' => [{'user_id' => u1.global_id}, {'user_id' => u2.global_id}],
        'supervisors' => [{'user_id' => u3.global_id}, {'user_id' => u4.global_id}]
      }
      expect(User).to receive(:unlink_supervisor_from_user).with(u4, u1)
      expect(User).to receive(:unlink_supervisor_from_user).with(u3, u1)
      ou.assert_supervision({'user_id' => u1.global_id, 'remove_communicator' => true})
    end
    
    it "should not remove other supervisors from the communicator" do
      u1 = User.create
      u2 = User.create
      u3 = User.create
      u4 = User.create
      u5 = User.create
      User.link_supervisor_to_user(u5, u1, nil, true)
      ou = OrganizationUnit.new
      ou.settings = {
        'communicators' => [{'user_id' => u1.global_id}, {'user_id' => u2.global_id}],
        'supervisors' => [{'user_id' => u3.global_id}, {'user_id' => u4.global_id}]
      }
      expect(User).to receive(:unlink_supervisor_from_user).with(u4, u1)
      expect(User).to receive(:unlink_supervisor_from_user).with(u3, u1)
      expect(User).to_not receive(:unlink_supervisor_from_user).with(u5, u1)
      ou.assert_supervision({'user_id' => u1.global_id, 'remove_communicator' => true})
    end
    
    it "should not remove the supervisor from their other communicators" do
      u1 = User.create
      u2 = User.create
      u3 = User.create
      u4 = User.create
      u5 = User.create
      User.link_supervisor_to_user(u4, u5, nil, true)
      ou = OrganizationUnit.new
      ou.settings = {
        'communicators' => [{'user_id' => u1.global_id}, {'user_id' => u2.global_id}],
        'supervisors' => [{'user_id' => u3.global_id}, {'user_id' => u4.global_id}]
      }
      expect(User).to receive(:unlink_supervisor_from_user).with(u4, u1)
      expect(User).to receive(:unlink_supervisor_from_user).with(u4, u2)
      expect(User).to_not receive(:unlink_supervisor_from_user).with(u4, u5)
      ou.assert_supervision({'user_id' => u4.global_id, 'remove_supervisor' => true})
    end
  end
end
