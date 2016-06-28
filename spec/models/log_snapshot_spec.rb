require 'spec_helper'

describe LogSnapshot, :type => :model do
  describe "generate_defaults" do
    it "should generate default values" do
      s = LogSnapshot.new
      expect(s.settings).to eq(nil)
      s.generate_defaults
      expect(s.settings).to eq({})
    end
  end
  
  describe "permissions" do
    it "should allow snapshot's user to access" do
      u = User.create
      s = LogSnapshot.create(:user => u)
      expect(s.permissions_for(u)).to eq({'user_id' => u.global_id, 'view' => true, 'edit' => true, 'delete' => true})
    end
    
    it "should allow supervisors to access read-only" do
      u = User.create
      u2 = User.create
      User.link_supervisor_to_user(u2, u, nil, false)
      s = LogSnapshot.create(:user => u)
      expect(s.permissions_for(u2)).to eq({'user_id' => u2.global_id, 'view' => true})
    end
    
    it "should allow edit supervisors to access" do
      u = User.create
      u2 = User.create
      User.link_supervisor_to_user(u2, u, nil, true)
      s = LogSnapshot.create(:user => u)
      expect(s.permissions_for(u2)).to eq({'user_id' => u2.global_id, 'view' => true, 'edit' => true, 'delete' => true})
    end
    
    it "should not allow any user to view or access" do
      u = User.create
      u2 = User.create
      s = LogSnapshot.create(:user => u)
      expect(s.permissions_for(u2)).to eq({'user_id' => u2.global_id})
    end
  end
  
  describe "process_params" do
    it "should raise error if user is not set" do
      expect{ LogSnapshot.process_new({}, {}) }.to raise_error("user required")
    end
    
    it "should set the name" do
      u = User.create
      s = LogSnapshot.process_new({'name' => 'Best Snapshot'}, {'user' => u})
      expect(s.settings['name']).to eq('Best Snapshot')
    end
    
    it "should ignore extra parameters" do
      u = User.create
      s = LogSnapshot.process_new({'name' => 'Best Snapshot', 'end' => 'sometime', 'chip' => 'chop'}, {'user' => u})
      expect(s.settings['name']).to eq('Best Snapshot')
      expect(s.settings['end']).to eq('sometime')
      expect(s.settings['chip']).to eq(nil)
    end
  end
end
