require 'spec_helper'

describe Api::GiftsController, :type => :controller do
  describe "show" do
    it "should not require an access token" do
      get :show, :id => 'asdf'
      expect(response.success?).not_to eq(true)
      json = JSON.parse(response.body)
      expect(response.code).to eq("404")
      expect(json['error']).to eq("Record not found")
    end
    
    it "should error gracefully on a missing gift" do
      get :show, :id => 'asdf'
      expect(response.success?).not_to eq(true)
      json = JSON.parse(response.body)
      expect(response.code).to eq("404")
      expect(json['error']).to eq("Record not found")
    end
    
    it "should not return an already-redeemed gift" do
      g = GiftPurchase.create
      g.active = false
      g.save
      
      get :show, :id => g.code
      expect(response.success?).not_to eq(true)
      json = JSON.parse(response.body)
      expect(response.code).to eq("404")
      expect(json['error']).to eq("Record not found")
    end
    
    it "should return a gift record" do
      token_user
      g = GiftPurchase.create
      get :show, :id => g.code
      expect(response.success?).to eq(true)
      json = JSON.parse(response.body)
      expect(response.code).to eq("200")
      expect(json['gift']['id']).to eq(g.code)
    end
    
    it "should be forgiving on capitalization and o's for 0's" do
      token_user
      g = GiftPurchase.new
      g.code = 'abcd000'
      g.save
      get :show, :id => 'ABcD0Oo'
      expect(response.success?).to eq(true)
      json = JSON.parse(response.body)
      expect(response.code).to eq("200")
      expect(json['gift']['id']).to eq(g.code)
    end
  end
end
