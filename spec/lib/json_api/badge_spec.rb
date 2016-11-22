require 'spec_helper'

describe JsonApi::Badge do
  it "should have defined pagination defaults" do
    expect(JsonApi::Badge::TYPE_KEY).to eq('badge')
    expect(JsonApi::Badge::DEFAULT_PAGE).to eq(10)
    expect(JsonApi::Badge::MAX_PAGE).to eq(25)
  end

  describe "build_json" do
    it "should not include unlisted settings" do
      u = User.create
      b = UserBadge.create(:user => u)
      b.data['hat'] = 'black'
      expect(JsonApi::Badge.build_json(b).keys).not_to be_include('hat')
    end
    
    it "should return appropriate attributes" do
      u = User.create
      b = UserBadge.create(:user => u)
      ['id', 'name', 'highlighted', 'image_url', 'level', 'max_level', 'goal_id', 'global'].each do |key|
        expect(JsonApi::Badge.build_json(b).keys).to be_include(key)
      end
    end
    
    it "should include correct progress data" do
      u = User.create
      b = UserBadge.create(:user => u)
      json = JsonApi::Badge.build_json(b)
      expect(json['progress']).to eq(0.0)
      b.earned = true
      json = JsonApi::Badge.build_json(b)
      expect(json['earned']).to_not eq(nil)
      expect(json['progress']).to eq(1.0)
    end
    
    it "should include permissions and stars if permissions are requested" do
      u = User.create
      b = UserBadge.create(:user => u)
      expect(JsonApi::Badge.build_json(b, :permissions => u)['permissions']).to eq({'user_id' => u.global_id, 'view' => true, 'edit' => true, 'delete' => true})
    end
  end
end
