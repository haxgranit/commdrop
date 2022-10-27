require 'spec_helper'

describe UserIntegration, :type => :model do
  describe "generate_defaults" do
    it "should create a token" do
      ui = UserIntegration.new(:settings => {})
      expect(ui.settings['token']).to eq(nil)
      ui.generate_defaults
      expect(ui.settings['token']).to_not eq(nil)
    end
    
    it "should set a default scope" do
      ui = UserIntegration.new(:settings => {})
      expect(ui.settings['permission_scopes']).to eq(nil)
      ui.generate_defaults
      expect(ui.settings['permission_scopes']).to eq(['read_profile'])
    end
    
    it "should not overwrite an existing scope" do
      ui = UserIntegration.new(:settings => {})
      ui.settings['permission_scopes'] = ['read_logs']
      ui.generate_defaults
      expect(ui.settings['permission_scopes']).to eq(['read_logs'])
    end
    
    it "should asssert a device" do
      ui = UserIntegration.new(:settings => {})
      ui.generate_defaults
      expect(ui.device).to_not eq(nil)
    end
  end
  
  describe "assert_device" do
    it "should create the device if not present" do
      ui = UserIntegration.new(:settings => {})
      ui.assert_device
      expect(ui.device).to_not eq(nil)
      
      u = User.create
      d = Device.create(:user => u)
      ui = UserIntegration.new(:settings => {})
      ui.device = d
      ui.assert_device
      expect(ui.device).to eq(d)
    end
    
    it "should link the device to the integration once it's saved" do
      u = User.create
      ui = UserIntegration.create
      expect(ui.device).to_not eq(nil)
      d = ui.device
      expect(d.user_integration).to eq(ui)
    end
    
    it "should apply the default scope by default to the device" do
      u = User.create
      ui = UserIntegration.create
      expect(ui.device).to_not eq(nil)
      expect(ui.device.permission_scopes).to eq(['read_profile'])
    end
  end
  
  describe "assert_webhooks" do
    it "should install webhooks" do
      ui = UserIntegration.create
      ui.assert_webhooks
      expect(Worker.scheduled?(UserIntegration, 'perform_action', {'method' => 'assert_webhooks', 'id' => ui.id, 'arguments' => [true]})).to eq(false)
      ui.instance_variable_set('@install_default_webhooks', true)
      ui.assert_webhooks
      expect(Worker.scheduled?(UserIntegration, 'perform_action', {'id' => ui.id, 'method' => 'assert_webhooks', 'arguments' => [true]})).to eq(true)
    end

    it "should install button action wehooks" do
      u = User.create
      ui = UserIntegration.create(:user => u, :settings => {
        'button_webhook_url' => 'http://www.example.com'
      })
      ui.assert_webhooks(true)
      expect(ui.settings['button_webhook_id']).to_not eq(nil)
      wh = Webhook.find_by_path(ui.settings['button_webhook_id'])
      expect(wh).to_not eq(nil)
      expect(wh.record_code).to eq(ui.record_code)
      expect(wh.user_id).to eq(ui.user_id)
      expect(wh.settings['notifications']).to eq({'button_action' => [
        {
          'callback' => 'http://www.example.com',
          'include_content' => true,
          'content_type' => 'button'
        }
      ]})
      ui.settings
    end
    
    it "should not install button action webhook if already installed" do
      u = User.create
      wh = Webhook.create
      ui = UserIntegration.create(:user => u, :settings => {
        'button_webhook_url' => 'http://www.example.com',
        'button_webhook_id' => wh.global_id
      })
      ui.assert_webhooks(true)
      expect(ui.settings['button_webhook_id']).to_not eq(nil)
      wh = Webhook.find_by_path(ui.settings['button_webhook_id'])
      expect(wh).to_not eq(nil)
      expect(wh.record_code).to eq(ui.record_code)
      expect(wh.user_id).to eq(ui.user_id)
      expect(wh.settings['notifications']).to eq({'button_action' => [
        {
          'callback' => 'http://www.example.com',
          'include_content' => true,
          'content_type' => 'button'
        }
      ]})
      ui.settings
    end
    
    it "should do nothing if the webhook was manually deleted" do
      u = User.create
      ui = UserIntegration.create(:user => u, :settings => {
        'button_webhook_url' => 'http://www.example.com',
        'button_webhook_id' => 'abcd'
      })
      ui.assert_webhooks(true)
      expect(ui.settings['button_webhook_id']).to eq('abcd')
      expect(Webhook.count).to eq(0)
    end
  end 
  
  describe "process_params" do
    it "should raise an error if no user set" do
      expect { UserIntegration.process_new({}, {}) }.to raise_error('user required')
    end
    
    it "should set values" do
      u = User.create
      ui = UserIntegration.process_new({
        'name' => 'good integration',
        'custom_integration' => true
      }, {'user' => u})
      expect(ui).to_not eq(nil)
      expect(ui.id).to_not eq(nil)
      expect(ui.settings['name']).to eq('good integration')
      expect(ui.settings['custom_integration']).to eq(true)
      expect(ui.settings['token']).to_not eq(nil)
    end
    
    it "should mark webhooks as needing installed" do
      u = User.create
      ui = UserIntegration.process_new({
        'name' => 'good integration',
        'custom_integration' => true
      }, {'user' => u})
      expect(ui).to_not eq(nil)
      expect(Worker.scheduled?(UserIntegration, 'perform_action', {'id' => ui.id, 'method' => 'assert_webhooks', 'arguments' => [true]})).to eq(true)
    end
    
    it "should regenerate the token if specified" do
      u = User.create
      ui = UserIntegration.process_new({
        'name' => 'good integration',
        'custom_integration' => true
      }, {'user' => u})
      expect(ui).to_not eq(nil)
      expect(ui.id).to_not eq(nil)
      expect(ui.settings['token']).to_not eq(nil)
      token = ui.settings['token']
      ui.process({'regenerate_token' => true})
      expect(ui.settings['token']).to_not eq(nil)
      expect(ui.settings['token']).to_not eq(token)
    end
  end  
  
  describe "destroy_device" do
    it "should disable the device when the integration is destroyed" do
      u = User.create
      ui = UserIntegration.create(:user => u)
      expect(ui.device).to_not eq(nil)
      expect(ui.device['settings']['disabled']).to eq(nil)
      device = ui.device
      ui.destroy
      device.reload
      expect(device.settings['disabled']).to eq(true)
    end
  end 

  describe "placement_code" do
    it "should generate correct values" do
      u = User.create
      ui = UserIntegration.create
      expect { ui.placement_code() }.to raise_error("needs at least one arg")
      expect { ui.placement_code("asdf", 5) }.to raise_error("strings only")
      expect(ui.settings['static_token']).to_not eq(nil)
      expect(ui.placement_code("asdf")).to eq(Security.sha512("asdf,#{ui.settings['static_token']}", 'user integration placement code'))
      expect(ui.placement_code("asdf", 'jkl')).to eq(Security.sha512("asdf,jkl,#{ui.settings['static_token']}", 'user integration placement code'))
      expect(ui.placement_code("asdf", 'bob', 'fred', 'ok')).to eq(Security.sha512("asdf,bob,fred,ok,#{ui.settings['static_token']}", 'user integration placement code'))
    end
  end
  
  describe "delete_webhooks" do
    it "should delete related webhooks on destroy" do
      u = User.create
      ui = UserIntegration.create(:user => u)
      wh1 = Webhook.create(:user_integration => ui)
      wh2 = Webhook.create(:user_integration => ui)
      wh3 = Webhook.create
      expect(wh1.user_integration_id).to eq(ui.id)
      ui.destroy
      expect(Webhook.find_by(:id => wh1.id)).to eq(nil)
      expect(Webhook.find_by(:id => wh2.id)).to eq(nil)
      expect(Webhook.find_by(:id => wh3.id)).to eq(wh3)
    end
  end
end
