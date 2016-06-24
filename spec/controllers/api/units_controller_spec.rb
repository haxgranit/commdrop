require 'spec_helper'

describe Api::UnitsController, :type => :controller do
  describe "index" do
    it "should require an api token" do
      get :index
      assert_missing_token
    end
    
    it "should require an existing org" do
      token_user
      get :index, :organization_id => 'asdf'
      assert_not_found('asdf')
    end
    
    it "should require authorization" do
      token_user
      o = Organization.create
      get :index, :organization_id => o.global_id
      assert_unauthorized
    end
    
    it "should return a paginated list" do
      token_user
      o = Organization.create
      o.add_manager(@user.global_id)
      ou = OrganizationUnit.create(:organization => o)
      ou2 = OrganizationUnit.create(:organization => o)
      get :index, :organization_id => o.global_id
      expect(response).to be_success
      res = JSON.parse(response.body)
      expect(res['unit']).to_not eq(nil)
      expect(res['unit'].length).to eq(2)
      expect(res['meta']['more']).to eq(false)
    end
  end

  describe "create" do
    it "should require an api token" do
      post :create
      assert_missing_token
    end
    
    it "should require an existing org" do
      token_user
      post :create, :unit => {'organization_id' => 'asdf'}
      assert_not_found('asdf')
    end
    
    it "should require authorization" do
      token_user
      o = Organization.create
      post :create, :unit => {'organization_id' => o.global_id}
      assert_unauthorized
    end
    
    it "should create the unit and return the result" do
      token_user
      o = Organization.create
      o.add_manager(@user.user_name)
      post :create, :unit => {'organization_id' => o.global_id, 'name' => 'Cool Room'}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['unit']['name']).to eq('Cool Room')
    end
  end

  describe "show" do
    it "should require an api token" do
      get :show, :id => 'asdf'
      assert_missing_token
    end
    
    it "should require an existing record" do
      token_user
      get :show, :id => 'asdf'
      assert_not_found('asdf')
    end
    
    it "should require authorization" do
      token_user
      ou = OrganizationUnit.create
      get :show, :id => ou.global_id
      assert_unauthorized
    end
    
    it "should return the result" do
      token_user
      o = Organization.create
      o.add_manager(@user.user_name)
      ou = OrganizationUnit.create(:organization => o)
      get :show, :id => ou.global_id
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['unit']['id']).to eq(ou.global_id)
    end
  end
  
  describe "update" do
    it "should require an api token" do
      put :update, :id => 'asdf'
      assert_missing_token
    end
    
    it "should require an existing record" do
      token_user
      put :update, :id => 'asdf'
      assert_not_found('asdf')
    end
    
    it "should require authorization" do
      token_user
      ou = OrganizationUnit.create
      put :update, :id => ou.global_id
      assert_unauthorized
    end
    
    it "should update the record and return the result" do
      token_user
      o = Organization.create
      o.add_manager(@user.user_name)
      ou = OrganizationUnit.create(:organization => o)
      put :update, :id => ou.global_id, :unit => {'name' => 'Better Room'}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['unit']['id']).to eq(ou.global_id)
      expect(json['unit']['name']).to eq('Better Room')
    end
  end

  describe "destroy" do
    it "should require an api token" do
      delete :destroy, :id => 'asdf'
      assert_missing_token
    end
    
    it "should require an existing record" do
      token_user
      delete :destroy, :id => 'asdf'
      assert_not_found('asdf')
    end
    
    it "should require authorization" do
      token_user
      ou = OrganizationUnit.create
      delete :destroy, :id => ou.global_id
      assert_unauthorized
    end
    
    it "should delete the record and return the result" do
      token_user
      o = Organization.create
      o.add_manager(@user.user_name)
      ou = OrganizationUnit.create(:organization => o)
      delete :destroy, :id => ou.global_id
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['unit']['id']).to eq(ou.global_id)
      expect(OrganizationUnit.find_by_global_id(ou.global_id)).to eq(nil)
    end
  end
end
