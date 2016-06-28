require 'spec_helper'

describe JsonApi::Snapshot do
  it "should have defined pagination defaults" do
    expect(JsonApi::Snapshot::TYPE_KEY).to eq('snapshot')
    expect(JsonApi::Snapshot::DEFAULT_PAGE).to eq(50)
    expect(JsonApi::Snapshot::MAX_PAGE).to eq(100)
  end

  describe "build_json" do
    it "should not include unlisted values" do
      s = LogSnapshot.create(:settings => {'name' => 'something', 'bacon' => 'asdf'})
      json = JsonApi::Snapshot.build_json(s)
      expect(json['id']).to eq(s.global_id)
      expect(json['name']).to eq('something')
      expect(json['bacon']).to eq(nil)
    end
    
    it "should include basic information" do
      s = LogSnapshot.create(:settings => {'name' => 'something', 'bacon' => 'asdf', 'location_id' => '1234', 'start' => 'never'})
      json = JsonApi::Snapshot.build_json(s)
      expect(json['id']).to eq(s.global_id)
      expect(json['name']).to eq('something')
      expect(json['bacon']).to eq(nil)
      expect(json['location_id']).to eq('1234')
      expect(json['start']).to eq('never')
    end
    
    it "should include permissions if requested" do
      u = User.create
      s = LogSnapshot.create(:user => u)
      json = JsonApi::Snapshot.as_json(s, {wrapper: true, permissions: u})
      expect(json['snapshot']).to_not eq(nil)
      expect(json['snapshot']['name']).to eq('Unnamed Snapshot')
      expect(json['snapshot']['permissions']).to eq({
        'user_id' => u.global_id,
        'view' => true,
        'edit' => true, 
        'delete' => true
      })
    end
  end
end
