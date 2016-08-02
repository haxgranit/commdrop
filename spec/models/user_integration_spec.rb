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
end
