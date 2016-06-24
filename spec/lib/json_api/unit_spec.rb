require 'spec_helper'

describe JsonApi::Unit do
  it "should have defined pagination defaults" do
    expect(JsonApi::Unit::TYPE_KEY).to eq('unit')
    expect(JsonApi::Unit::DEFAULT_PAGE).to eq(10)
    expect(JsonApi::Unit::MAX_PAGE).to eq(25)
  end

  describe "build_json" do
    it "should not include unlisted values" do
      u = OrganizationUnit.create(:settings => {'name' => 'Roomy', 'bacon' => 'asdf'})
      json = JsonApi::Unit.build_json(u)
      expect(json['bacon']).to eq(nil)
    end
    
    it "should include basic information" do
      u = OrganizationUnit.create(:settings => {'name' => 'Roomy', 'bacon' => 'asdf'})
      json = JsonApi::Unit.build_json(u)
      expect(json['id']).to eq(u.global_id)
      expect(json['name']).to eq('Roomy')
    end
    
    it "should include supervisors and communicators" do
      u1 = User.create
      u2 = User.create
      u3 = User.create
      o = Organization.create
      u = OrganizationUnit.create(:settings => {'name' => 'Roomy'}, :organization => o)
      o.add_user(u1.global_id, true, false)
      o.add_user(u3.global_id, true, false)
      o.add_supervisor(u2.global_id, true)
      o.add_supervisor(u3.global_id, true)
      
      u.add_communicator(u1.global_id)
      u.add_supervisor(u2.global_id)
      u.add_supervisor(u3.global_id, true)
      u.add_communicator(u3.global_id)
      json = JsonApi::Unit.build_json(u)
      expect(json['id']).to eq(u.global_id)
      expect(json['name']).to eq('Roomy')
      expect(json['communicators']).to_not eq(nil)
      expect(json['communicators'].length).to eq(2)
      expect(json['supervisors']).to_not eq(nil)
      expect(json['supervisors'].length).to eq(2)
    end
    
    it "should mark supervisors as having edit permission if that's true" do
      u1 = User.create
      u2 = User.create
      u3 = User.create
      o = Organization.create
      u = OrganizationUnit.create(:settings => {'name' => 'Roomy'}, :organization => o)
      o.add_user(u1.global_id, true, false)
      o.add_user(u3.global_id, true, false)
      o.add_supervisor(u2.global_id, true)
      o.add_supervisor(u3.global_id, true)

      u.add_communicator(u1.global_id)
      u.add_supervisor(u2.global_id)
      u.add_supervisor(u3.global_id, true)
      u.add_communicator(u3.global_id)
      json = JsonApi::Unit.build_json(u)
      expect(json['id']).to eq(u.global_id)
      expect(json['name']).to eq('Roomy')
      expect(json['communicators']).to_not eq(nil)
      expect(json['communicators'].length).to eq(2)
      expect(json['supervisors']).to_not eq(nil)
      expect(json['supervisors'].length).to eq(2)
      expect(json['supervisors'][1]['user_name']).to eq(u3.user_name)
      expect(json['supervisors'][1]['org_unit_edit_permission']).to eq(true)
      expect(json['supervisors'][0]['org_unit_edit_permission']).to eq(false)
    end
  end
  
  describe "page_data" do
    it "should retrieve all user records for the page of data" do
      u1 = User.create
      u2 = User.create
      u3 = User.create
      o = Organization.create
      u = OrganizationUnit.create(:settings => {'name' => 'Roomy'}, :organization => o)
      o.add_user(u1.global_id, true, false)
      o.add_user(u3.global_id, true, false)
      o.add_supervisor(u2.global_id, true)
      o.add_supervisor(u3.global_id, true)

      u.add_communicator(u1.global_id)
      u.add_supervisor(u2.global_id)
      u.add_supervisor(u3.global_id, true)
      u.add_communicator(u3.global_id)
      
      data = JsonApi::Unit.page_data(OrganizationUnit.all)
      expect(data[:users_hash].keys.sort).to eq([u1.global_id, u2.global_id, u3.global_id].sort)
    end
  end
end
