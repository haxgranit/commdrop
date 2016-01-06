require 'spec_helper'

describe ButtonSound, :type => :model do
  describe "paper trail" do
    it "should make sure paper trail is doing its thing"
  end
  
  describe "permissions" do
    it "should have some permissions set" do
      i = ButtonImage.new
      expect(i.permissions_for(nil)).to eq({'user_id' => nil, 'view' => true})
      u = User.create
      i.user = u
      expect(i.permissions_for(u)).to eq({'user_id' => u.global_id, 'view' => true, 'edit' => true})
      u2 = User.create
      User.link_supervisor_to_user(u2, u)
      i.user.reload
      expect(i.permissions_for(u2.reload)).to eq({'user_id' => u2.global_id, 'view' => true, 'edit' => true})
    end
  end
  
  describe "generate_defaults" do
    it "should generate default values" do
      i = ButtonSound.new
      i.generate_defaults
      expect(i.settings['license']).to eq({'type' => 'private'})
      expect(i.public).to eq(false)
    end
    
    it "should not override existing values" do
      i = ButtonSound.new(public: true, settings: {'license' => {'type' => 'nunya'}})
      i.generate_defaults
      expect(i.settings['license']).to eq({'type' => 'nunya'})
      expect(i.public).to eq(true)
    end
  end

  describe "process_params" do
    it "should ignore unspecified parameters" do
      i = ButtonSound.new(:user_id => 1)
      expect(i.process_params({}, {})).to eq(true)
    end
    
    it "should raise if no user set" do
      i = ButtonSound.new
      expect { i.process_params({}, {}) }.to raise_error("user required as sound author")
    end
    
    it "should set parameters" do
      u = User.new
      i = ButtonSound.new(:user_id => 1)
      expect(i.process_params({
        'content_type' => 'audio/mp3',
        'suggestion' => 'hat',
        'public' => true
      }, {
        :user => u
      })).to eq(true)
      expect(i.settings['content_type']).to eq('audio/mp3')
      expect(i.settings['license']).to eq(nil)
      expect(i.settings['suggestion']).to eq('hat')
      expect(i.settings['search_term']).to eq(nil)
      expect(i.settings['external_id']).to eq(nil)
      expect(i.public).to eq(true)
      expect(i.user).to eq(u)
    end
    
    it "should process the URL including non_user_params if sent" do
      u = User.new
      i = ButtonSound.new(:user_id => 1)
      expect(i.process_params({
        'url' => 'http://www.example.com'
      }, {})).to eq(true)
      expect(i.settings['url']).to eq(nil)
      expect(i.settings['pending_url']).to eq('http://www.example.com')
    end
  end
    
  it "should securely serialize settings" do
    b = ButtonSound.new(:settings => {:a => 1})
    expect(b.settings).to eq({:a => 1})
    b.generate_defaults
    expect(SecureJson).to receive(:dump).with(b.settings).exactly(1).times
    b.save
  end
  
  it "should remove from remote storage if no longer in use" do
    u = User.create
    i = ButtonSound.create(:user => u)
    i.removable = true
    i.url = "asdf"
    i.settings['full_filename'] = "asdf"
    expect(Uploader).to receive(:remote_remove).with("asdf")
    i.destroy
    Worker.process_queues
  end
end
