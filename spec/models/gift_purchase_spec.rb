require 'spec_helper'

describe GiftPurchase, :type => :model do
  it "should generate defaults" do
    g = GiftPurchase.new
    g.generate_defaults
    expect(g.active).to eq(true)
    expect(g.settings).to eq({})
  end
  
  it "should generate a unique code on create" do
    expect(Security).to receive(:nonce).with('gift_code').and_return('abcdefg').exactly(6).times
    g = GiftPurchase.create
    expect(g.code).to eq('abcde')
    g2 = GiftPurchase.create
    expect(g2.code).to eq('abcdef')
  end
  
  it "should trigger a notification on create with a giver specified" do
    methods = []
    expect(SubscriptionMailer).to receive(:schedule_delivery){|method, id, action|
      methods << method
      if method == :gift_created
        expect(id).to_not be_nil
        expect(action).to be_nil
      elsif method == :gift_updated
        expect(id).to_not be_nil
        expect(action).to eq('purchase')
      end
    }.exactly(2).times
    g = GiftPurchase.create
    g2 = GiftPurchase.create(:settings => {'giver_email' => 'bob@example.com'})
    expect(methods).to eq([:gift_created, :gift_updated])
  end
  
  describe "duration" do
    it "should return a reasonable message when no duration available" do
      g = GiftPurchase.new
      expect(g.duration).to eq("no time specified")
    end
    
    it "should return a multi-year duration clearly" do
      g = GiftPurchase.new(:settings => {'seconds_to_add' => 5.years.to_i})
      expect(g.duration).to eq('5 years')
    end
    
    it "should return a complex duration clearly" do
      g = GiftPurchase.new(:settings => {'seconds_to_add' => 2.years.to_i + 3.weeks.to_i + 2.days.to_i + 8.hours.to_i + 12.minutes.to_i + 99.seconds.to_i})
      expect(g.duration).to eq('2 years, 23 days, 8 hours, 13 minutes')
    end
  end
  
  it "should return the receiving user" do
    u = User.create
    g = GiftPurchase.new
    expect(g.receiver).to eq(nil)
    
    g.settings = {'receiver_id' => u.global_id}
    expect(g.receiver).to eq(u)
  end
  
  it "should return the giving user" do
    u = User.create
    g = GiftPurchase.new
    expect(g.receiver).to eq(nil)
    
    g.settings = {'giver_id' => u.global_id}
    expect(g.giver).to eq(u)
  end
  
  it "should generate correctly from provided parameters" do
    u = User.create
    g = GiftPurchase.process_new({}, {
      'giver' => u, 
      'email' => 'bob@example.com',
      'customer_id' => '12345',
      'token_summary' => 'no card',
      'plan_id' => 'long_term_150',
      'purchase_id' => '23456',
      'bacon' => '1234'
    })
    expect(g.settings['giver_id']).to eq(u.global_id)
    expect(g.settings['giver_email']).to eq('bob@example.com')
    expect(g.settings['customer_id']).to eq('12345')
    expect(g.settings['token_summary']).to eq('no card')
    expect(g.settings['plan_id']).to eq('long_term_150')
    expect(g.settings['purchase_id']).to eq('23456')
    expect(g.settings['bacon']).to eq(nil)
    
    g = GiftPurchase.process_new({
      'email' => 'fred@example.com'
    }, {
      'token_summary' => 'no card',
      'plan_id' => 'long_term_150',
      'purchase_id' => '23456',
      'bacon' => '1234'
    })
    expect(g.settings['giver_id']).to eq(nil)
    expect(g.settings['giver_email']).to eq('fred@example.com')
    expect(g.settings['customer_id']).to eq(nil)
    expect(g.settings['token_summary']).to eq('no card')
    expect(g.settings['plan_id']).to eq('long_term_150')
    expect(g.settings['purchase_id']).to eq('23456')
    expect(g.settings['bacon']).to eq(nil)
  end
end
