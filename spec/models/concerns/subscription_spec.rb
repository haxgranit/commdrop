require 'spec_helper'

describe Subscription, :type => :model do
  describe "never_expires?" do
    it "should return correct values" do
      u = User.new
      expect(u.never_expires?).to eq(false)
      u.settings = {}
      u.settings['subscription'] = {}
      expect(u.never_expires?).to eq(false)
      u.settings['subscription']['never_expires'] = true      
      expect(u.never_expires?).to eq(true)
    end
  end
  
  describe "grace_period?" do
    it "should return correct values" do
      u = User.new
      expect(u.grace_period?).to eq(false)
      u.expires_at = 2.weeks.from_now
      expect(u.grace_period?).to eq(true)
      u.settings = {}
      u.settings['subscription'] = {}
      u.settings['subscription']['never_expires'] = true
      expect(u.grace_period?).to eq(false)
      u.settings['subscription']['never_expires'] = false
      u.settings['managed_by'] = {'1_1' => {'pending' => false, 'sponsored' => true}}
      u.settings['subscription'] = {}
      u.settings['subscription']['org_sponsored'] = true
      expect(u.grace_period?).to eq(false)
      u.settings['managed_by'] = nil
      u.settings['subscription'] = {}
      expect(u.grace_period?).to eq(true)
      u.settings['subscription']['customer_id'] = 'free'
      expect(u.grace_period?).to eq(true)
      u.settings['subscription']['last_purchase_plan_id'] = 'something'
      expect(u.grace_period?).to eq(false)
      u.settings['subscription']['last_purchase_plan_id'] = nil
      u.settings['subscription']['started'] = 12345
      expect(u.grace_period?).to eq(false)
      u.settings['subscription']['started'] = nil
      expect(u.grace_period?).to eq(true)
      u.settings['subscription']['plan_id'] = 'asdf'
      u.settings['subscription']['subscription_id'] = 'qwer'
      expect(u.grace_period?).to eq(true)
    end
  end
  
  describe "long_term_purchase?" do
    it "should return correct values" do
      u = User.new
      expect(u.long_term_purchase?).to eq(false)
      u.settings = {}
      u.settings['subscription'] = {}
      expect(u.long_term_purchase?).to eq(false)
      u.expires_at = 2.weeks.from_now
      expect(u.long_term_purchase?).to eq(false)
      u.settings['subscription']['last_purchase_plan_id'] = 'asdf'
      expect(u.long_term_purchase?).to eq(true)
    end
  end

  describe "recurring_subscription?" do
    it "should return correct values" do
      u = User.new
      expect(u.recurring_subscription?).to eq(false)
      u.settings = {}
      u.settings['subscription'] = {}
      expect(u.recurring_subscription?).to eq(false)
      u.settings['subscription']['started'] = 123
      expect(u.recurring_subscription?).to eq(true)
    end
  end
  
  describe "premium?" do
    it "should default to a 30-day free trial" do
      u = User.create
      expect(u.expires_at).to be > 29.days.from_now
      expect(u.premium?).to eq(true)
    end
    
    it "should always return premium if set to never expire" do
      u = User.create(:settings => {'subscription' => {'never_expires' => true}})
      expect(u.premium?).to eq(true)
      u.expires_at = 3.days.ago
      expect(u.premium?).to eq(true)
    end
    
    it "should return premium? correctly based on date" do
      u = User.create(:expires_at => 3.days.ago)
      expect(u.premium?).to eq(false)
      u.expires_at = Time.now + 5
      expect(u.premium?).to eq(true)
    end
    
    it "should return premium? with a free supporter-role subscription" do
      u = User.create(:expires_at => 3.days.ago)
      expect(u.premium?).to eq(false)
      res = u.update_subscription({
        'subscribe' => true,
        'subscription_id' => '12345',
        'plan_id' => 'slp_monthly_free'
      })
      expect(res).to eq(true)
      expect(u.settings['subscription']['free_premium']).to eq(true)
      expect(u.premium?).to eq(true)
    end
    
    it "should return premium if assigned to an organization" do
      u = User.create(:expires_at => 3.days.ago)
      expect(u.premium?).to eq(false)
      u.settings['managed_by'] = {'1' => {'pending' => false, 'sponsored' => true}}
      u.settings['subscription'] = {'org_sponsored' => true}
      expect(u.premium?).to eq(true)
    end
  end

  describe "update_organization" do
    it "should update user settings on paused subscription" do
      u = User.create(:settings => {'subscription' => {'started' => Time.now}})
      expect(Purchasing).to receive(:pause_subscription).with(u).and_return({:success => true})
      u.update_subscription('pause' => true)
      expect(u.settings['subscription']['started']).to eq(nil)
    end
    
    it "should retry on failed paused subscription" do
      u = User.create(:settings => {'subscription' => {'started' => Time.now}})
      expect(Purchasing).to receive(:pause_subscription).with(u).and_return({:success => false})
      u.update_subscription('pause' => true)
      settings = {
        'id' => u.id,
        'method' => 'update_subscription',
        'arguments' => [{'pause' => true, 'attempts' => 1}]
      }
      expect(Worker.scheduled?(User, :perform_action, settings)).to eq(true)

      expect(Purchasing).to receive(:pause_subscription).with(u).and_return({:success => false})
      Worker.process_queues
      settings = {
        'id' => u.id,
        'method' => 'update_subscription',
        'arguments' => [{'pause' => true, 'attempts' => 2}]
      }
      expect(Worker.scheduled?(User, :perform_action, settings)).to eq(true)
    end
    
    it "should send an error message on too many failed pause attempts" do
      u = User.create(:settings => {'subscription' => {'started' => Time.now}})
      expect(Purchasing).to receive(:pause_subscription).with(u).and_return({:success => false})
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:subscription_pause_failed, u.global_id)
      u.update_subscription('pause' => true, 'attempts' => 10)
      settings = {
        'id' => u.id,
        'method' => 'update_subscription',
        'arguments' => [{'pause' => true, 'attempts' => 11}]
      }
      expect(Worker.scheduled?(User, :perform_action, settings)).not_to eq(true)
    end
    
    it "should update user settings on resumed subscription" do
      u = User.create
      expect(Purchasing).to receive(:resume_subscription).with(u).and_return({:success => true})
      u.update_subscription('resume' => true)
      expect(u.settings['subscription']['started']).to eq(Time.now.iso8601)
    end
    
    it "should retry on failed resumed subscription" do
      u = User.create(:settings => {'subscription' => {'started' => Time.now}})
      expect(Purchasing).to receive(:resume_subscription).with(u).and_return({:success => false})
      u.update_subscription('resume' => true)
      settings = {
        'id' => u.id,
        'method' => 'update_subscription',
        'arguments' => [{'resume' => true, 'attempts' => 1}]
      }
      expect(Worker.scheduled?(User, :perform_action, settings)).to eq(true)

      expect(Purchasing).to receive(:resume_subscription).with(u).and_return({:success => false})
      Worker.process_queues
      settings = {
        'id' => u.id,
        'method' => 'update_subscription',
        'arguments' => [{'resume' => true, 'attempts' => 2}]
      }
      expect(Worker.scheduled?(User, :perform_action, settings)).to eq(true)
    end
    
    it "should send an error message on too many failed resume attempts" do
      u = User.create(:settings => {'subscription' => {'started' => Time.now}})
      expect(Purchasing).to receive(:resume_subscription).with(u).and_return({:success => false})
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:subscription_resume_failed, u.global_id)
      u.update_subscription('resume' => true, 'attempts' => 10)
      settings = {
        'id' => u.id,
        'method' => 'update_subscription',
        'arguments' => [{'resume' => true, 'attempts' => 11}]
      }
      expect(Worker.scheduled?(User, :perform_action, settings)).not_to eq(true)
    end
  end

  describe "update_subscription_organization" do
    it "should send a notification when an organization is assigned" do
      u = User.create
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_assigned, u.global_id, nil)
      u.update_subscription_organization(-1)
    end
    
    it "should not notify when same org is re-assigned" do
      u = User.create
      o = Organization.create
      u.settings['managed_by'] = {}
      u.settings['managed_by'][o.global_id] = {'pending' => false, 'sponsored' => true}
      expect(UserMailer).not_to receive(:schedule_delivery)
      u.update_subscription_organization(o.global_id)
    end
    
    it "should save any remaining subscription time when assigning to an organization" do
      u = User.create(:expires_at => 1000.seconds.from_now)
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_assigned, u.global_id, nil)
      u.update_subscription_organization(-1)
      expect(u.settings['subscription']['seconds_left']).to eq(1000)
    end
    
    it "should update settings when assigning to an org" do
      u = User.create
      o = Organization.create
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_assigned, u.global_id, o.global_id)
      u.update_subscription_organization(o.global_id)
      expect(u.settings['subscription']['added_to_organization']).to eql(Time.now.iso8601)
      expect(Worker.scheduled?(User, :perform_action, {'id' => u.id, 'method' => 'process_subscription_token', 'arguments' => ['token', 'unsubscribe']})).to eq(true)
    end
    
    it "should notify when org is removed" do
      u = User.create
      o = Organization.create
      u.settings['managed_by'] = {}
      u.settings['managed_by'][o.global_id] = {'pending' => false, 'sponsored' => true}
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_unassigned, u.global_id, o.global_id)
      u.update_subscription_organization(nil)
    end
    
    it "should not notify if no org set before or now" do
      u = User.create
      expect(UserMailer).not_to receive(:schedule_delivery)
      u.update_subscription_organization(nil)
    end
    
    it "should restore any remaining subscription time when removing from an org" do
      u = User.create(:settings => {'subscription' => {'seconds_left' => 12.weeks.to_i}})
      o = Organization.create
      u.settings['managed_by'] = {}
      u.settings['managed_by'][o.global_id] = {'pending' => false, 'sponsored' => true}
      u.settings['subscription']['org_sponsored'] = true
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_unassigned, u.global_id, o.global_id)
      u.update_subscription_organization(nil)
      expect(u.expires_at.to_i).to eq(12.weeks.from_now.to_i)
    end
    
    it "should always give at least a grace period when removing from an org" do
      u = User.create(:settings => {'subscription' => {'seconds_left' => 10.minutes.to_i}})
      o = Organization.create
      u.settings['managed_by'] = {}
      u.settings['managed_by'][o.global_id] = {'pending' => false, 'sponsored' => true}
      u.settings['subscription']['org_sponsored'] = true
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_unassigned, u.global_id, o.global_id)
      u.update_subscription_organization(nil)
      expect(u.expires_at.to_i).to eq(2.weeks.from_now.to_i)
    end
    
    it "should update settings when removing from an org" do
      u = User.create(:settings => {'subscription' => {'started' => Time.now.iso8601, 'added_to_organization' => Time.now.iso8601}})
      o = Organization.create
      u.settings['managed_by'] = {}
      u.settings['managed_by'][o.global_id] = {'pending' => false, 'sponsored' => true}
      u.expires_at = nil
      u.settings['subscription']['org_sponsored'] = true
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_unassigned, u.global_id, o.global_id)
      u.update_subscription_organization(nil)
      expect(u.expires_at.to_i).to eq(2.weeks.from_now.to_i)
      expect(u.settings['subscription']['started']).to eq(nil)
      expect(u.settings['subscription']['added_to_organization']).to eq(nil)
    end
    
    it "should allow adding a a pending user to an org" do
      u = User.create
      o = Organization.create
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_assigned, u.global_id, o.global_id)
      u.update_subscription_organization(o.global_id, true)
      expect(u.settings['subscription']['org_pending']).to eq(true)
      expect(u.expires_at).to eq(nil)
      expect(u.settings['subscription']['added_to_organization']).to eql(Time.now.iso8601)
      expect(Worker.scheduled?(User, :perform_action, {'id' => u.id, 'method' => 'subscription_token', 'arguments' => ['token', 'unsubscribe']})).to eq(false)
    end

    it "should allow adding an unsponsored user to an org" do
      u = User.create
      o = Organization.create
      expect(UserMailer).to receive(:schedule_delivery).with(:organization_assigned, u.global_id, o.global_id)
      u.update_subscription_organization(o.global_id, false, false)
      expect(u.settings['subscription']['org_sponsored']).to eq(false)
      expect(u.expires_at).to_not eq(nil)
      expect(u.settings['subscription']['added_to_organization']).to eql(Time.now.iso8601)
      expect(Worker.scheduled?(User, :perform_action, {'id' => u.id, 'method' => 'subscription_token', 'arguments' => ['token', 'unsubscribe']})).to eq(false)
    end
    
    it "should cancel a user's monthly subscription when they accept an invitation to be sponsored by an org" do
      u = User.create
      o = Organization.create(:settings => {'total_licenses' => 2})
      u.update_subscription_organization(o.global_id, false, true)
      expect(Worker.scheduled?(User, :perform_action, {
        'id' => u.id,
        'method' => 'process_subscription_token',
        'arguments' => ['token', 'unsubscribe']
      })).to eq(true)
    end
  
    it "should not cancel a user's monthly subscription when they are invited to be sponsored by an org" do
      u = User.create
      o = Organization.create(:settings => {'total_licenses' => 2})
      u.update_subscription_organization(o.global_id, true, true)
      expect(Worker.scheduled?(User, :perform_action, {
        'id' => u.id,
        'method' => 'process_subscription_token',
        'arguments' => ['token', 'unsubscribe']
      })).to eq(false)
    end
  
    it "should not cancel a users's monthly subscription when they accept an unsponsored invitation to be added by an org" do
      u = User.create
      o = Organization.create(:settings => {'total_licenses' => 2})
      u.update_subscription_organization(o.global_id, false, false)
      expect(Worker.scheduled?(User, :perform_action, {
        'id' => u.id,
        'method' => 'process_subscription_token',
        'arguments' => ['token', 'unsubscribe']
      })).to eq(false)
    end
  end
  
  describe "update_subscription" do
    it "should ignore unrecognized messages" do
      u = User.create
      res = u.update_subscription({})
      expect(res).to eq(false)
      
      res = u.update_subscription({'jump' => true})
      expect(res).to eq(false)
    end

    describe "subscribe" do    
      it "should parse subscribe events" do
        u = User.create
        res = u.update_subscription({
          'subscribe' => true,
          'subscription_id' => '12345',
          'customer_id' => '23456',
          'plan_id' => 'monthly_6'
        })
        expect(res).to eq(true)
        expect(u.settings['subscription']).not_to eq(nil)
        expect(u.settings['subscription']['subscription_id']).to eq('12345')
        expect(u.settings['subscription']['customer_id']).to eq('23456')
        expect(u.settings['subscription']['plan_id']).to eq('monthly_6')
        expect(u.settings['subscription']['started']).to eq(Time.now.iso8601)
        expect(u.expires_at).to eq(nil)
      end
    
      it "should ignore repeat subscribe events" do
        u = User.create
        started = 6.months.ago.iso8601
        u.settings['subscription'] = {
          'subscription_id' => '12345',
          'customer_id' => '56789',
          'plan_id' => 'monthly_5',
          'started' => started
        }
        u.expires_at = nil
        res = u.update_subscription({
          'subscribe' => true,
          'subscription_id' => '12345',
          'customer_id' => '23456',
          'plan_id' => 'monthly_6'
        })
        expect(res).to eq(false)
        expect(u.settings['subscription']).not_to eq(nil)
        expect(u.settings['subscription']['subscription_id']).to eq('12345')
        expect(u.settings['subscription']['customer_id']).to eq('56789')
        expect(u.settings['subscription']['plan_id']).to eq('monthly_5')
        expect(u.settings['subscription']['started']).to eq(started)
        expect(u.expires_at).to eq(nil)
      end
      
      it "should not fail without a customer_id whether or not it's a free plan" do
        u = User.create
        res = u.update_subscription({
          'subscribe' => true,
          'subscription_id' => '12345',
          'plan_id' => 'monthly_6'
        })
        expect(res).to eq(true)

        res = u.update_subscription({
          'subscribe' => true,
          'subscription_id' => '123456',
          'plan_id' => 'monthly_6'
        })
        expect(res).to eq(true)
      end
      
      it "should  fail if trying to parse the same subscription_id again" do
        u = User.create
        res = u.update_subscription({
          'subscribe' => true,
          'subscription_id' => '12345',
          'plan_id' => 'monthly_6'
        })
        expect(res).to eq(true)

        res = u.update_subscription({
          'subscribe' => true,
          'subscription_id' => '12345',
          'plan_id' => 'monthly_6'
        })
        expect(res).to eq(false)
      end

      it "should remember old customer_ids" do
        u = User.create
        u.settings['subscription'] = {'customer_id' => '54321'}
        expect(u.settings['subscription']['prior_customer_ids']).to eq(nil)
        res = u.update_subscription({
          'subscribe' => true,
          'subscription_id' => '12345',
          'customer_id' => '23456',
          'plan_id' => 'monthly_6'
        })
        expect(res).to eq(true)
        expect(u.settings['subscription']['prior_customer_ids']).to eq(['54321'])
      end
    
      it "should save any remaining long-term purchase time when subscribing" do
        u = User.create(:expires_at => 3.months.from_now)
        time_diff = (3.months.from_now - Time.now).to_i
        res = u.update_subscription({
          'subscribe' => true,
          'subscription_id' => '12345',
          'customer_id' => '23456',
          'plan_id' => 'monthly_6'
        })
        expect(res).to eq(true)
        expect(u.settings['subscription']).not_to eq(nil)
        expect(u.settings['subscription']['subscription_id']).to eq('12345')
        expect(u.settings['subscription']['customer_id']).to eq('23456')
        expect(u.settings['subscription']['plan_id']).to eq('monthly_6')
        expect(u.settings['subscription']['started']).to eq(Time.now.iso8601)
        expect(u.settings['subscription']['seconds_left']).to be > (time_diff - 100)
        expect(u.settings['subscription']['seconds_left']).to be < (time_diff + 100)
        expect(u.expires_at).to eq(nil)        
      end
    end
    
    describe "unsubscribe" do
      it "should parse unsubscribe events" do
        u = User.create
        u.settings['subscription'] = {
          'subscription_id' => '12345',
          'started' => 3.months.ago.iso8601,
          'plan_id' => 'monthly_8'
        }
        u.expires_at = nil
        
        res = u.update_subscription({
          'unsubscribe' => true,
          'subscription_id' => '12345'
        })
        
        expect(res).to eq(true)
        expect(u.settings['subscription']['subscription_id']).to eq(nil)
        expect(u.settings['subscription']['started']).to eq(nil)
        expect(u.settings['subscription']['plan_id']).to eq(nil)
        expect(u.expires_at.to_i).to be > (2.weeks.from_now.to_i - 5)
        expect(u.expires_at.to_i).to be < (2.weeks.from_now.to_i + 5)
      end
      
      it "should ignore if not for the currently-set subscription" do
        u = User.create
        u.settings['subscription'] = {
          'subscription_id' => '12345',
          'started' => 3.months.ago.iso8601,
          'plan_id' => 'monthly_8'
        }
        u.expires_at = nil
        
        res = u.update_subscription({
          'unsubscribe' => true,
          'subscription_id' => '123456'
        })
        
        expect(res).to eq(false)
        expect(u.settings['subscription']['subscription_id']).to eq('12345')
        expect(u.settings['subscription']['started']).to eq(3.months.ago.iso8601)
        expect(u.settings['subscription']['plan_id']).to eq('monthly_8')
        expect(u.expires_at).to eq(nil)
      end
      
      it "should always unsubscribe if subscription_id passed as 'all'" do
        u = User.create
        u.settings['subscription'] = {
          'subscription_id' => '12345',
          'started' => 3.months.ago.iso8601,
          'plan_id' => 'monthly_8'
        }
        u.expires_at = nil
        
        res = u.update_subscription({
          'unsubscribe' => true,
          'subscription_id' => 'all'
        })
        
        expect(res).to eq(true)
        expect(u.settings['subscription']['subscription_id']).to eq(nil)
        expect(u.settings['subscription']['started']).to eq(nil)
        expect(u.settings['subscription']['plan_id']).to eq(nil)
        expect(u.expires_at.to_i).to be > (2.weeks.from_now.to_i - 4)
        expect(u.expires_at.to_i).to be < (2.weeks.from_now.to_i + 4)
      end
      
      it "should restore any remaining time credits when unsubscribing" do
        u = User.create
        u.settings['subscription'] = {
          'subscription_id' => '12345',
          'started' => 3.months.ago.iso8601,
          'plan_id' => 'monthly_8',
          'seconds_left' => 8.weeks.to_i
        }
        u.expires_at = nil
        
        res = u.update_subscription({
          'unsubscribe' => true,
          'subscription_id' => '12345'
        })
        
        expect(res).to eq(true)
        expect(u.expires_at.to_i).to eq(8.weeks.from_now.to_i)
      end
      
      it "should always leave at least a window of time to handle re-subscribing" do
        u = User.create
        u.settings['subscription'] = {
          'subscription_id' => '12345',
          'started' => 3.months.ago.iso8601,
          'plan_id' => 'monthly_8'
        }
        u.expires_at = nil
        
        res = u.update_subscription({
          'unsubscribe' => true,
          'subscription_id' => '12345'
        })
        
        expect(res).to eq(true)
        expect(u.expires_at.to_i).to eq(2.weeks.from_now.to_i)      
      end
    end
    
    describe "purchase" do
      it "should parse purchase events" do
        u = User.create
        u.expires_at = nil
        u.settings['subscription'] = {'started' => 3.weeks.ago.iso8601}
        res = u.update_subscription({
          'purchase' => true,
          'customer_id' => '12345',
          'plan_id' => 'long_term_150',
          'purchase_id' => '23456',
          'seconds_to_add' => 8.weeks.to_i
        })
        
        expect(res).to eq(true)
        expect(u.settings['subscription']).not_to eq(nil)
        expect(u.settings['subscription']['started']).to eq(nil)
        expect(u.settings['subscription']['customer_id']).to eq('12345')
        expect(u.settings['subscription']['last_purchase_plan_id']).to eq('long_term_150')
        expect(u.settings['subscription']['prior_purchase_ids']).to eq(['23456'])
        expect(u.expires_at.to_i).to eq(8.weeks.from_now.to_i)
      end
      
      it "should not re-procress already-handled purchase_ids" do
        u = User.create
        u.expires_at = nil
        u.settings['subscription'] = {'started' => 3.weeks.ago.iso8601}
        u.settings['subscription']['prior_purchase_ids'] = ['23456']
        res = u.update_subscription({
          'purchase' => true,
          'customer_id' => '12345',
          'plan_id' => 'long_term_150',
          'purchase_id' => '23456',
          'seconds_to_add' => 8.weeks.to_i
        })
        
        expect(res).to eq(false)
        expect(u.settings['subscription']).not_to eq(nil)
        expect(u.expires_at).to eq(nil)
      end
      
      it "should not fail without a customer_id whether or not it's a free plan" do
        u = User.create
        u.expires_at = nil
        u.settings['subscription'] = {'started' => 3.weeks.ago.iso8601}
        res = u.update_subscription({
          'purchase' => true,
          'plan_id' => 'long_term_150',
          'purchase_id' => '23456',
          'seconds_to_add' => 8.weeks.to_i
        })
        expect(res).to eq(true)
        
        u = User.create
        u.expires_at = nil
        u.settings['subscription'] = {'started' => 3.weeks.ago.iso8601}
        res = u.update_subscription({
          'purchase' => true,
          'plan_id' => 'slp_long_term_free',
          'purchase_id' => '23456',
          'seconds_to_add' => 8.weeks.to_i
        })
        expect(res).to eq(true)
      end

      it "should remember prior customer_ids" do
        u = User.create
        u.expires_at = nil
        u.settings['subscription'] = {'started' => 3.weeks.ago.iso8601, 'customer_id' => '54321'}
        expect(u.settings['subscription']['prior_customer_ids']).to eq(nil)
        res = u.update_subscription({
          'purchase' => true,
          'customer_id' => '12345',
          'plan_id' => 'long_term_150',
          'purchase_id' => '23456',
          'seconds_to_add' => 8.weeks.to_i
        })
        expect(res).to eq(true)
        expect(u.settings['subscription']['prior_customer_ids']).to eq(['54321'])
      end
    end
  end
  
  describe "subscription_event" do
    it "should not error on unfound user" do
      u = User.create
      expect(User.subscription_event({'user_id' => 'asdf'})).to eq(false)
      expect(User.subscription_event({'user_id' => u.global_id})).to eq(true)
    end
    
    it "should send a notification for bounced subscription attempts" do
      u = User.create
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:purchase_bounced, u.global_id)
      User.subscription_event({'user_id' => u.global_id, 'purchase_failed' => true})
    end
    
    it "should send a notification for successful purchases" do
      u = User.create
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:purchase_confirmed, u.global_id)
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:new_subscription, u.global_id)
      User.subscription_event({'user_id' => u.global_id, 'purchase' => true, 'purchase_id' => '1234', 'customer_id' => '2345', 'plan_id' => 'long_term_150', 'seconds_to_add' => 3.weeks.to_i})
    end
    
    it "should properly update the user settings depending on the purchase type" do
      u = User.create
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:purchase_confirmed, u.global_id)
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:new_subscription, u.global_id)
      t = u.expires_at + 8.weeks
      User.subscription_event({'user_id' => u.global_id, 'purchase' => true, 'purchase_id' => '1234', 'customer_id' => '2345', 'plan_id' => 'long_term_150', 'seconds_to_add' => 8.weeks.to_i})
      u.reload
      expect(u.settings['subscription']).not_to eq(nil)
      expect(u.settings['subscription']['started']).to eq(nil)
      expect(u.expires_at).to eq(t)

      u = User.create
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:purchase_confirmed, u.global_id)
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:new_subscription, u.global_id)
      User.subscription_event({'user_id' => u.global_id, 'subscribe' => true, 'subscription_id' => '1234', 'customer_id' => '2345', 'plan_id' => 'monthly_6'})
      u.reload
      expect(u.settings['subscription']).not_to eq(nil)
      expect(u.settings['subscription']['started']).not_to eq(nil)
      expect(Time.parse(u.settings['subscription']['started'])).to be > 1.minute.ago
    end
    
    it "should not send multiple purchase_confirmed notifications" do
      u = User.create
      u.settings['subscription'] = {'prior_purchase_ids' => ['1234']}
      u.save
      expect(SubscriptionMailer).not_to receive(:schedule_delivery).with(:purchase_confirmed, u.global_id)
      expect(SubscriptionMailer).not_to receive(:schedule_delivery).with(:new_subscription, u.global_id)
      t = u.expires_at + 8.weeks
      User.subscription_event({'user_id' => u.global_id, 'purchase' => true, 'purchase_id' => '1234', 'customer_id' => '2345', 'plan_id' => 'long_term_150', 'seconds_to_add' => 8.weeks.to_i})
    end
    
    it "should not send multiple unsubscribe notifications" do
    end
    
    it "should handle unsubscribe event" do
      u = User.create
      u.settings['subscription'] = {
        'subscription_id' => '12345',
        'started' => 3.months.ago.iso8601,
        'plan_id' => 'monthly_8'
      }
      u.expires_at = nil
      u.save

      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:subscription_expiring, u.global_id)
      User.subscription_event({'user_id' => u.global_id, 'unsubscribe' => true, 'subscription_id' => '12345'})
    end
    
    it "should handle chargeback event" do
      u = User.create
      expect(SubscriptionMailer).to receive(:schedule_delivery).with(:chargeback_created, u.global_id)
      User.subscription_event({'user_id' => u.global_id, 'chargeback_created' => true})
    end
  end  
  
  describe "process_subscription_token" do
    it "should call purchasing code" do
      u = User.create
      expect(Purchasing).to receive(:purchase).with(u, 'asdf', 'qwer')
      u.process_subscription_token('asdf', 'qwer')
    end
    
    it "should call unsubscribe if specified" do
      u = User.create
      expect(Purchasing).to receive(:unsubscribe).with(u)
      u.process_subscription_token('token', 'unsubscribe')
    end
  end
  
  describe "subscription_hash" do
    it "should correctly identify long-term subscription entries" do
      u = User.new
      u.settings = {}
      u.expires_at = 2.weeks.from_now
      u.settings['subscription'] = {"token_summary"=>nil, "last_purchase_plan_id"=>"long_term_300", "free_premium"=>false, "prior_purchase_ids"=>["aaa", "bbb"]}
      expect(u.subscription_hash).not_to eq(nil)
      expect(u.subscription_hash['active']).to eq(true)
      expect(u.subscription_hash['plan_id']).to eq('long_term_300')
      expect(u.subscription_hash['purchased']).to eq(true)
      expect(u.subscription_hash['grace_period']).to eq(false)
    end
    
    it "should include org information even for non-sponsored org users" do
      o = Organization.create(:settings => {'total_licenses' => 1})
      u = User.create
    
      res = o.add_user(u.user_name, false, false)
      u.reload
      expect(o.managed_user?(u)).to eq(true)
      expect(o.sponsored_user?(u)).to eq(false)
      
      expect(u.subscription_hash).not_to eq(nil)
      expect(u.subscription_hash['is_managed']).to eq(true)
      expect(u.subscription_hash['org_pending']).to eq(false)
      expect(u.subscription_hash['org_sponsored']).to eq(false)
    end
  end
  
  describe "check_for_subscription_updates" do
    it "should return a tally result" do
      res = User.check_for_subscription_updates
      expect(res).not_to eq(nil)
      expect(res[:upcoming]).to eq(0)
      expect(res[:expired]).to eq(0)
    end
    
    it "should find expiring users" do
      u1 = User.create(:expires_at => 2.weeks.from_now)
      u2 = User.create(:expires_at => 6.days.from_now)
      u3 = User.create(:expires_at => 25.hours.from_now)
      u4 = User.create(:expires_at => 5.minutes.from_now)
      res = User.check_for_subscription_updates
      expect(res).not_to eq(nil)
      expect(res[:upcoming]).to eq(2)
    end
    
    it "should find recently-expired users" do
      u1 = User.create(:expires_at => 2.weeks.from_now)
      u2 = User.create(:expires_at => 6.days.from_now)
      u3 = User.create(:expires_at => 1.minute.ago)
      u4 = User.create(:expires_at => 2.days.ago)
      u4 = User.create(:expires_at => 9.days.ago)
      res = User.check_for_subscription_updates
      expect(res).not_to eq(nil)
      expect(res[:expired]).to eq(2)
    end
    
    it "should notify nearly-expiring users" do
      u1 = User.create(:expires_at => 6.days.from_now)
      u2 = User.create(:expires_at => 25.hours.from_now)
      u3 = User.create(:expires_at => 2.days.from_now)
      expect(SubscriptionMailer).to receive(:deliver_message).with(:one_week_until_expiration, u1.global_id)
      expect(SubscriptionMailer).to receive(:deliver_message).with(:one_day_until_expiration, u2.global_id)
      res = User.check_for_subscription_updates
      
      expect(res).not_to eq(nil)
      expect(res[:upcoming]).to eq(3)
      expect(res[:upcoming_emailed]).to eq(2)
    end
    
    it "should not notify nearly-expiring users more than once" do
      u1 = User.create(:expires_at => 6.days.from_now)
      u2 = User.create(:expires_at => 25.hours.from_now)
      u3 = User.create(:expires_at => 6.days.from_now, :settings => {'subscription' => {'last_expiring_week_notification' => Time.now.iso8601}})
      u4 = User.create(:expires_at => 25.hours.from_now, :settings => {'subscription' => {'last_expiring_day_notification' => 3.days.ago.iso8601}})
      expect(SubscriptionMailer).to receive(:deliver_message).with(:one_week_until_expiration, u1.global_id)
      expect(SubscriptionMailer).to receive(:deliver_message).with(:one_day_until_expiration, u2.global_id)
      res = User.check_for_subscription_updates
      
      expect(res).not_to eq(nil)
      expect(res[:upcoming]).to eq(4)
      expect(res[:upcoming_emailed]).to eq(2)
    end
    
    it "should notify recently-expired users" do
      u1 = User.create(:expires_at => 1.hour.ago)
      u2 = User.create(:expires_at => 5.days.ago)
      expect(SubscriptionMailer).to receive(:deliver_message).with(:subscription_expired, u1.global_id)
      res = User.check_for_subscription_updates
      
      expect(res).not_to eq(nil)
      expect(res[:expired]).to eq(1)
      expect(res[:expired_emailed]).to eq(1)
    end
    
    it "should not notify recently-expired users more than once" do
      u1 = User.create(:expires_at => 1.hour.ago)
      u2 = User.create(:expires_at => 1.hour.ago, :settings => {'subscription' => {'last_expired_notification' => Time.now.iso8601}})
      expect(SubscriptionMailer).to receive(:deliver_message).with(:subscription_expired, u1.global_id)
      res = User.check_for_subscription_updates
      
      expect(res).not_to eq(nil)
      expect(res[:expired]).to eq(2)
      expect(res[:expired_emailed]).to eq(1)
    end
    
    it "should notify recently-created inactive users" do
      u1 = User.create
      b = Board.create(:user => u1, :public => true)
      u2 = User.process_new({'preferences' => {'logging' => true}})
      u3 = User.process_new({'preferences' => {'logging' => true, 'home_board' => {'id' => b.global_id}, 'role' => 'supporter'}})
      u4 = User.process_new({'preferences' => {'logging' => true, 'home_board' => {'id' => b.global_id}}})
      d4 = Device.create(:user => u4)
      u5 = User.process_new({'preferences' => {'logging' => true, 'home_board' => {'id' => b.global_id}}})
      d5 = Device.create(:user => u5)
      Device.where({:user_id => u5.id}).update_all({:updated_at => 10.days.ago})
      u6 = User.create
      u7 = User.process_new({'preferences' => {'logging' => true, 'home_board' => {'id' => b.global_id}, 'role' => 'supporter'}})
      d7 = Device.create(:user => u7)
      User.link_supervisor_to_user(u7, u6)
      User.where({:id => [u1.id, u2.id, u3.id, u4.id, u5.id, u6.id, u7.id]}).update_all({:created_at => 7.days.ago})
      
      ids = []
      expect(UserMailer).to receive(:deliver_message){|message, id|
        ids << id if message == :usage_reminder
      }.at_least(1).times
      res = User.check_for_subscription_updates
      expect(ids.sort).to eq([u1.global_id, u2.global_id, u3.global_id, u5.global_id, u6.global_id])
      expect(res[:recent_less_active]).to eq(5)
    end

    it "should not notify recently-created inactive users more than once" do
      u1 = User.create
      User.where({:id => u1.id}).update_all({:created_at => 7.days.ago})

      expect(UserMailer).to receive(:deliver_message).with(:usage_reminder, u1.global_id)
      res = User.check_for_subscription_updates
      expect(res[:recent_less_active]).to eq(1)
      
      expect(UserMailer).not_to receive(:deliver_message)
      res = User.check_for_subscription_updates
      expect(res[:recent_less_active]).to eq(0)
    end
    
    it "should notify users whose expiration is approaching" do
      u1 = User.create(:expires_at => 3.months.from_now, :settings => {'subscription' => {'started' => 'sometime'}})
      u2 = User.create(:expires_at => 3.months.from_now + 2.days, :settings => {'subscription' => {'started' => 'sometime'}})
      u3 = User.create(:expires_at => 2.months.from_now, :settings => {'subscription' => {'started' => 'sometime'}})
      u4 = User.create(:expires_at => 1.month.from_now, :settings => {'subscription' => {'started' => 'sometime'}})
      u5 = User.create(:expires_at => 1.month.from_now)
      
      expect(SubscriptionMailer).to receive(:deliver_message).with(:expiration_approaching, u1.global_id)
      expect(SubscriptionMailer).to receive(:deliver_message).with(:expiration_approaching, u4.global_id)
      res = User.check_for_subscription_updates
      expect(res[:approaching]).to eq(2)
      expect(res[:approaching_emailed]).to eq(2)
    end
    
    it "should not notify users whose expiration is approaching more than once" do
      u1 = User.create(:expires_at => 3.months.from_now, :settings => {'subscription' => {'started' => 'sometime'}})
      u1.settings['subscription']['last_approaching_notification'] = 2.days.ago.iso8601
      u1.save
      u2 = User.create(:expires_at => 3.months.from_now + 2.days, :settings => {'subscription' => {'started' => 'sometime'}})
      u3 = User.create(:expires_at => 2.months.from_now, :settings => {'subscription' => {'started' => 'sometime'}})
      u4 = User.create(:expires_at => 1.month.from_now, :settings => {'subscription' => {'started' => 'sometime'}})
      u4.settings['subscription']['last_approaching_notification'] = 2.months.ago.iso8601
      u4.save
      u5 = User.create(:expires_at => 1.month.from_now)
      u6 = User.create(:expires_at => 1.month.from_now, :settings => {'subscription' => {'started' => 'sometime'}})
      
      expect(SubscriptionMailer).to receive(:deliver_message).with(:expiration_approaching, u4.global_id)
      expect(SubscriptionMailer).to receive(:deliver_message).with(:expiration_approaching, u6.global_id)
      res = User.check_for_subscription_updates
      expect(res[:approaching]).to eq(3)
      expect(res[:approaching_emailed]).to eq(2)

      res = User.check_for_subscription_updates
      expect(res[:approaching]).to eq(3)
      expect(res[:approaching_emailed]).to eq(0)
    end
  end
  
  describe "subscription_override" do
    it "should update for never_expires" do
      u = User.create
      expect(u.subscription_override('never_expires')).to eq(true)
      expect(u.never_expires?).to eq(true)
    end
    
    it "should update for eval type" do
      u = User.create
      expect(u.subscription_override('eval')).to eq(true)
      expect(u.settings['subscription']['free_premium']).to eq(false);
      expect(u.settings['subscription']['plan_id']).to eq('eval_monthly_free');
    end
    
    it "should return false for unrecognized type" do
      u = User.new
      expect(u.subscription_override('bacon')).to eq(false)
      expect(u.subscription_override('slp_monthly_free')).to eq(false)
    end
    
    it "should update to communicator type" do
      u = User.create
      expect(u.subscription_override('communicator_trial')).to eq(true)
      expect(u.grace_period?).to eq(true)
      
      u = User.create
      u.subscription_override('eval')
      expect(u.subscription_override('communicator_trial')).to eq(true)
      expect(u.grace_period?).to eq(true)
      
      u = User.create
      u.subscription_override('manual_supporter')
      expect(u.subscription_override('communicator_trial')).to eq(true)
      expect(u.grace_period?).to eq(true)
    end
  end
  
  describe "transfer_subscription_to" do
    it "should move attributes from one user to another" do
      u1 = User.create
      u2 = User.create
      u1.settings['subscription'] = {
        'bacon' => '1234',
        'started' => 1234,
        'token_summary' => 'asdfjkl',
        'never_expires' => true
      }
      u1.transfer_subscription_to(u2)
      expect(u1.settings['subscription']).to eq({
        'transferred_to' => [u2.global_id],
        'bacon' => '1234'
      })
      expect(u2.settings['subscription']).to eq({
        'started' => 1234,
        'token_summary' => 'asdfjkl',
        'never_expires' => true, 
        'transferred_from' => [u1.global_id]
      })
    end
    
    it "should update the metadata on the subscription customer if there is one" do
      u1 = User.create
      u2 = User.create
      u1.settings['subscription'] = {
        'bacon' => '1234',
        'started' => 1234,
        'token_summary' => 'asdfjkl',
        'never_expires' => true,
        'customer_id' => '222222'
      }
      expect(Purchasing).to receive(:change_user_id).with('222222', u1.global_id, u2.global_id)
      u1.transfer_subscription_to(u2)
      expect(u1.settings['subscription']).to eq({
        'transferred_to' => [u2.global_id],
        'bacon' => '1234'
      })
      expect(u2.settings['subscription']).to eq({
        'started' => 1234,
        'customer_id' => '222222',
        'token_summary' => 'asdfjkl',
        'never_expires' => true, 
        'transferred_from' => [u1.global_id]
      })
    end
  end
end
