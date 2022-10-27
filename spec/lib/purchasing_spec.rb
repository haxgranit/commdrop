require 'spec_helper'
require 'ostruct'
require 'stringio'

describe Purchasing do
  def stripe_event_request(type, object, previous=nil)
    req = OpenStruct.new
    id = 'obj_' + rand(9999).to_s
    req.body = StringIO.new({'id' => id}.to_json)
    expect(Stripe::Event).to receive(:retrieve).with(id).and_return({
      'type' => type,
      'data' => {
        'object' => object,
        'previous_attributes' => previous
      }
    })
    res = Purchasing.subscription_event(req)
    expect(res[:status]).to eq(200)
    Worker.process_queues
    res
  end
  
  describe "subscription_event" do
    it "should error if event not found" do
      req = OpenStruct.new
      req.body = StringIO.new('')
      res = Purchasing.subscription_event(req)
      expect(res[:status]).to eq(400)
      expect(res[:data]).to eq({:error => "invalid parameters", :event_id => nil})

      req = OpenStruct.new
      req.body = StringIO.new({'id' => 'asdf'}.to_json)
      expect(Stripe::Event).to receive(:retrieve).with('asdf').and_return(nil)
      res = Purchasing.subscription_event(req)
      expect(res[:status]).to eq(200)
      expect(res[:data]).to eq({:error => "invalid parameters", :event_id => 'asdf'})
      
      expect(Stripe::Event).to receive(:retrieve).with('asdf') { raise "no" }
      req.body.rewind
      res = Purchasing.subscription_event(req)
      expect(res[:status]).to eq(200)
      expect(res[:data]).to eq({:error => "invalid parameters", :event_id => 'asdf'})
    end
    
    it "should succeed if something is found" do
      req = OpenStruct.new
      req.body = StringIO.new({'id' => 'asdf'}.to_json)
      expect(Stripe::Event).to receive(:retrieve).with('asdf').and_return({'type' => 'bacon'})
      res = Purchasing.subscription_event(req)
      expect(res[:status]).to eq(200)
      expect(res[:data]).to eq({:valid => false, :type => 'bacon', :event_id => 'asdf'})
    end
    
    it "should update a user when their metadata changed" do
      u1 = User.create
      u2 = User.create
      u1.settings['subscription'] = {'customer_id' => 'abacus'}
      o = OpenStruct.new(:metadata => {'user_id' => u2.global_id})
      expect(Stripe::Customer).to receive(:retrieve).with('abacus').and_return(o)
      expect(User).to receive(:find_by_global_id).with(u1.global_id).and_return(u1)
      expect(User).to receive(:find_by_global_id).with(u2.global_id).and_return(u2)
      expect(u1).to receive(:transfer_subscription_to).with(u2, true)
      stripe_event_request('customer.updated', {
        'id' => 'abacus',
        'metadata' => {
          'user_id' => u2.global_id
        }
      }, {
        'metadata' => {
          'user_id' => u1.global_id
        }
      })
    end
    
    it "should not update a user when their metadata change has already been updated" do
      u1 = User.create
      u2 = User.create
      o = OpenStruct.new(:metadata => {'user_id' => u2.global_id})
      expect(Stripe::Customer).to receive(:retrieve).with('abacus').and_return(o)
      expect(User).to receive(:find_by_global_id).with(u1.global_id).and_return(u1)
      expect(User).to receive(:find_by_global_id).with(u2.global_id).and_return(u2)
      expect(u1).to_not receive(:transfer_subscription_to)
      stripe_event_request('customer.updated', {
        'id' => 'abacus',
        'metadata' => {
          'user_id' => u2.global_id
        }
      }, {
        'metadata' => {
          'user_id' => u1.global_id
        }
      })
    end
            
    describe "charge.succeeded" do
      it "should trigger a purchase event" do
        u = User.create
        exp = u.expires_at
        expect(SubscriptionMailer).to receive(:schedule_delivery).with(:purchase_confirmed, u.global_id)
        expect(SubscriptionMailer).to receive(:schedule_delivery).with(:new_subscription, u.global_id)
        
        res = stripe_event_request 'charge.succeeded', {
          'id' => '12345',
          'customer' => '23456',
          'metadata' => {
            'user_id' => u.global_id,
            'plan_id' => 'long_term_100'
          }
        }
        u.reload
        expect(u.settings['subscription']['last_purchase_plan_id']).to eq('long_term_100')
        expect(u.settings['subscription']['customer_id']).to eq('23456')
        expect(u.settings['subscription']['last_purchase_id']).to eq('12345')
        expect(u.settings['subscription']['prior_purchase_ids']).to eq([])
        expect(u.expires_at).to eq(exp + 5.years.to_i)
        expect(res[:data]).to eq({:purchase => true, :purchase_id => '12345', :valid => true})
      end
    end
    
    describe "charge.failed" do
      it "should trigger a purchase_failed event" do
        u = User.create
        expect(Stripe::Customer).to receive(:retrieve).with('qwer').and_return({
          'metadata' => {
            'user_id' => u.global_id
          }
        })
        expect(SubscriptionMailer).to receive(:schedule_delivery).with(:purchase_bounced, u.global_id)
        res = stripe_event_request 'charge.failed', {
          'customer' => 'qwer'
        }
        expect(res[:data]).to eq({:notified => true, :purchase => false, :valid => true})
      end
    end
    
    describe "charge.dispute.created" do
      it "should trigger a chargeback_created event" do
        u = User.create
        expect(SubscriptionMailer).to receive(:schedule_delivery).with(:chargeback_created, u.global_id)
        expect(Stripe::Charge).to receive(:retrieve).with('zxcv').and_return({
          'metadata' => {
            'user_id' => u.global_id
          }
        })
        res = stripe_event_request 'charge.dispute.created', {
          'id' => 'zxcv'
        }
        expect(res[:data]).to eq({:notified => true, :dispute => true, :valid => true})
      end
    end
    
    describe "customer.subscription.created" do
      it "should trigger a subscribe event" do
        u = User.create
        expect(Stripe::Customer).to receive(:retrieve).with('tyuio').and_return({
          'metadata' => {
            'user_id' => u.global_id
          }
        })
        expect(SubscriptionMailer).to receive(:schedule_delivery).with(:purchase_confirmed, u.global_id)
        expect(SubscriptionMailer).to receive(:schedule_delivery).with(:new_subscription, u.global_id)
        expect(Purchasing).to receive(:cancel_other_subscriptions).with(u, '12345')
        res = stripe_event_request 'customer.subscription.created', {
          'customer' => 'tyuio',
          'id' => '12345',
          'plan' => {
            'id' => 'monthly_6'
          }
        }
        u.reload
        expect(u.settings['subscription']).not_to eq(nil)
        expect(u.settings['subscription']['started']).not_to eq(nil)
        expect(u.settings['subscription']['customer_id']).to eq('tyuio')
        expect(u.settings['subscription']['subscription_id']).to eq('12345')
        expect(u.settings['subscription']['plan_id']).to eq('monthly_6')
        expect(u.expires_at).to eq(nil)
        expect(res[:data]).to eq({:subscribe => true, :valid => true})
      end
    end
    
    describe "customer.subscription.updated" do
      it "should trigger an unsubscribe event if it was status changed to unpaid or canceled" do
        u = User.create
        u.settings['subscription'] = {'customer_id' => '12345', 'subscription_id' => '23456'}
        u.save
        expect(Stripe::Customer).to receive(:retrieve).with('12345').and_return({
          'metadata' => {
            'user_id' => u.global_id
          }
        })
        expect(SubscriptionMailer).to receive(:schedule_delivery).with(:subscription_expiring, u.global_id)
        res = stripe_event_request 'customer.subscription.updated', {
          'status' => 'unpaid',
          'customer' => '12345',
          'id' => '23456'
        }, {
          'status' => 'active'
        }
        
        u.reload
        expect(u.settings['subscription']['started']).to eq(nil)
        expect(u.settings['subscription']['subscription_id']).to eq(nil)
        expect(u.expires_at).to be > Time.now
        expect(res[:data]).to eq({:unsubscribe => true, :valid => true})
      end
      
      it "should trigger a subscribe event if the status is active" do
        u = User.create
        expect(Stripe::Customer).to receive(:retrieve).with('tyuio').and_return({
          'metadata' => {
            'user_id' => u.global_id
          }
        })
        expect(SubscriptionMailer).to receive(:schedule_delivery).with(:purchase_confirmed, u.global_id)
        expect(SubscriptionMailer).to receive(:schedule_delivery).with(:new_subscription, u.global_id)
        expect(Purchasing).to receive(:cancel_other_subscriptions).with(u, '12345')
        res = stripe_event_request 'customer.subscription.updated', {
          'customer' => 'tyuio',
          'status' => 'active',
          'id' => '12345',
          'plan' => {
            'id' => 'monthly_6'
          }
        }
        u.reload
        expect(u.settings['subscription']).not_to eq(nil)
        expect(u.settings['subscription']['started']).not_to eq(nil)
        expect(u.settings['subscription']['customer_id']).to eq('tyuio')
        expect(u.settings['subscription']['subscription_id']).to eq('12345')
        expect(u.settings['subscription']['plan_id']).to eq('monthly_6')
        expect(u.expires_at).to eq(nil)
        expect(res[:data]).to eq({:subscribe => true, :valid => true})
      end
    end
    
    describe "customer.subscription.deleted" do
      it "should trigger an unsubscribe event" do
        u = User.create
        u.settings['subscription'] = {'customer_id' => '12345', 'subscription_id' => '23456'}
        u.save
        expect(Stripe::Customer).to receive(:retrieve).with('12345').and_return({
          'metadata' => {
            'user_id' => u.global_id
          }
        })
        expect(SubscriptionMailer).to receive(:schedule_delivery).with(:subscription_expiring, u.global_id)
        res = stripe_event_request 'customer.subscription.deleted', {
          'customer' => '12345',
          'id' => '23456'
        }
        
        u.reload
        expect(u.settings['subscription']['started']).to eq(nil)
        expect(u.settings['subscription']['subscription_id']).to eq(nil)
        expect(u.expires_at).to be > Time.now
        expect(res[:data]).to eq({:unsubscribe => true, :valid => true})
      end
    end
    
    describe "ping" do
      it "should respond" do
        res = stripe_event_request 'ping', {}
        
        expect(res[:data]).to eq({:ping => true, :valid => true})
      end
    end
    
  end

  describe "purchase" do
    it "should trigger subscription event on free purchases" do
      u = User.create
      res = Purchasing.purchase(u, {'id' => 'free'}, 'slp_monthly_free');
      u.reload
      expect(u.settings['subscription']).not_to eq(nil)
      expect(u.settings['subscription']['started']).not_to eq(nil)
      expect(res).to eq({:success => true, :type => 'slp_monthly_free'})
      expect(u.reload.settings['subscription']['plan_id']).to eq('slp_monthly_free')
      expect(u.reload.settings['subscription']['free_premium']).to eq(true)
    end
    
    it "should error gracefully on invalid purchase amounts" do
      u = User.create
      
      res = Purchasing.purchase(u, {'id' => 'token'}, 'monthly_12')
      expect(res).to eq({:success => false, :error => "12 not valid for type monthly_12"});

      res = Purchasing.purchase(u, {'id' => 'token'}, 'monthly_2')
      expect(res).to eq({:success => false, :error => "2 not valid for type monthly_2"});

      res = Purchasing.purchase(u, {'id' => 'token'}, 'slp_long_term_25')
      expect(res).to eq({:success => false, :error => "25 not valid for type slp_long_term_25"});

      res = Purchasing.purchase(u, {'id' => 'token'}, 'slp_long_term_200')
      expect(res).to eq({:success => false, :error => "200 not valid for type slp_long_term_200"});

      res = Purchasing.purchase(u, {'id' => 'token'}, 'slp_monthly_1')
      expect(res).to eq({:success => false, :error => "1 not valid for type slp_monthly_1"});

      res = Purchasing.purchase(u, {'id' => 'token'}, 'slp_monthly_6')
      expect(res).to eq({:success => false, :error => "6 not valid for type slp_monthly_6"});

      res = Purchasing.purchase(u, {'id' => 'token'}, 'long_term_75')
      expect(res).to eq({:success => false, :error => "75 not valid for type long_term_75"});

      res = Purchasing.purchase(u, {'id' => 'token'}, 'long_term_350')
      expect(res).to eq({:success => false, :error => "350 not valid for type long_term_350"});
    end
    
    it "should error gracefully on invalid purchase types" do
      u = User.create
      
      res = Purchasing.purchase(u, {'id' => 'token'}, 'bacon')
      expect(res).to eq({:success => false, :error => "unrecognized purchase type, bacon"});
    end
    
    it "should error gracefully on raised errors" do
      u = User.create
      
      expect(Stripe::Charge).to receive(:create) { raise "no" }
      res = Purchasing.purchase(u, {'id' => 'token'}, 'long_term_150')
      expect(res[:success]).to eq(false)
      expect(res[:error]).to eq('unexpected_error')
      expect(res[:error_message]).to eq('no')
    end
    
    it "should return status" do
      res = Purchasing.purchase(nil, 'token', 'bacon')
      expect(res.is_a?(Hash)).to eq(true)
      expect(res[:success]).not_to eq(nil)
    end

    describe "subscription" do
      it "should retrieve the existing customer record if there is one" do
        u = User.create
        u.settings['subscription'] = {'customer_id' => '12345'}
        subs = []
        expect(Stripe::Customer).to receive(:retrieve).with('12345').and_return(OpenStruct.new({
          subscriptions: subs
        }))
        expect(subs).to receive(:create).with({
          :plan => 'monthly_6',
          :source => 'token'
        }).and_return({
          'id' => '3456',
          'customer' => '12345'
        })
        expect(Purchasing).to receive(:cancel_other_subscriptions).with(u, '3456')
        Purchasing.purchase(u, {'id' => 'token'}, 'monthly_6')
      end
      
      it "should cancel other subscriptions for an existing customer record" do
        u = User.create
        u.settings['subscription'] = {'customer_id' => '12345'}
        subs = OpenStruct.new({
          data: [OpenStruct.new({
            'id' => '3456',
            'status' => 'canceled'
          })],
          count: 1
        })
        expect(Stripe::Customer).to receive(:retrieve).with('12345').and_return(OpenStruct.new({
          subscriptions: subs
        }))
        expect(subs).to receive(:create).with({
          :plan => 'monthly_6',
          :source => 'token'
        }).and_return({
          'id' => '3457',
          'customer' => '12345'
        })
        expect(Purchasing).to receive(:cancel_other_subscriptions).with(u, '3457')
        Purchasing.purchase(u, {'id' => 'token'}, 'monthly_6')
      end
      
      it "should trigger a subscription event for an existing customer record" do
        u = User.create
        u.settings['subscription'] = {'customer_id' => '12345'}
        subs = []
        expect(Stripe::Customer).to receive(:retrieve).with('12345').and_return(OpenStruct.new({
          subscriptions: subs
        }))
        expect(subs).to receive(:create).with({
          :plan => 'monthly_6',
          :source => 'token'
        }).and_return({
          'id' => '3456',
          'customer' => '12345'
        })
        expect(User).to receive(:subscription_event).with({
          'subscribe' => true,
          'user_id' => u.global_id,
          'subscription_id' => '3456',
          'customer_id' => '12345',
          'token_summary' => 'Unknown Card',
          'plan_id' => 'monthly_6',
          'source' => 'new subscription',
          'cancel_others_on_update' => true
        })
        Purchasing.purchase(u, {'id' => 'token'}, 'monthly_6')
      end

      it "should create a customer if one doesn't exist" do
        u = User.create
        subs = []
        expect(Stripe::Customer).to receive(:create).with({
          :metadata => {'user_id' => u.global_id},
          :plan => 'monthly_6',
          :email => nil,
          :source => 'token'
        }).and_return(OpenStruct.new({
          subscriptions: {
            'data' => [
              {'status' => 'broken', 'id' => 'sub1'},
              {'status' => 'active', 'id' => 'sub2'}
            ]
          }
        }))
        Purchasing.purchase(u, {'id' => 'token'}, 'monthly_6')
      end

      it "should trigger a subscription event for a new customer" do
        u = User.create
        subs = []
        expect(Stripe::Customer).to receive(:create).with({
          :metadata => {'user_id' => u.global_id},
          :plan => 'monthly_6',
          :email => nil,
          :source => 'token'
        }).and_return(OpenStruct.new({
          id: '9876',
          subscriptions: {
            'data' => [
              {'status' => 'canceled', 'id' => 'sub1'},
              {'status' => 'active', 'id' => 'sub2'}
            ]
          }
        }))
        expect(User).to receive(:subscription_event).with({
          'user_id' => u.global_id,
          'subscribe' => true,
          'subscription_id' => 'sub2',
          'customer_id' => '9876',
          'token_summary' => 'Unknown Card',
          'plan_id' => 'monthly_6',
          'source' => 'new subscription',
          'cancel_others_on_update' => true
        })
        Purchasing.purchase(u, {'id' => 'token'}, 'monthly_6')
      end
      
      it "should update subscription information if an existing subscription record is updated and the plan changes" do
        u = User.create
        u.settings['subscription'] = {'customer_id' => '12345'}
        sub1 = OpenStruct.new({
          'id' => '3456',
          'status' => 'active'
        })
        subs = [sub1]
        expect(Stripe::Customer).to receive(:retrieve).with('12345').and_return(OpenStruct.new({
          subscriptions: OpenStruct.new({
            data: subs,
            count: 1
          })
        }))
        expect(sub1).to receive(:save).and_return(true)
        
        expect(Purchasing).to receive(:cancel_other_subscriptions).with(u, '3456')
        Purchasing.purchase(u, {'id' => 'token'}, 'monthly_6')
        expect(sub1.prorate).to eq(true)
        expect(sub1.plan).to eq('monthly_6')
        expect(sub1.source).to eq('token')
      end
    end

    describe "long-term purchase" do
      it "should create a charge record" do
        u = User.create
        expect(Stripe::Charge).to receive(:create).with({
          :amount => 15000,
          :currency => 'usd',
          :source => 'token',
          :description => 'communicator long-term purchase $150',
          :receipt_email => nil,
          :metadata => {
            'user_id' => u.global_id,
            'plan_id' => 'long_term_150'
          }
        }).and_return({
          'id' => '23456',
          'customer' => '45678'
        })
        expect(User).to receive(:subscription_event)
        Purchasing.purchase(u, {'id' => 'token'}, 'long_term_150')
      end
      
      it "should trigger a purchase event" do
        u = User.create
        expect(Stripe::Charge).to receive(:create).with({
          :amount => 15000,
          :currency => 'usd',
          :source => 'token',
          :description => 'communicator long-term purchase $150',
          :receipt_email => nil,
          :metadata => {
            'user_id' => u.global_id,
            'plan_id' => 'long_term_150'
          }
        }).and_return({
          'id' => '23456',
          'customer' => '45678'
        })
        expect(User).to receive(:subscription_event).with({
          'purchase' => true,
          'user_id' => u.global_id,
          'purchase_id' => '23456',
          'customer_id' => '45678',
          'plan_id' => 'long_term_150',
          'token_summary' => 'Unknown Card',
          'seconds_to_add' => 5.years.to_i,
          'source' => 'new purchase'
        })
        Purchasing.purchase(u, {'id' => 'token'}, 'long_term_150')
      end
      
      it "should cancel any running subscriptions" do
        u = User.create
        expect(Stripe::Charge).to receive(:create).with({
          :amount => 15000,
          :currency => 'usd',
          :source => 'token',
          :description => 'communicator long-term purchase $150',
          :receipt_email => nil,
          :metadata => {
            'user_id' => u.global_id,
            'plan_id' => 'long_term_150'
          }
        }).and_return({
          'id' => '23456',
          'customer' => '45678'
        })
        expect(User).to receive(:subscription_event).with({
          'purchase' => true,
          'user_id' => u.global_id,
          'purchase_id' => '23456',
          'customer_id' => '45678',
          'plan_id' => 'long_term_150',
          'token_summary' => 'Unknown Card',
          'seconds_to_add' => 5.years.to_i,
          'source' => 'new purchase'
        })
        expect(Purchasing).to receive(:cancel_other_subscriptions).with(u, 'all')
        Purchasing.purchase(u, {'id' => 'token'}, 'long_term_150')
      end
    end
  end
  
  describe "unsubscribe" do
    it "should error gracefully on no user" do
      expect { Purchasing.unsubscribe(nil) }.not_to raise_error
    end
    
    it "should unsubscribe from all active subscriptions" do
      u = User.create
      u.settings['subscription'] = {'customer_id' => '2345', 'subscription_id' => '3456'}
      u.save
      a = {'id' => '3456'}
      b = {'id' => '6789'}
      c = {'id' => '4567'}
      all = [a, b, c]
      expect(a).to receive(:delete)
      expect(b).to receive(:delete)
      expect(c).to receive(:delete)
      expect(Stripe::Customer).to receive(:retrieve).with('2345').and_return(OpenStruct.new({
        subscriptions: OpenStruct.new({all: all})
      }))
      res = Purchasing.unsubscribe(u)
      expect(res).to eq(true)
    end
    
    it "should not trigger a message if there wasn't an existing subscription" do
      u = User.create(:settings => {'subscription' => {}})
      expect(SubscriptionMailer).to_not receive(:schedule_delivery)
      Purchasing.unsubscribe(u)
    end
  end

  describe "change_user_id" do
    it "should error if no customer found" do
      expect(Stripe::Customer).to receive(:retrieve).with('1234').and_return(nil)
      expect { Purchasing.change_user_id('1234', '111', '222') }.to raise_error('customer not found')
    end
    
    it "should error if customer doesn't match what's expected" do
      o = OpenStruct.new(:metadata => {})
      expect(Stripe::Customer).to receive(:retrieve).with('1234').and_return(o)
      expect { Purchasing.change_user_id('1234', '111', '222') }.to raise_error('wrong existing user_id')
      
      o.metadata['user_id'] = '222'
      expect(Stripe::Customer).to receive(:retrieve).with('1234').and_return(o)
      expect { Purchasing.change_user_id('1234', '111', '222') }.to raise_error('wrong existing user_id')
    end
    
    it "should update the customer correctly" do
      o = OpenStruct.new(:metadata => {'user_id' => '111'})
      expect(Stripe::Customer).to receive(:retrieve).with('1234').and_return(o)
      expect(o).to receive(:save)
      Purchasing.change_user_id('1234', '111', '222')
      expect(o.metadata['user_id']).to eq('222')
    end
  end
  
  describe "cancel_other_subscriptions" do
    it "should return false if no customer found" do
      u = User.create
      res = Purchasing.cancel_other_subscriptions(u, '2345')
      expect(res).to eq(false)
      
      u.settings['subscription'] = {'customer_id' => '1234'}
      expect(Stripe::Customer).to receive(:retrieve).with('1234').and_return(nil)
      res = Purchasing.cancel_other_subscriptions(u, '2345')
      expect(res).to eq(false)
    end
    
    it "should return false on error" do
      u = User.create
      u.settings['subscription'] = {'customer_id' => '1234'}
      expect(Stripe::Customer).to receive(:retrieve).with('1234') { raise "no" }
      res = Purchasing.cancel_other_subscriptions(u, '2345')
      expect(res).to eq(false)
    end
    
    it "should retrieve the customer record" do
      u = User.create
      u.settings['subscription'] = {'customer_id' => '1234'}
      expect(Stripe::Customer).to receive(:retrieve).with('1234').and_return(OpenStruct.new({
        subscriptions: OpenStruct.new({all: []})
      }))
      res = Purchasing.cancel_other_subscriptions(u, '2345')
      expect(res).to eq(true)
    end
    
    it "should cancel all non-matching active subscriptions" do
      u = User.create
      u.settings['subscription'] = {'customer_id' => '2345'}
      a = {'id' => '3456'}
      b = {'id' => '6789'}
      c = {'id' => '4567', 'status' => 'active'}
      all = [a, b, c]
      expect(a).to receive(:delete)
      expect(b).to receive(:delete)
      expect(c).not_to receive(:delete)
      expect(Stripe::Customer).to receive(:retrieve).with('2345').and_return(OpenStruct.new({
        subscriptions: OpenStruct.new({all: all})
      }))
      res = Purchasing.cancel_other_subscriptions(u, '4567')
      expect(res).to eq(true)
    end
    
    it "should cancel subscriptions on prior customer ids" do
      u = User.create
      u.settings['subscription'] = {'customer_id' => '2345', 'prior_customer_ids' => ['3456', '4567']}
      a = {'id' => '3456'}
      b = {'id' => '6789'}
      c = {'id' => '4567', 'status' => 'active'}
      expect(a).to receive(:delete)
      expect(b).to receive(:delete)
      expect(c).to receive(:delete)
      expect(Stripe::Customer).to receive(:retrieve).with('2345').and_return(OpenStruct.new({
        subscriptions: OpenStruct.new({all: [a]})
      }))
      expect(Stripe::Customer).to receive(:retrieve).with('3456').and_return(OpenStruct.new({
        subscriptions: OpenStruct.new({all: [b, c]})
      }))
      expect(Stripe::Customer).to receive(:retrieve).with('4567').and_return(OpenStruct.new({
        subscriptions: OpenStruct.new({all: []})
      }))
      res = Purchasing.cancel_other_subscriptions(u, 'all')
      expect(res).to eq(true)
    end
    
    it "should cancel subscriptions on all but the specified subscription_id, even for prior customer ids" do
      u = User.create
      u.settings['subscription'] = {'customer_id' => '2345', 'prior_customer_ids' => ['3456', '4567']}
      a = {'id' => '3456'}
      b = {'id' => '6789'}
      c = {'id' => '4567', 'status' => 'active'}
      expect(a).to receive(:delete)
      expect(b).to receive(:delete)
      expect(c).not_to receive(:delete)
      expect(Stripe::Customer).to receive(:retrieve).with('2345').and_return(OpenStruct.new({
        subscriptions: OpenStruct.new({all: [a]})
      }))
      expect(Stripe::Customer).to receive(:retrieve).with('3456').and_return(OpenStruct.new({
        subscriptions: OpenStruct.new({all: [b]})
      }))
      expect(Stripe::Customer).to receive(:retrieve).with('4567').and_return(OpenStruct.new({
        subscriptions: OpenStruct.new({all: [c]})
      }))
      res = Purchasing.cancel_other_subscriptions(u, '4567')
      expect(res).to eq(true)
    end
    
    it "should log subscription cancellations" do
      u = User.create
      u.settings['subscription'] = {'customer_id' => '2345'}
      a = {'id' => '3456'}
      b = {'id' => '6789'}
      c = {'id' => '4567', 'status' => 'active'}
      all = [a, b, c]
      expect(a).to receive(:delete)
      expect(b).to receive(:delete)
      expect(c).not_to receive(:delete)
      expect(Stripe::Customer).to receive(:retrieve).with('2345').and_return(OpenStruct.new({
        subscriptions: OpenStruct.new({all: all})
      }))
      res = Purchasing.cancel_other_subscriptions(u, '4567')
      expect(res).to eq(true)
      Worker.process_queues
      u.reload
      expect(u.subscription_events).to_not eq(nil)
      expect(u.subscription_events[-1]['log']).to eq('subscription canceled')
      expect(u.subscription_events[-1]['reason']).to eq('4567')
      expect(u.subscription_events[-2]['log']).to eq('subscription canceled')
      expect(u.subscription_events[-2]['reason']).to eq('4567')
      expect(u.subscription_events[-3]['log']).to eq('subscription canceling')
      expect(u.subscription_events[-3]['reason']).to eq('4567')
    end
    
    it "should log errors on failed cancellations" do
      u = User.create
      res = Purchasing.cancel_other_subscriptions(u, '1234')
      expect(res).to eq(false)
      expect(u.subscription_events.length).to eq(0)
      
      u = User.create({'settings' => {'subscription' => {'customer_id' => '1234'}}})
      expect(Stripe::Customer).to receive(:retrieve).with('1234').and_raise("no dice")
      res = Purchasing.cancel_other_subscriptions(u, '1234')
      expect(res).to eq(false)
      expect(u.subscription_events.length).to eq(2)
      expect(u.subscription_events.map{|e| e['log'] }).to eq(['subscription canceling', 'subscription cancel error'])
      expect(u.subscription_events[1]['error']).to eq('no dice')

      u = User.create({'settings' => {'subscription' => {'customer_id' => '2345'}}})
      subscr = OpenStruct.new
      expect(subscr).to receive(:all).and_raise('naughty')
      expect(Stripe::Customer).to receive(:retrieve).with('2345').and_return(OpenStruct.new({
        subscriptions: subscr
      }))
      res = Purchasing.cancel_other_subscriptions(u, '2345')
      expect(res).to eq(false)
      expect(u.subscription_events.length).to eq(2)
      expect(u.subscription_events.map{|e| e['log'] }).to eq(['subscription canceling', 'subscription cancel error'])
      expect(u.subscription_events[1]['error']).to eq('naughty')
      
      u = User.create({'settings' => {'subscription' => {'customer_id' => '3456'}}})
      a = {'id' => '3456'}
      b = {'id' => '4567'}
      all = [a, b]
      subscr = OpenStruct.new
      expect(b).to receive(:delete).and_raise('yipe')
      expect(Stripe::Customer).to receive(:retrieve).with('3456').and_return(OpenStruct.new({
        subscriptions: OpenStruct.new({all: all})
      }))
      res = Purchasing.cancel_other_subscriptions(u, '3456')
      expect(res).to eq(false)
      expect(u.subscription_events.length).to eq(2)
      expect(u.subscription_events.map{|e| e['log'] }).to eq(['subscription canceling', 'subscription cancel error'])
      expect(u.subscription_events[1]['subscription_id']).to eq('4567')
      expect(u.subscription_events[1]['error']).to eq('yipe')
    end
    
    it "should not cancel other subscriptions if the referenced subscription is inactive" do
      u = User.create
      u.settings['subscription'] = {'customer_id' => '2345'}
      a = {'id' => '3456'}
      b = {'id' => '6789'}
      c = {'id' => '4567', 'status' => 'canceled'}
      all = [a, b, c]
      expect(a).to_not receive(:delete)
      expect(b).to_not receive(:delete)
      expect(c).not_to receive(:delete)
      expect(Stripe::Customer).to receive(:retrieve).with('2345').and_return(OpenStruct.new({
        subscriptions: OpenStruct.new({all: all})
      }))
      res = Purchasing.cancel_other_subscriptions(u, '4567')
      expect(res).to eq(true)
    end
  end
  
  describe "purchase_gift" do
    it "should error on unrecognized purchase type" do
      res = Purchasing.purchase_gift({}, {'type' => 'bob'})
      expect(res[:success]).to eq(false)
      expect(res[:error]).to eq("unrecognized purchase type, bob")
    end
    
    it "should error on invalid purchase amount" do
      res = Purchasing.purchase_gift({}, {'type' => 'long_term_50'})
      expect(res[:success]).to eq(false)
      expect(res[:error]).to eq("50 not valid for type long_term_50")
    end
    
    it "should gracefully handle API errors" do
      expect(Stripe::Charge).to receive(:create) { raise "no" }
      res = Purchasing.purchase_gift({}, {'type' => 'long_term_150'})
      expect(res[:success]).to eq(false)
      expect(res[:error]).to eq('unexpected_error')
      expect(res[:error_message]).to eq('no')
    end
    
    it "should generate a purchase object on success" do
      u = User.create
      expect(Stripe::Charge).to receive(:create).with({
        :amount => 15000,
        :currency => 'usd',
        :source => 'token',
        :description => 'sponsored license purchase $150',
        :metadata => {
          'giver_id' => u.global_id,
          'giver_email' => 'bob@example.com',
          'plan_id' => 'long_term_150'
        }
      }).and_return({
        'customer' => '12345',
        'id' => '23456'
      })
      expect(GiftPurchase).to receive(:process_new).with({}, {
        'giver' => u,
        'email' => 'bob@example.com',
        'customer_id' => '12345',
        'token_summary' => 'Unknown Card',
        'plan_id' => 'long_term_150',
        'purchase_id' => '23456',
        'seconds' => 5.years.to_i
      }).and_return(true)
      res = Purchasing.purchase_gift({'id' => 'token'}, {'type' => 'long_term_150', 'user_id' => u.global_id, 'email' => 'bob@example.com'})
    end

    it "should generate a custom purchase object on success" do
      u = User.create
      expect(Stripe::Charge).to receive(:create).with({
        :amount => 50000,
        :currency => 'usd',
        :source => 'token',
        :description => 'sponsored license purchase $500',
        :metadata => {
          'giver_id' => u.global_id,
          'giver_email' => 'bob@example.com',
          'plan_id' => 'long_term_custom_500'
        }
      }).and_return({
        'customer' => '12345',
        'id' => '23456'
      })
      expect(GiftPurchase).to receive(:process_new).with({}, {
        'giver' => u,
        'email' => 'bob@example.com',
        'customer_id' => '12345',
        'token_summary' => 'Unknown Card',
        'plan_id' => 'long_term_custom_500',
        'purchase_id' => '23456',
        'seconds' => 5.years.to_i
      }).and_return(true)
      res = Purchasing.purchase_gift({'id' => 'token'}, {'type' => 'long_term_custom_500', 'user_id' => u.global_id, 'email' => 'bob@example.com'})
      expect(res).to eq({:success => true, :type => 'long_term_custom_500'})
    end
    
    it "should trigger a notification on success" do
      u = User.create
      notifications = []
      expect(SubscriptionMailer).to receive(:schedule_delivery){ |type, id, action|
        notifications << type
        if type == :gift_created
          expect(id).to_not eq(nil)
          expect(action).to eq(nil)
        elsif type == :gift_updated
          expect(id).to_not eq(nil)
          expect(action).to eq('purchase')
        end
      }.exactly(2).times
      expect(Stripe::Charge).to receive(:create).with({
        :amount => 15000,
        :currency => 'usd',
        :source => 'token',
        :description => 'sponsored license purchase $150',
        :metadata => {
          'giver_id' => u.global_id,
          'giver_email' => 'bob@example.com',
          'plan_id' => 'long_term_150'
        }
      }).and_return({
        'customer' => '12345',
        'id' => '23456'
      })
      res = Purchasing.purchase_gift({'id' => 'token'}, {'type' => 'long_term_150', 'user_id' => u.global_id, 'email' => 'bob@example.com'})
      expect(res[:success]).to eq(true)
      g = GiftPurchase.last
      expect(g.settings['giver_id']).to eq(u.global_id)
      expect(g.settings['customer_id']).to eq('12345')
      expect(g.settings['purchase_id']).to eq('23456')
      expect(g.settings['plan_id']).to eq('long_term_150')
      expect(g.settings['token_summary']).to eq('Unknown Card')
      expect(g.settings['giver_email']).to eq('bob@example.com')
      expect(g.settings['seconds_to_add']).to eq(5.years.to_i)
      expect(notifications).to eq([:gift_created, :gift_updated])
    end
  end

  describe "redeem_gift" do
    it "should error gracefully when no user provided" do
      g = GiftPurchase.create
      res = Purchasing.redeem_gift(g.code, nil)
      expect(res[:success]).to eq(false)
      expect(res[:error]).to eq("user required")
    end
    
    it "should error gracefully when no valid gift found" do
      g = GiftPurchase.create
      u = User.create
      res = Purchasing.redeem_gift(nil, u)
      expect(res[:success]).to eq(false)
      expect(res[:error]).to eq("code doesn't match any available gifts")
      
      res = Purchasing.redeem_gift(g.code + "abc", u)
      expect(res[:success]).to eq(false)
      expect(res[:error]).to eq("code doesn't match any available gifts")
    end
    
    it "should deactivate the specified code" do
      g = GiftPurchase.create(:settings => {'seconds_to_add' => 3.years.to_i})
      u = User.create
      res = Purchasing.redeem_gift(g.code, u)
      expect(res[:success]).to eq(true)
      g.reload
      expect(g.active).to eq(false)
    end
    
    it "should update the recipient's subscription" do
      g = GiftPurchase.create(:settings => {'seconds_to_add' => 3.years.to_i})
      u = User.create
      exp = u.expires_at
      
      res = Purchasing.redeem_gift(g.code, u)
      expect(res[:success]).to eq(true)
      u.reload
      expect(u.expires_at).to eq(exp + 3.years.to_i)
    end
    
    it "should trigger notifications for the recipient and giver" do
      g = GiftPurchase.create(:settings => {'seconds_to_add' => 3.years.to_i})
      u = User.create
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:gift_redeemed, g.global_id)
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:gift_seconds_added, g.global_id)
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:gift_updated, g.global_id, 'redeem')
      res = Purchasing.redeem_gift(g.code, u)
      expect(res[:success]).to eq(true)
      expect(res[:code]).to eq(g.code)
    end
  end
  
  describe "logging" do
    it "should log user events without erroring" do
      u = User.create(:settings => {'subscription' => {}})
      expect(Stripe::Charge).to receive(:create).with({
        :amount => 15000,
        :currency => 'usd',
        :source => 'token',
        :receipt_email => nil,
        :description => 'communicator long-term purchase $150',
        :metadata => {
          'user_id' => u.global_id,
          'plan_id' => 'long_term_150'
        }
      }).and_return({
        'id' => '23456',
        'customer' => '45678'
      })
      expect(User).to receive(:subscription_event)
      Purchasing.purchase(u, {'id' => 'token'}, 'long_term_150')
      Worker.process_queues
      u.reload
      expect(u.subscription_events.length).to eq(5)
      expect(u.subscription_events.map{|e| e['log'] }).to eq(['purchase initiated', 'paid subscription', 'long-term - creating charge', 'persisting long-term purchase update', 'subscription canceling'])
    end
  end
end
