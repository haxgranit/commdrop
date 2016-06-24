require 'spec_helper'

describe JsonApi::Json do
  describe "as_json" do
    it "should call build_json" do
      obj = {}
      args = {}
      expect(JsonApi::Board).to receive(:build_json).with(obj, args).and_return({'a' => 1})
      expect(JsonApi::Board.as_json(obj, args)).to eq({'a' => 1})
    end
    it "should wrap in a wrapper if specified" do
      obj = {}
      args = {:wrapper => true}
      expect(JsonApi::User).to receive(:build_json).with(obj, args).and_return({'a' => 1})
      hash = {}
      hash[JsonApi::User::TYPE_KEY] = {'a' => 1}
      expect(JsonApi::User.as_json(obj, args)).to eq(hash)
    end
    it "should call extra_includes if available and wrapper is specified" do
      obj = {}
      args = {:wrapper => true}
      json = {'b' => 2}
      expect(JsonApi::Board).to receive(:build_json).with(obj, args).and_return(json)
      expect(JsonApi::Board).to receive(:extra_includes).with(obj, {'board' => json}, {:permissions => nil}).and_return({'board' => json})
      expect(JsonApi::Board.as_json(obj, args)).to eq({'board' => json})
    end
    it "should call meta if available and wrapper is specified" do
      obj = {}
      args = {:wrapper => true}
      json = {'b' => 2}
      expect(JsonApi::Image).to receive(:build_json).with(obj, args).and_return(json)
      expect(JsonApi::Image).to receive(:meta).with(obj).and_return({'ok' => false})
      expect(JsonApi::Image.as_json(obj, args)).to eq({'image' => {'b' => 2}, 'meta' => {'ok' => false}})
    end
  end
  
  describe "paginate" do
    before(:each) do
      u = User.create
      d = Device.create(:user => u)
      30.times do |i|
        LogSession.create(:user => u, :author => u, :device => d)
      end
    end
    it "should return a subset of the total results" do
      res = JsonApi::Log.paginate({'per_page' => 4}, LogSession.all)
      expect(res['log']).not_to eq(nil)
      expect(res['log'].length).to eq(4)
    end
    
    it "should return a next_url if there are more results" do
      res = JsonApi::Log.paginate({'per_page' => 6, 'offset' => 2}, LogSession.all)
      expect(res[:meta]).not_to be_nil
      expect(res[:meta][:next_url]).to eq("#{JsonApi::Json.current_host}/api/v1/logs?offset=8&per_page=6")

      res = JsonApi::Log.paginate({'offset' => 2}, LogSession.all)
      expect(res[:meta]).not_to be_nil
      expect(res[:meta][:next_url]).to eq("#{JsonApi::Json.current_host}/api/v1/logs?offset=#{JsonApi::Log::DEFAULT_PAGE + 2}&per_page=#{JsonApi::Log::DEFAULT_PAGE}")
    end
    
    it "should call as_json for each of the results" do
      expect(JsonApi::Log).to receive(:as_json).and_return({})
      res = JsonApi::Log.paginate({}, LogSession.where(:id => LogSession.last.id))
    end
    
    it "should work without any parameters" do
      res = JsonApi::Log.paginate({}, LogSession.all)
      expect(res['log']).not_to eq(nil)
      expect(res['log'].length).to eq(10)
    end
    
    it "should cap per_page at MAX_PAGE setting" do
      res = JsonApi::Log.paginate({'per_page' => 100}, LogSession.all)
      expect(res[:meta]).not_to be_nil
      expect(res[:meta][:next_url]).to eq("#{JsonApi::Json.current_host}/api/v1/logs?offset=#{JsonApi::Log::MAX_PAGE}&per_page=#{JsonApi::Log::MAX_PAGE}")
    end
    
    it "should call page_data if defined" do
      expect(JsonApi::Unit).to receive(:page_data).and_return({:a => 1})
      ou = OrganizationUnit.create
      expect(JsonApi::Unit).to receive(:build_json){|unit, args|
        expect(unit).to eq(ou)
        expect(args[:page_data]).to eq({:a => 1})
      }.and_return({})
      res = JsonApi::Unit.paginate({}, OrganizationUnit.all)
    end
  end
  
  describe "next_url prefix" do
    before(:each) do
      u = User.create
      d = Device.create(:user => u)
      30.times do |i|
        LogSession.create(:user => u, :author => u, :device => d)
      end
    end

    it "should use the specified prefix if defined" do
      res = JsonApi::Log.paginate({}, LogSession.all, :prefix => 'https://www.google.com/api/v1/bacon')
      expect(res[:meta]).not_to be_nil
      expect(res[:meta][:next_url]).to eq("https://www.google.com/api/v1/bacon?offset=#{JsonApi::Log::DEFAULT_PAGE}&per_page=#{JsonApi::Log::DEFAULT_PAGE}")
    end
    
    it "should prepent the host to the specified prefix if defined" do
      res = JsonApi::Log.paginate({}, LogSession.all, :prefix => '/bacon')
      expect(res[:meta]).not_to be_nil
      expect(res[:meta][:next_url]).to eq("#{JsonApi::Json.current_host}/api/v1/bacon?offset=#{JsonApi::Log::DEFAULT_PAGE}&per_page=#{JsonApi::Log::DEFAULT_PAGE}")
    end
  end

  describe "set_host" do
    it "should set a unique host for each pid" do
      JsonApi::Json.class_variable_set(:@@running_hosts, {})
      expect(Worker).to receive(:thread_id).and_return('12345_123')
      JsonApi::Json.set_host('bob')
      expect(Worker).to receive(:thread_id).and_return('123456_456')
      JsonApi::Json.set_host('fred')
      hosts = JsonApi::Json.class_variable_get(:@@running_hosts)
      expect(hosts).to eq({
        '12345_123' => 'bob', 
        '123456_456' => 'fred'
      })
    end
  end
  
  describe "current_host" do
    it "should return found hosts, or the default if none found" do
      JsonApi::Json.class_variable_set(:@@running_hosts, {
        '12345_123' => 'bob', 
        '123456_234' => 'fred'
      })
      expect(Worker).to receive(:thread_id).and_return('12345_123')
      expect(JsonApi::Json.current_host).to eq('bob')
      expect(Worker).to receive(:thread_id).and_return('123456_234')
      expect(JsonApi::Json.current_host).to eq('fred')
      expect(Worker).to receive(:thread_id).and_return('12345')
      expect(JsonApi::Json.current_host).to eq(ENV['DEFAULT_HOST'])
    end
  end
end
