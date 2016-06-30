require 'spec_helper'

describe JsonApi::Goal do
  it "should have defined pagination defaults" do
    expect(JsonApi::Goal::TYPE_KEY).to eq('goal')
    expect(JsonApi::Goal::DEFAULT_PAGE).to eq(25)
    expect(JsonApi::Goal::MAX_PAGE).to eq(50)
  end

  describe "build_json" do
    it "should not included unlisted settings" do
      s = UserGoal.new(settings: {'hat' => 'black'})
      expect(JsonApi::Goal.build_json(s).keys).not_to be_include('hat')
    end
    
    it "should include appropriate values" do
      s = UserGoal.new(settings: {})
      ['id', 'has_video', 'active', 'summary', 'description', 'started'].each do |key|
        expect(JsonApi::Goal.build_json(s).keys).to be_include(key)
      end
    end
    
    it "should include permissions" do
      u = User.create
      i = UserGoal.new(:user => u, settings: {})
      json = JsonApi::Goal.build_json(i, :permissions => u)
      expect(json['permissions']['view']).to eq(true)
    end
    
    it "should include video information" do
      u = User.new
      v = UserVideo.create(:url => "http://www.example.com/video.mp4")
      g = UserGoal.new(:user => u, :settings => {
        'video_id' => v.global_id
      })
      json = JsonApi::Goal.build_json(g, :permissions => u)
      expect(json['video']).to eq(v.summary_hash)
    end
    
    it "should include user comments" do
      u = User.create
      u2 = User.create
      v = UserVideo.create(:url => "http://www.example.com/video.mp4")
      g = UserGoal.new(:user => u, :settings => {
        'comments' => [
          {'user_id' => u.global_id, 'text' => 'something cool'},
          {'user_id' => u2.global_id, 'text' => 'no way'}
        ]
      })
      json = JsonApi::Goal.build_json(g, :permissions => u)
      expect(json['comments']).to_not eq(nil)
      expect(json['comments'].length).to eq(2)
      expect(json['comments'][0]['text']).to eq('something cool')
      expect(json['comments'][0]['user']['id']).to eq(u.global_id)
      expect(json['comments'][0]['user']['user_name']).to eq(u.user_name)
      expect(json['comments'][1]['text']).to eq('no way')
      expect(json['comments'][1]['user']['id']).to eq(u2.global_id)
      expect(json['comments'][1]['user']['user_name']).to eq(u2.user_name)
    end
    
    it "should include video information on user comments" do
      u = User.create
      u2 = User.create
      v = UserVideo.create(:url => "http://www.example.com/video.mp4")
      v2 = UserVideo.create(:url => "http://www.example.com/video2.mp4")
      g = UserGoal.new(:user => u, :settings => {
        'video_id' => v.global_id,
        'comments' => [
          {'user_id' => u.global_id, 'text' => 'something cool', 'video_id' => v.global_id},
          {'user_id' => u.global_id, 'text' => 'never mind'},
          {'user_id' => u2.global_id, 'text' => 'no way', 'video_id' => v2.global_id}
        ]
      })
      json = JsonApi::Goal.build_json(g, :permissions => u)
      expect(json['comments']).to_not eq(nil)
      expect(json['comments'].length).to eq(3)
      expect(json['comments'][0]['text']).to eq('something cool')
      expect(json['comments'][0]['user']['id']).to eq(u.global_id)
      expect(json['comments'][0]['user']['user_name']).to eq(u.user_name)
      expect(json['comments'][0]['video']).to eq(v.summary_hash)
      expect(json['comments'][1]['text']).to eq('never mind')
      expect(json['comments'][1]['user']['id']).to eq(u.global_id)
      expect(json['comments'][1]['user']['user_name']).to eq(u.user_name)
      expect(json['comments'][1]['video']).to eq(nil)
      expect(json['comments'][2]['text']).to eq('no way')
      expect(json['comments'][2]['user']['id']).to eq(u2.global_id)
      expect(json['comments'][2]['user']['user_name']).to eq(u2.user_name)
      expect(json['comments'][2]['video']).to eq(v2.summary_hash)
    end
    
    it "should round the values for stats" do
      g = UserGoal.new(settings: {
        'stats' => {
          'a' => 1,
          'b' => 1.2345678,
          'c' => 9.87654321,
          'd' => 'bacon'
        }
      })
      json = JsonApi::Goal.build_json(g)
      expect(json['stats']['a']).to eq(1.0)
      expect(json['stats']['b']).to eq(1.23)
      expect(json['stats']['c']).to eq(9.88)
      expect(json['stats']['d']).to eq('bacon')
    end
  end
end
