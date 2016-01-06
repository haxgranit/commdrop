require 'spec_helper'

describe LogSession, :type => :model do
  describe "paper trail" do
    it "should make sure paper trail is doing its thing"
  end
  
  describe "generate_defaults" do
    it "should generate default values" do
      s = LogSession.new
      s.generate_defaults
      expect(s.data['events']).to eq([])
      expect(s.data['geo']).to eq(nil)
      expect(s.processed).to eq(false)
    end
    
    it "should not override existing values" do
      s = LogSession.new
      s.data = {}
      s.data['events'] = [
        {'geo' => ['1', '2'], 'timestamp' => 10.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}},
        {'geo' => ['1', '3'], 'timestamp' => 8.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'cow', 'board' => {'id' => '1_1'}}}
      ]
      s.processed = true
      s.generate_defaults
      expect(s.data['events'].length).to eq(2)
      expect(s.data['geo']).to eq([1.0, 2.5, 0.0])
      expect(s.processed).to eq(true)
    end
    
    it "should generate summary data for log events or notes" do
      s = LogSession.new
      s.data = {}
      time1 = 10.minutes.ago
      time2 = 8.minutes.ago
      s.data['events'] = [
        {'geo' => ['1', '2'], 'timestamp' => time1.to_i, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}},
        {'geo' => ['1', '2'], 'timestamp' => time2.to_i, 'type' => 'button', 'button' => {'label' => 'cow', 'board' => {'id' => '1_1'}}}
      ]
      s.generate_defaults
      expect(s.data['button_count']).to eq(2)
      expect(s.data['utterance_count']).to eq(0)
      expect(s.data['utterance_word_count']).to eq(0)
      expect(s.data['duration']).to eq(120)
      expect(s.data['event_count']).to eq(2)
      expect(s.started_at.to_i).to eq(time1.to_i)
      expect(s.ended_at.to_i).to eq(time2.to_i)
      expect(s.data['event_summary']).to eq('hat...cow')
      
      u = User.new(:user_name => "fred")
      s = LogSession.new(:author => u)
      s.data = {}
      s.data['note'] = {
        'text' => "I am happy"
      }
      s.generate_defaults
      expect(s.data['button_count']).to eq(0)
      expect(s.data['utterance_count']).to eq(0)
      expect(s.data['utterance_word_count']).to eq(0)
      expect(s.data['duration']).to eq(nil)
      expect(s.data['event_count']).to eq(0)
      expect(s.started_at).to be > 1.second.ago
      expect(s.ended_at).to be > 1.second.ago
      expect(s.data['event_summary']).to eq('Note by fred: I am happy')
    end
    
    it "should not include auto_home events in the summary" do
      s = LogSession.new
      s.data = {}
      time1 = 10.minutes.ago
      time2 = 8.minutes.ago
      time3 = 2.minutes.ago
      s.data['events'] = [
        {'geo' => ['1', '2'], 'timestamp' => time1.to_i, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}},
        {'geo' => ['1', '2'], 'timestamp' => time2.to_i, 'type' => 'button', 'button' => {'label' => 'cow', 'board' => {'id' => '1_1'}}},
        {'action' => {'action' => 'auto_home'}, 'timestamp' => time3.to_i, 'type' => 'action'},
        {'action' => {'action' => 'home'}, 'timestamp' => time3.to_i, 'type' => 'action'}
      ]
      s.generate_defaults
      expect(s.data['button_count']).to eq(2)
      expect(s.data['utterance_count']).to eq(0)
      expect(s.data['utterance_word_count']).to eq(0)
      expect(s.data['duration']).to eq(480)
      expect(s.data['event_count']).to eq(4)
      expect(s.started_at.to_i).to eq(time1.to_i)
      expect(s.ended_at.to_i).to eq(time3.to_i)
      expect(s.data['event_summary']).to eq('hat...cow....[home]')
    end
    
    it "should mark buttons as modified_by_next" do
      u = User.create
      d = Device.create
      events = [
        {'type' => 'button', 'button' => {'label' => 'run'}, 'timestamp' => 1444994881}, 
        {'type' => 'button', 'button' => {'label' => 'cat'}, 'timestamp' => 1444994882}, 
        {'type' => 'button', 'button' => {'label' => 'f', 'vocalization' => '+f'}, 'timestamp' => 1444994883},
        {'type' => 'button', 'button' => {'label' => 'u', 'vocalization' => '+u'}, 'timestamp' => 1444994884},
        {'type' => 'button', 'button' => {'label' => 'n', 'vocalization' => '+n'}, 'timestamp' => 1444994885},
        {'type' => 'button', 'button' => {'label' => 'n', 'vocalization' => '+n'}, 'timestamp' => 1444994886},
        {'type' => 'button', 'button' => {'label' => 'y', 'vocalization' => '+y'}, 'timestamp' => 1444994887},
      ]
      s = LogSession.process_new({'events' => events}, {:user => u, :author => u, :device => d, :ip_address => '1.2.3.4'})
      
      expect(s.data['events'].length).to eq(7)
      expect(s.data['events'][0]['modified_by_next']).to eq(nil)
      expect(s.data['events'][0]['spelling']).to eq(nil)
      expect(s.data['events'][1]['modified_by_next']).to eq(nil)
      expect(s.data['events'][1]['spelling']).to eq(nil)
      expect(s.data['events'][2]['modified_by_next']).to eq(true)
      expect(s.data['events'][2]['spelling']).to eq(nil)
      expect(s.data['events'][3]['modified_by_next']).to eq(true)
      expect(s.data['events'][3]['spelling']).to eq(nil)
      expect(s.data['events'][4]['modified_by_next']).to eq(true)
      expect(s.data['events'][4]['spelling']).to eq(nil)
      expect(s.data['events'][5]['modified_by_next']).to eq(true)
      expect(s.data['events'][5]['spelling']).to eq(nil)
      expect(s.data['events'][6]['modified_by_next']).to eq(false)
      expect(s.data['events'][6]['spelling']).to eq('funny')
    end
    
    it "should mark spelling finishes correctly" do
      u = User.create
      d = Device.create
      events = [
        {'type' => 'button', 'button' => {'label' => 'run'}, 'timestamp' => 1444994881}, 
        {'type' => 'button', 'button' => {'label' => 'cat'}, 'timestamp' => 1444994882}, 
        {'type' => 'button', 'button' => {'label' => 'f', 'vocalization' => '+f'}, 'timestamp' => 1444994883},
        {'type' => 'button', 'button' => {'label' => 'u', 'vocalization' => '+u'}, 'timestamp' => 1444994883.1},
        {'type' => 'button', 'button' => {'label' => 'n', 'vocalization' => '+n'}, 'timestamp' => 1444994883.2},
        {'type' => 'button', 'button' => {'label' => 'n', 'vocalization' => '+n'}, 'timestamp' => 1444994883.3},
        {'type' => 'button', 'button' => {'label' => 'y', 'vocalization' => '+y'}, 'timestamp' => 1444994883.4},
        {'type' => 'button', 'button' => {'label' => ' ', 'vocalization' => ':space', 'completion' => 'funny'}, 'timestamp' => 1444994888}
      ]
      s = LogSession.process_new({'events' => events}, {:user => u, :author => u, :device => d, :ip_address => '1.2.3.4'})
      
      expect(s.data['events'].length).to eq(8)
      expect(s.data['events'][0]['modified_by_next']).to eq(nil)
      expect(s.data['events'][0]['spelling']).to eq(nil)
      expect(s.data['events'][1]['modified_by_next']).to eq(nil)
      expect(s.data['events'][1]['spelling']).to eq(nil)
      expect(s.data['events'][2]['modified_by_next']).to eq(true)
      expect(s.data['events'][2]['spelling']).to eq(nil)
      expect(s.data['events'][3]['modified_by_next']).to eq(true)
      expect(s.data['events'][3]['spelling']).to eq(nil)
      expect(s.data['events'][4]['modified_by_next']).to eq(true)
      expect(s.data['events'][4]['spelling']).to eq(nil)
      expect(s.data['events'][5]['modified_by_next']).to eq(true)
      expect(s.data['events'][5]['spelling']).to eq(nil)
      expect(s.data['events'][6]['modified_by_next']).to eq(true)
      expect(s.data['events'][6]['spelling']).to eq(nil)
      expect(s.data['events'][7]['modified_by_next']).to eq(nil)
      expect(s.data['events'][7]['spelling']).to eq(nil)
      expect(s.data['events'][7]['button']['completion']).to eq('funny')
    end
    
    it "should not mark spelling if the sequence includes a modifier" do
      u = User.create
      d = Device.create
      events = [
        {'type' => 'button', 'button' => {'label' => 'run'}, 'timestamp' => 1444994881}, 
        {'type' => 'button', 'button' => {'label' => 'cat'}, 'timestamp' => 1444994882}, 
        {'type' => 'button', 'button' => {'label' => 'f', 'vocalization' => '+f'}, 'timestamp' => 1444994883},
        {'type' => 'button', 'button' => {'label' => 'u', 'vocalization' => '+u'}, 'timestamp' => 1444994884},
        {'type' => 'button', 'button' => {'label' => 'n', 'vocalization' => ':ing'}, 'timestamp' => 1444994885},
        {'type' => 'button', 'button' => {'label' => 'n', 'vocalization' => '+n'}, 'timestamp' => 1444994886},
        {'type' => 'button', 'button' => {'label' => 'y', 'vocalization' => '+y'}, 'timestamp' => 1444994887},
        {'type' => 'button', 'button' => {'label' => ' ', 'vocalization' => ':space'}, 'timestamp' => 1444994888}
      ]
      s = LogSession.process_new({'events' => events}, {:user => u, :author => u, :device => d, :ip_address => '1.2.3.4'})
      
      expect(s.data['events'].length).to eq(8)
      expect(s.data['events'][0]['modified_by_next']).to eq(nil)
      expect(s.data['events'][0]['spelling']).to eq(nil)
      expect(s.data['events'][1]['modified_by_next']).to eq(nil)
      expect(s.data['events'][1]['spelling']).to eq(nil)
      expect(s.data['events'][2]['modified_by_next']).to eq(true)
      expect(s.data['events'][2]['spelling']).to eq(nil)
      expect(s.data['events'][3]['modified_by_next']).to eq(true)
      expect(s.data['events'][3]['spelling']).to eq(nil)
      expect(s.data['events'][4]['modified_by_next']).to eq(nil)
      expect(s.data['events'][4]['spelling']).to eq(nil)
      expect(s.data['events'][5]['modified_by_next']).to eq(true)
      expect(s.data['events'][5]['spelling']).to eq(nil)
      expect(s.data['events'][6]['modified_by_next']).to eq(true)
      expect(s.data['events'][6]['spelling']).to eq(nil)
      expect(s.data['events'][7]['modified_by_next']).to eq(nil)
      expect(s.data['events'][7]['spelling']).to eq(nil)
    end
    
    it "should check for word_data using the spelling attribute if set" do
      u = User.create
      d = Device.create
      events = [
        {'type' => 'button', 'button' => {'label' => 'run'}, 'timestamp' => 1444994881.001}, 
        {'type' => 'button', 'button' => {'label' => 'cat'}, 'timestamp' => 1444994881.002}, 
        {'type' => 'button', 'button' => {'label' => 'f', 'vocalization' => '+f'}, 'timestamp' => 1444994881.003},
        {'type' => 'button', 'button' => {'label' => 'u', 'vocalization' => '+u'}, 'timestamp' => 1444994881.004},
        {'type' => 'button', 'button' => {'label' => 'n', 'vocalization' => '+n'}, 'timestamp' => 1444994881.005},
        {'type' => 'button', 'button' => {'label' => 'n', 'vocalization' => '+n'}, 'timestamp' => 1444994881.006},
        {'type' => 'button', 'button' => {'label' => 'y', 'vocalization' => '+y'}, 'timestamp' => 1444994881.007}
      ]
      s = LogSession.process_new({'events' => events}, {:user => u, :author => u, :device => d, :ip_address => '1.2.3.4'})
      
      expect(s.data['events'].length).to eq(7)
      expect(s.data['events'][0]['button']['label']).to eq('run')
      expect(s.data['events'][0]['id']).to eq(1)
      expect(s.data['events'][1]['button']['label']).to eq('cat')
      expect(s.data['events'][1]['id']).to eq(2)
      expect(s.data['events'][2]['button']['label']).to eq('f')
      expect(s.data['events'][2]['id']).to eq(3)
      expect(s.data['events'][3]['button']['label']).to eq('u')
      expect(s.data['events'][3]['id']).to eq(4)
      expect(s.data['events'][4]['button']['label']).to eq('n')
      expect(s.data['events'][4]['id']).to eq(5)
      expect(s.data['events'][5]['button']['label']).to eq('n')
      expect(s.data['events'][5]['id']).to eq(6)
      expect(s.data['events'][6]['button']['label']).to eq('y')
      expect(s.data['events'][6]['id']).to eq(7)
      expect(s.data['events'][6]['modified_by_next']).to eq(false)
      expect(s.data['events'][6]['spelling']).to eq('funny')
      expect(s.data['events'][6]['parts_of_speech']).to eq({'word' => 'funny', 'types' => ['adjective', 'noun']})
    end
    
    it "should tally button labels it doesn't know how to classify" do
      RedisInit.default.del('missing_words')
      u = User.create
      d = Device.create
      events = [
        {'type' => 'button', 'button' => {'label' => 'runxlify', 'type' => 'speak'}, 'timestamp' => 1444994881.001},
        {'type' => 'button', 'button' => {'label' => 'runxlify', 'type' => 'speak'}, 'timestamp' => 1444994881.005},
        {'type' => 'button', 'button' => {'label' => 'run', 'type' => 'speak'}, 'timestamp' => 1444994881.005}
      ]
      s = LogSession.process_new({'events' => events}, {:user => u, :author => u, :device => d, :ip_address => '1.2.3.4'})
      words = RedisInit.default.hgetall('missing_words')
      expect(words).not_to eq(nil)
      expect(words['runxlify']).to eq("2")
      expect(words['runx']).to eq(nil)
    end
    
    it "should check for word_data on the completion action" do
      u = User.create
      d = Device.create
      events = [
        {'type' => 'button', 'button' => {'label' => 'run', 'type' => 'speak'}, 'timestamp' => 1444994881}, 
        {'type' => 'button', 'button' => {'label' => 'cat', 'type' => 'speak'}, 'timestamp' => 1444994882}, 
        {'type' => 'button', 'button' => {'label' => 'f', 'vocalization' => '+f', 'type' => 'speak'}, 'timestamp' => 1444994883},
        {'type' => 'button', 'button' => {'label' => 'u', 'vocalization' => '+u', 'type' => 'speak'}, 'timestamp' => 1444994884},
        {'type' => 'button', 'button' => {'label' => 'n', 'vocalization' => '+n', 'type' => 'speak'}, 'timestamp' => 1444994885},
        {'type' => 'button', 'button' => {'label' => 'n', 'vocalization' => '+n', 'type' => 'speak'}, 'timestamp' => 1444994886},
        {'type' => 'button', 'button' => {'label' => 'y', 'vocalization' => '+y', 'type' => 'speak'}, 'timestamp' => 1444994887},
        {'type' => 'button', 'button' => {'label' => ' ', 'vocalization' => ':space', 'completion' => 'funny', 'type' => 'speak'}, 'timestamp' => 1444994888}
      ]
      s = LogSession.process_new({'events' => events}, {:user => u, :author => u, :device => d, :ip_address => '1.2.3.4'})
      
      expect(s.data['events'].length).to eq(8)
      expect(s.data['events'][7]['modified_by_next']).to eq(nil)
      expect(s.data['events'][7]['spelling']).to eq(nil)
      expect(s.data['events'][7]['button']['completion']).to eq('funny')
      expect(s.data['events'][0]['parts_of_speech']).to eq({'word' => 'run', 'types' => ['verb', 'usu participle verb', 'intransitive verb', 'transitive verb']})
      expect(s.data['events'][1]['parts_of_speech']).to eq({'word' => 'cat', 'types' => ['noun', 'verb', 'usu participle verb']})
      expect(s.data['events'][2]['parts_of_speech']).to eq(nil)
      expect(s.data['events'][3]['parts_of_speech']).to eq(nil)
      expect(s.data['events'][4]['parts_of_speech']).to eq(nil)
      expect(s.data['events'][5]['parts_of_speech']).to eq(nil)
      expect(s.data['events'][6]['parts_of_speech']).to eq(nil)
      expect(s.data['events'][7]['parts_of_speech']).to eq({'word' => 'funny', 'types' => ['adjective', 'noun']})
    end
    
    it "should set the word_data type to 'other' for appropriate cases" do
      u = User.create
      d = Device.create
      events = [
        {'type' => 'button', 'button' => {'label' => 'ruxl', 'type' => 'speak'}, 'timestamp' => 1444994881}, 
        {'type' => 'button', 'button' => {'label' => 'f', 'vocalization' => '+f', 'type' => 'speak'}, 'timestamp' => 1444994883},
        {'type' => 'button', 'button' => {'label' => 'u', 'vocalization' => '+z', 'type' => 'speak'}, 'timestamp' => 1444994884}
      ]
      s = LogSession.process_new({'events' => events}, {:user => u, :author => u, :device => d, :ip_address => '1.2.3.4'})
      
      expect(s.data['events'].length).to eq(3)
      expect(s.data['events'][0]['parts_of_speech']).to eq({'types' => ['other']})
      expect(s.data['events'][1]['parts_of_speech']).to eq(nil)
      expect(s.data['events'][2]['spelling']).to eq('fz')
      expect(s.data['events'][2]['parts_of_speech']).to eq({'types' => ['other']})
    end
  end
  
  describe "generate_stats" do
    it "should generate reasonable defaults" do
      s = LogSession.new(:data => {})
      s.generate_stats
      expect(s.data['stats']).not_to eql(nil)
      expect(s.data['stats']['session_seconds']).to eql(0)
      expect(s.data['stats']['utterances']).to eql(0.0)
      expect(s.data['stats']['utterance_words']).to eql(0.0)
      expect(s.data['stats']['utterance_buttons']).to eql(0.0)
      expect(s.data['stats']['all_buttons']).to eql([])
      expect(s.data['stats']['all_words']).to eql([])
      expect(s.data['stats']['all_boards']).to eql([])
      expect(s.data['stats']['parts_of_speech']).to eql({})
    end
    
    it "should correctly tally up totals" do
      s = LogSession.new
      s.started_at = 6.hours.ago
      time = s.started_at.to_i
      s.ended_at = s.started_at + 100
      s.data = {}
      s.data['events'] = [
        {'type' => 'utterance', 'utterance' => {'text' => 'I am a good person', 'buttons' => [{}, {}]}, 'timestamp' => time},
        {'type' => 'utterance', 'utterance' => {'text' => 'are we friends', 'buttons' => [{}, {}, {}]}, 'timestamp' => time + 10},
        {'type' => 'utterance', 'utterance' => {'text' => 'what is your name', 'buttons' => [{}]}, 'timestamp' => time + 25},
        {'type' => 'button', 'button' => {'button_id' => 1, 'board' => {'id' => '1'}, 'label' => 'radish'}, 'timestamp' => time + 38},
        {'type' => 'button', 'button' => {'button_id' => 2, 'board' => {'id' => '1'}, 'label' => 'friend'}, 'timestamp' => time + 57},
        {'type' => 'button', 'button' => {'button_id' => 1, 'board' => {'id' => '1'}, 'label' => 'radish'}, 'timestamp' => time + 59},
        {'type' => 'button', 'button' => {'button_id' => 3, 'board' => {'id' => '1'}, 'label' => 'cheese'}, 'timestamp' => time + 100}
      ]
      s.generate_defaults
      s.generate_stats
      expect(s.data['stats']['session_seconds']).to eql(100)
      expect(s.data['stats']['utterances']).to eql(3.0)
      expect(s.data['stats']['utterance_words']).to eql(12.0)
      expect(s.data['stats']['utterance_buttons']).to eql(6.0)
      expect(s.data['stats']['all_button_counts'].map{|k, v| v['count']}.sum).to eql(4)
      expect(s.data['stats']['all_word_counts'].map{|k, v| k}).to eql(['radish', 'friend', 'cheese'])
      expect(s.data['stats']['all_word_counts'].map{|k, v| v}).to eql([2, 1, 1])
      expect(s.data['stats']['all_board_counts'].keys.length).to eql(1)
      expect(s.data['stats']['all_board_counts'].map{|k, v| v['count']}.sum).to eql(4)
      expect(s.data['stats']['parts_of_speech']).to eql({
        'noun' => 4
      })
    end
  end

  describe "split_out_later_sessions" do
    it "should do nothing if events are close enough together" do
      s = LogSession.new
      s.data = {}
      time1 = 10.minutes.ago
      time2 = 8.minutes.ago
      time3 = 8.minutes.ago + 5
      time4 = 8.minutes.ago + 10
      s.data['events'] = [
        {'geo' => ['1', '2'], 'timestamp' => time1.to_i, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}},
        {'geo' => ['2', '3'], 'timestamp' => time2.to_i, 'type' => 'button', 'button' => {'label' => 'cow', 'board' => {'id' => '1_1'}}},
        {'geo' => ['2', '3'], 'timestamp' => time3.to_i, 'type' => 'button', 'button' => {'label' => 'corn', 'board' => {'id' => '1_1'}}},
        {'geo' => ['2', '3'], 'timestamp' => time4.to_i, 'type' => 'button', 'button' => {'label' => 'hippo', 'board' => {'id' => '1_1'}}}
      ]
      s.split_out_later_sessions
      Worker.process_queues
      expect(s.data['events'].length).to eq(4)
      expect(LogSession.count).to eq(0)
    end
    
    it "should schedule a background job to split the event if frd=false" do
      events = []
      e = {'geo' => ['1', '2'], 'timestamp' => 12.weeks.ago.to_i, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}}
      4.times do |i|
        e['timestamp'] += 30
        events << e.merge({})
      end
      e['timestamp'] += User.default_log_session_duration + 100
      e['button'] = {'label' => 'bad', 'board' => {'id' => '1_1'}}
      events << e.merge({})
      5.times do |i|
        e['timestamp'] += 30
        events << e.merge({})
      end
      e['timestamp'] += User.default_log_session_duration + 100
      e['button'] = {'label' => 'sad', 'board' => {'id' => '1_1'}}
      events << e.merge({})
      3.times do |i|
        e['timestamp'] += 30
        events << e.merge({})
      end
      
      u = User.create
      d = Device.create
      s = LogSession.new(:data => {'events' => events}, :user => u, :author => u, :device => d)
      s.id = 1
      s.split_out_later_sessions
      expect(Worker.scheduled?(LogSession, :perform_action, {'id' => 1, 'method' => 'split_out_later_sessions', 'arguments' => [true]})).to eq(true)
    end
    
    it "should break out (possibly-multiple) sessions from the existing session based on the cutoff" do
      events = []
      e = {'geo' => ['1', '2'], 'timestamp' => 12.weeks.ago.to_i, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}}
      4.times do |i|
        e['timestamp'] += 30
        events << e.merge({})
      end
      e['timestamp'] += User.default_log_session_duration + 100
      e['button'] = {'label' => 'bad', 'board' => {'id' => '1_1'}}
      events << e.merge({})
      5.times do |i|
        e['timestamp'] += 30
        events << e.merge({})
      end
      e['timestamp'] += User.default_log_session_duration + 100
      e['button'] = {'label' => 'sad', 'board' => {'id' => '1_1'}}
      events << e.merge({})
      4.times do |i|
        e['timestamp'] += 30
        events << e.merge({})
      end
      
      u = User.create
      d = Device.create
      s = LogSession.new(:data => {'events' => events}, :user => u, :author => u, :device => d)
      s.split_out_later_sessions(true)
      Worker.process_queues
      expect(s.data['events'].length).to eq(4)
      expect(s.data['events'].map{|e| e['button']['label']}.uniq).to eq(['hat'])
      expect(LogSession.count).to eq(3)
      sessions = LogSession.all
      session1 = sessions.detect{|s| s.data['events'].length == 6 }
      session2 = sessions.detect{|s| s.data['events'].length == 5 }
      session3 = sessions.detect{|s| s.data['events'].length == 4 }
      expect(session1).not_to eq(nil)
      expect(session1.data['events'].map{|e| e['button']['label'] }.uniq).to eq(['bad'])
      expect(session2).not_to eq(nil)
      expect(session2.data['events'].map{|e| e['button']['label'] }.uniq).to eq(['sad'])
      expect(session3).not_to eq(nil)
      expect(session3.data['events'].map{|e| e['button']['label'] }.uniq).to eq(['hat'])
    end
  end

  describe "process_as_follow_on" do
    it "should append to the latest log if still active" do
      d = Device.create
      u = User.create
      s = LogSession.new(:device => d, :user => u, :author => u)
      s.data = {}
      s.data['events'] = [
        {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 10.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}},
        {'user_id' => u.global_id, 'geo' => ['1', '2'], 'timestamp' => 8.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'cow', 'board' => {'id' => '1_1'}}}
      ]
      s.save
      s.reload
      expect(s.data['events'].length).to eq(2)
      expect(s.data['events'].map{|e| e['button']['label'] }).to eq(['hat', 'cow'])
      
      LogSession.process_as_follow_on({
        'events' => [
          {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 3.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'chicken', 'board' => {'id' => '1_1'}}},
          {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 2.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'radish', 'board' => {'id' => '1_1'}}}
        ]
      }, {:device => d, :author => u, :user => u})
      Worker.process_queues
      
      s.reload
      expect(s.data['events'].length).to eq(4)
      expect(s.data['events'].map{|e| e['button']['label'] }).to eq(['hat', 'cow', 'chicken', 'radish'])
      expect(LogSession.count).to eq(1)
    end
    
    it "should create a new log if no active log" do
      d = Device.create
      u = User.create
      s = LogSession.new(:user => u, :device => d, :author => u)
      s.data = {}
      s.data['events'] = [
        {'geo' => ['1', '2'], 'timestamp' => 3.hours.ago.to_i, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}},
        {'geo' => ['2', '3'], 'timestamp' => (3.hours.ago.to_i + 10), 'type' => 'button', 'button' => {'label' => 'cow', 'board' => {'id' => '1_1'}}}
      ]
      s.save
      
      LogSession.process_as_follow_on({
        'events' => [
          {'geo' => ['2', '3'], 'timestamp' => 3.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'chicken', 'board' => {'id' => '1_1'}}},
          {'geo' => ['2', '3'], 'timestamp' => 2.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'radish', 'board' => {'id' => '1_1'}}}
        ]
      }, {:device => d, :author => u, :user => u})
      Worker.process_queues
      
      s.reload
      expect(s.data['events'].length).to eq(2)
      expect(s.data['events'].map{|e| e['button']['label'] }).to eq(['hat', 'cow'])
      expect(LogSession.count).to eq(2)
      expect(LogSession.last.data['events'].length).to eq(2)
      expect(LogSession.last.data['events'].map{|e| e['button']['label'] }).to eq(['chicken', 'radish'])
    end
    
    it "should create a new log if there was a long delay" do
      d = Device.create
      u = User.create
      s = LogSession.new(:device => d, :user => u, :author => u)
      s.data = {}
      s.data['events'] = [
        {'user_id' => u.global_id, 'geo' => ['1', '2'], 'timestamp' => 90.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}},
        {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 89.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'cow', 'board' => {'id' => '1_1'}}}
      ]
      s.save
      s.reload
      expect(s.data['events'].length).to eq(2)
      expect(s.data['events'].map{|e| e['button']['label'] }).to eq(['hat', 'cow'])
      
      LogSession.process_as_follow_on({
        'events' => [
          {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 3.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'chicken', 'board' => {'id' => '1_1'}}},
          {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 2.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'radish', 'board' => {'id' => '1_1'}}}
        ]
      }, {:device => d, :author => u, :user => u})
      Worker.process_queues
      
      s.reload
      expect(s.data['events'].length).to eq(2)
      expect(s.data['events'].map{|e| e['button']['label'] }).to eq(['hat', 'cow'])
      expect(LogSession.count).to eq(2)
      s2 = LogSession.last
      expect(s2.data['events'].length).to eq(2)
      expect(s2.data['events'].map{|e| e['button']['label'] }).to eq(['chicken', 'radish'])
    end

    it "should create a new log if the last log wasn't a session type" do
      d = Device.create
      u = User.create
      s = LogSession.new(:device => d, :user => u, :author => u)
      s.data = {'assessment' => {
        'totals' => {
          'correct' => 5,
          'incorrect' => 4
        }
      }}
      s.save
      s.reload
      expect(s.log_type).to eq('assessment')
      
      LogSession.process_as_follow_on({
        'events' => [
          {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 3.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'chicken', 'board' => {'id' => '1_1'}}},
          {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 2.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'radish', 'board' => {'id' => '1_1'}}}
        ]
      }, {:device => d, :author => u, :user => u})
      Worker.process_queues
      
      s.reload
      expect(LogSession.count).to eq(2)
      s2 = LogSession.last
      expect(s.data['events'].length).to eq(0)
      expect(s2.data['events'].length).to eq(2)
      expect(s2.data['events'].map{|e| e['button']['label'] }).to eq(['chicken', 'radish'])
    end
    
    it "should not create a new log if the user_id changed and the author is not allowed to log for that user" do
      d = Device.create
      u = User.create
      u2 = User.create
      s = LogSession.new(:device => d, :user => u, :author => u)
      s.data = {}
      s.data['events'] = [
        {'user_id' => u.global_id, 'geo' => ['1', '2'], 'timestamp' => 9.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}},
        {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 8.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'cow', 'board' => {'id' => '1_1'}}}
      ]
      s.save
      s.reload
      expect(s.data['events'].length).to eq(2)
      expect(s.data['events'].map{|e| e['button']['label'] }).to eq(['hat', 'cow'])
      
      LogSession.process_as_follow_on({
        'events' => [
          {'user_id' => u2.global_id, 'geo' => ['2', '3'], 'timestamp' => 3.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'chicken', 'board' => {'id' => '1_1'}}},
          {'user_id' => u2.global_id, 'geo' => ['2', '3'], 'timestamp' => 2.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'radish', 'board' => {'id' => '1_1'}}}
        ]
      }, {:device => d, :author => u, :user => u})
      Worker.process_queues
      
      s.reload
      expect(s.data['events'].length).to eq(4)
      expect(s.user_id).to eq(u.id)
      expect(s.data['events'].map{|e| e['button']['label'] }).to eq(['hat', 'cow', 'chicken', 'radish'])
      expect(LogSession.count).to eq(1)

      Worker.process_queues
      s.reload
      expect(s.data['events'].length).to eq(2)
      expect(s.user_id).to eq(u.id)
      expect(s.data['events'].map{|e| e['button']['label'] }).to eq(['hat', 'cow'])
      expect(LogSession.count).to eq(1)
    end
    
    it "should create a new log if the user_id changed and allowed" do
      d = Device.create
      u = User.create
      u2 = User.create
      expect_any_instance_of(User).to receive(:allows?).with(u, 'supervise').and_return(true)
      s = LogSession.new(:device => d, :user => u, :author => u)
      s.data = {}
      s.data['events'] = [
        {'user_id' => u.global_id, 'geo' => ['1', '2'], 'timestamp' => 9.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}},
        {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 8.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'cow', 'board' => {'id' => '1_1'}}}
      ]
      s.save
      s.reload
      expect(s.data['events'].length).to eq(2)
      expect(s.data['events'].map{|e| e['button']['label'] }).to eq(['hat', 'cow'])
      
      LogSession.process_as_follow_on({
        'events' => [
          {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 8.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'paste', 'board' => {'id' => '1_1'}}},
          {'user_id' => u2.global_id, 'geo' => ['2', '3'], 'timestamp' => 3.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'chicken', 'board' => {'id' => '1_1'}}},
          {'user_id' => u2.global_id, 'geo' => ['2', '3'], 'timestamp' => 2.minutes.ago.to_i, 'type' => 'button', 'button' => {'label' => 'radish', 'board' => {'id' => '1_1'}}}
        ]
      }, {:device => d, :author => u, :user => u})
      Worker.process_queues
      Worker.process_queues
      
      s.reload
      expect(s.data['events'].length).to eq(3)
      expect(s.user_id).to eq(u.id)
      expect(s.data['events'].map{|e| e['button']['label'] }).to eq(['hat', 'cow', 'paste'])
      expect(LogSession.count).to eq(2)
      s2 = LogSession.last
      expect(s2.user_id).to eq(u2.id)
      expect(s2.author_id).to eq(u.id)
      expect(s2.device_id).to eq(d.id)
      expect(s2.data['events'].length).to eq(2)
      expect(s2.data['events'].map{|e| e['button']['label'] }).to eq(['chicken', 'radish'])
    end
  end

  describe "process_params" do
    it "should require user, author and device" do
      s = LogSession.new
      expect { s.process_params({}, {}) }.to raise_error("user required")
      u = User.create
      expect { s.process_params({}, {:user => u}) }.to raise_error("author required")
      expect { s.process_params({}, {:user => u, :author => u}) }.to raise_error("device required")
      d = Device.create
      expect { s.process_params({}, {:user => u, :author => u, :device => d}) }.to_not raise_error
    end
    it "should ignore unsent parameters" do
      u = User.create
      d = Device.create
      s = LogSession.new
      s.process_params({}, {:user => u, :author => u, :device => d})
      expect(s.data['events']).to eq(nil)
      expect(s.data['note']).to eq(nil)
      expect(s.data['ip_address']).to eq(nil)
    end
    
    it "should update attributes" do
      u = User.create
      d = Device.create
      s = LogSession.new
      s.process_params({
        'events' => [{'timestamp' => 123}]
      }, {:user => u, :author => u, :device => d})
      expect(s.data['events']).to eq([{'timestamp' => 123, 'ip_address' => nil, 'id' => 1}])
      expect(s.data['note']).to eq(nil)
      expect(s.data['ip_address']).to eq(nil)
    end
    
    it "should append to, not replace events list" do
      u = User.create
      d = Device.create
      s = LogSession.new(:data => {'events' => [{'timestamp' => 122}]})
      s.process_params({
        'events' => [{'timestamp' => 123}]
      }, {:user => u, :author => u, :device => d})
      expect(s.data['events']).to eq([{'timestamp' => 122}, {'timestamp' => 123, 'ip_address' => nil, 'id' => 1}])
    end
    
    it "should restrict some data to only be non-user params settable" do
      u = User.create
      d = Device.create
      s = LogSession.new(:user => u, :author => u, :device => d)
      s.process_params({
        'ip_address' => '8.8.8.8',
        'device' => {},
        'user' => {},
        'events' => [{}],
        'author' => {}
      }, {})
      expect(s.data['events'].length).to eq(1)
      expect(s.data['events'][0]['ip_address']).to eq(nil)
      expect(s.data['ip_address']).to eq(nil)
      expect(s.device).to eq(d)
      expect(s.user).to eq(u)
      expect(s.author).to eq(u)

      d = Device.new
      u = User.new
      s.process_params({'events' => [{}]}, {
        :ip_address => '8.8.8.8',
        :device => d,
        :user => u,
        :author => u
      })
      expect(s.data['events'].length).to eq(2)
      expect(s.data['events'][1]['ip_address']).to eq('8.8.8.8')
      s.save
      expect(s.data['ip_address']).to eq('0000:0000:0000:0000:0000:ffff:0808:0808')
      expect(s.user).to eq(u)
      expect(s.author).to eq(u)
      expect(s.device).to eq(d)
    end
    
    it "should process standalone notes" do
      u = User.create
      d = Device.create
      s = LogSession.process_new({
        'note' => {
          'text' => 'ahem',
          'timestamp' => 1431461182
        },
        'notify' => true
      }, {'user' => u, 'author' => u, 'device' => d, 'ip_address' => '1.2.3.4'})
      expect(s).not_to eq(nil)
      expect(s.errored?).to eq(false)
      expect(s.started_at.to_i).to eq(1431461182)
      expect(s.ended_at.to_i).to eq(1431461182)
      expect(s.log_type).to eq('note')
      expect(s.data['event_summary']).to eq("Note by #{u.user_name}: ahem")
      expect(s.data['note']['text']).to eq('ahem')
      expect(s.instance_variable_get('@pushed_message')).to eq(true)
    end
    
    it "should process standalone assessments" do
      u = User.create
      d = Device.create
      s = LogSession.process_new({
        'assessment' => {
          'description' => 'Simple eval',
          'totals' => {
            'correct' => 5,
            'incorrect' => 6
          },
          'tallies' => [
            {'correct' => true, 'timestamp' => 1431461182},
            {'correct' => false, 'timestamp' => 1431461185},
            {'correct' => false, 'timestamp' => 1431461189},
            {'correct' => true, 'timestamp' => 1431461193},
            {'correct' => true, 'timestamp' => 1431461198},
            {'correct' => true, 'timestamp' => 1431461204}
          ]
        }
      }, {'user' => u, 'author' => u, 'device' => d, 'ip_address' => '2.3.4.5'})
      expect(s).not_to eq(nil)
      expect(s.errored?).to eq(false)
      expect(s.started_at.to_i).to eq(1431461182)
      expect(s.ended_at.to_i).to eq(1431461204)
      expect(s.log_type).to eq('assessment')
      expect(s.data['event_summary']).to eq("Assessment by #{u.user_name}: Simple eval (5 correct, 6 incorrect, 45.5%)")
      expect(s.data['stats']['total_correct']).to eq(5)
      expect(s.data['stats']['total_incorrect']).to eq(6)
      expect(s.data['stats']['recorded_correct']).to eq(4)
      expect(s.data['stats']['recorded_incorrect']).to eq(2)
      expect(s.data['stats']['longest_correct_streak']).to eq(3)
      expect(s.data['stats']['longest_incorrect_streak']).to eq(2)
    end

    it "should pull out embedded note events" do
      d = Device.create
      u = User.create
      u2 = User.create
      User.link_supervisor_to_user(u, u2, nil, true)
      s = LogSession.process_new({
        'events' => [
          {'user_id' => u.global_id, 'geo' => ['1', '2'], 'timestamp' => 1431461204, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}},
          {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 1431461206, 'type' => 'button', 'button' => {'label' => 'cow', 'board' => {'id' => '1_1'}}},
          {'user_id' => u2.global_id, 'geo' => ['1', '2'], 'timestamp' => 1431461207, 'type' => 'note', 'note' => {'note' => {'text' => 'ok cool', 'timestamp' => 1431461208}, 'notify' => false}}
        ]
      }, {:user => u, :author => u, :device => d})
      
      expect(s).not_to eq(nil)
      expect(s.errored?).to eq(false)
      expect(s.user).to eq(u)
      expect(s.data['events'].length).to eq(3)
      expect(LogSession.count).to eq(1)
      Worker.process_queues
      s.reload
      expect(LogSession.count).to eq(2)
      expect(s.user).to eq(u)
      expect(s.data['events'].length).to eq(2)
      s2 = LogSession.last
      expect(s2).not_to eq(s)
      expect(s2.user).to eq(u2)
      expect(s2.log_type).to eq('note')
      expect(s2.started_at.to_i).to eq(1431461208)
      expect(s2.ended_at.to_i).to eq(1431461208)
      expect(s2.data['note']['text']).to eq('ok cool')
    end

    it "should pull out embedded note events even at the beginning of the list" do
      d = Device.create
      u = User.create
      u2 = User.create
      User.link_supervisor_to_user(u, u2, nil, true)
      s = LogSession.process_new({
        'events' => [
          {'user_id' => u2.global_id, 'geo' => ['1', '2'], 'timestamp' => 1431461200, 'type' => 'note', 'note' => {'note' => {'text' => 'ok cool', 'timestamp' => 1431461200}, 'notify' => false}},
          {'user_id' => u.global_id, 'geo' => ['1', '2'], 'timestamp' => 1431461204, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}},
          {'user_id' => u.global_id, 'geo' => ['2', '3'], 'timestamp' => 1431461206, 'type' => 'button', 'button' => {'label' => 'cow', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => u, :author => u, :device => d})
      
      expect(s).not_to eq(nil)
      expect(s.errored?).to eq(false)
      expect(s.user).to eq(u)
      expect(s.data['events'].length).to eq(3)
      expect(LogSession.count).to eq(1)
      Worker.process_queues
      s.reload
      expect(LogSession.count).to eq(2)
      expect(s.user).to eq(u)
      expect(s.data['events'].length).to eq(2)
      s2 = LogSession.last
      expect(s2).not_to eq(s)
      expect(s2.user).to eq(u2)
      expect(s2.log_type).to eq('note')
      expect(s2.started_at.to_i).to eq(1431461200)
      expect(s2.ended_at.to_i).to eq(1431461200)
      expect(s2.data['event_summary']).to eq("Note by #{u.user_name}: ok cool")
      expect(s2.data['note']['text']).to eq('ok cool')
    end
    
    it "should pull out embedded assessment events" do
      d = Device.create
      u = User.create
      u2 = User.create
      User.link_supervisor_to_user(u, u2, nil, true)
      s = LogSession.process_new({
        'events' => [
          {'user_id' => u2.global_id, 'geo' => ['1', '2'], 'timestamp' => 1431461200, 'type' => 'note', 'note' => {'note' => {'text' => 'ok cool', 'timestamp' => 1431461200}, 'notify' => false}},
          {'user_id' => u.global_id, 'geo' => ['1', '2'], 'timestamp' => 1431461204, 'type' => 'button', 'button' => {'label' => 'hat', 'board' => {'id' => '1_1'}}},
          {'user_id' => u2.global_id, 'geo' => ['2', '3'], 'timestamp' => 1431461206, 'type' => 'assessment', 'assessment' => {'assessment' => {
            'start_timestamp' => 1431461200,
            'end_timestamp' => 1431461206,
            'totals' => {
              'correct' => 12,
              'incorrect' => 3
            }
          }}}
        ]
      }, {:user => u, :author => u, :device => d})
      
      expect(s).not_to eq(nil)
      expect(s.errored?).to eq(false)
      expect(s.user).to eq(u)
      expect(s.data['events'].length).to eq(3)
      expect(LogSession.count).to eq(1)
      Worker.process_queues
      s.reload
      expect(LogSession.count).to eq(3)
      expect(s.user).to eq(u)
      expect(s.data['events'].length).to eq(1)
      s3 = LogSession.find_by(:log_type => 'assessment', :user_id => u2.id)
      s2 = LogSession.find_by(:log_type => 'note', :user_id => u2.id)
      expect(s2).not_to eq(nil)
      expect(s2.user).to eq(u2)
      expect(s2.log_type).to eq('note')
      expect(s2.data['event_summary']).to eq("Note by #{u.user_name}: ok cool")
      expect(s2.started_at.to_i).to eq(1431461200)
      expect(s2.ended_at.to_i).to eq(1431461200)

      expect(s3).not_to eq(nil)
      expect(s3.user).to eq(u2)
      expect(s3.log_type).to eq('assessment')
      expect(s3.data['event_summary']).to eq("Assessment by #{u.user_name}: Quick assessment (12 correct, 3 incorrect, 80.0%)")
    end
    
  end

  describe "process_raw_log" do
    it "should do something spec-worthy"
  end
  
  it "should securely serialize settings" do
    l = LogSession.new(:user => User.create, :device => Device.create, :author => User.create)
    l.generate_defaults
    expect(SecureJson).to receive(:dump).with(l.data)
    l.save
  end
  
  describe "event notes" do
    it "should generate ids for any events that don't have them" do
      l = LogSession.new
      l.data = {}
      now = 1415689201
      l.data['events'] = [
        {'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10},
        {'type' => 'button', 'button' => {'label' => 'like', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 8},
        {'type' => 'button', 'button' => {'label' => 'ok go', 'board' => {'id' => '1_1'}}, 'timestamp' => now}
      ]
      l.save
      expect(l.data['events'].map{|e| e['id'] }).to eql([1, 2, 3])
    end
    
    it "should process notes on update" do
      u = User.create
      d = Device.create(:user => u)
      now = 1415689201
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, },
          {'id' => 'qwe', 'type' => 'button', 'button' => {'label' => 'like', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 8},
          {'id' => 'wer', 'type' => 'button', 'button' => {'label' => 'ok go', 'board' => {'id' => '1_1'}}, 'timestamp' => now}
        ]
      }
      l = LogSession.process_new(params, {
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc', 'qwe', 'wer'])
      expect(l.data['events'].map{|e| e['notes'] }).to eql([nil, nil, nil])
      
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, 'notes' => [
            {'note' => 'ok cool'}
          ]},
          {'id' => 'qwe', 'type' => 'button', 'button' => {'label' => 'like', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 8},
          {'id' => 'wer', 'type' => 'button', 'button' => {'label' => 'ok go', 'board' => {'id' => '1_1'}}, 'timestamp' => now, 'notes' => [
            {'note' => 'that is good'}
          ]}
        ]
      }
      l.process(params, {
        :update_only => true,
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc', 'qwe', 'wer'])
      note = l.data['events'][0]['notes'][0]
      expect(note['note']).to eql('ok cool')
      expect(note['timestamp']).to be > 0
      expect(note['author']).to eql({
        'id' => u.global_id,
        'user_name' => u.user_name
      })

      note = l.data['events'][2]['notes'][0]
      expect(note['note']).to eql('that is good')
      expect(note['timestamp']).to be > 0
      expect(note['author']).to eql({
        'id' => u.global_id,
        'user_name' => u.user_name
      })
    end
    
    it "should generate ids for any notes that don't have them" do
      u = User.create
      d = Device.create(:user => u)
      now = 1415689201
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, },
          {'id' => 'qwe', 'type' => 'button', 'button' => {'label' => 'like', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 8},
          {'id' => 'wer', 'type' => 'button', 'button' => {'label' => 'ok go', 'board' => {'id' => '1_1'}}, 'timestamp' => now}
        ]
      }
      l = LogSession.process_new(params, {
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc', 'qwe', 'wer'])
      
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, 'notes' => [
            {'note' => 'ok cool'}
          ]},
          {'id' => 'qwe', 'type' => 'button', 'button' => {'label' => 'like', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 8},
          {'id' => 'wer', 'type' => 'button', 'button' => {'label' => 'ok go', 'board' => {'id' => '1_1'}}, 'timestamp' => now, 'notes' => [
            {'note' => 'that is good'}
          ]}
        ]
      }
      l.process(params, {
        :update_only => true,
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc', 'qwe', 'wer'])
      note = l.data['events'][0]['notes'][0]
      expect(note['id']).to eql(1)
      expect(note['note']).to eql('ok cool')

      note = l.data['events'][2]['notes'][0]
      expect(note['id']).to eql(1)
      expect(note['note']).to eql('that is good')
    end
    
    it "should attribute any new notes to the current author" do
      u = User.create
      d = Device.create(:user => u)
      now = 1415689201
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, },
          {'id' => 'qwe', 'type' => 'button', 'button' => {'label' => 'like', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 8},
          {'id' => 'wer', 'type' => 'button', 'button' => {'label' => 'ok go', 'board' => {'id' => '1_1'}}, 'timestamp' => now}
        ]
      }
      l = LogSession.process_new(params, {
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc', 'qwe', 'wer'])
      expect(l.data['events'].map{|e| e['notes'] }).to eql([nil, nil, nil])
      
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, 'notes' => [
            {'note' => 'ok cool', 'author' => {}}
          ]},
          {'id' => 'qwe', 'type' => 'button', 'button' => {'label' => 'like', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 8},
          {'id' => 'wer', 'type' => 'button', 'button' => {'label' => 'ok go', 'board' => {'id' => '1_1'}}, 'timestamp' => now, 'notes' => [
            {'note' => 'that is good'}
          ]}
        ]
      }
      l.process(params, {
        :update_only => true,
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc', 'qwe', 'wer'])
      note = l.data['events'][0]['notes'][0]
      expect(note['note']).to eql('ok cool')
      expect(note['author']).to eql({})

      note = l.data['events'][2]['notes'][0]
      expect(note['note']).to eql('that is good')
      expect(note['author']).to eql({
        'id' => u.global_id,
        'user_name' => u.user_name
      })
    end
    
    it "should not allow deleting events on update" do
      u = User.create
      d = Device.create(:user => u)
      now = 1415689201
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, },
          {'id' => 'qwe', 'type' => 'button', 'button' => {'label' => 'like', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 8},
          {'id' => 'wer', 'type' => 'button', 'button' => {'label' => 'ok go', 'board' => {'id' => '1_1'}}, 'timestamp' => now}
        ]
      }
      l = LogSession.process_new(params, {
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc', 'qwe', 'wer'])
      expect(l.data['events'].map{|e| e['notes'] }).to eql([nil, nil, nil])
      
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, 'notes' => [
            {'note' => 'ok cool'}
          ]},
          {'id' => 'jef', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10}
        ]
      }
      l.process(params, {
        :update_only => true,
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc', 'qwe', 'wer'])
    end
    
    it "should not allow deleting notes without permission on update" do
      u = User.create
      u2 = User.create
      d = Device.create(:user => u)
      now = 1415689201
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, },
        ]
      }
      l = LogSession.process_new(params, {
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc'])
      expect(l.data['events'].map{|e| e['notes'] }).to eql([nil])
      
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, 'notes' => [
            {'note' => 'ok cool'},
            {'note' => 'never mind'}
          ]}
        ]
      }
      l.process(params, {
        :update_only => true,
        :user => u,
        :author => u2,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc'])
      notes = l.data['events'][0]['notes']
      expect(notes.length).to eql(2)
      
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, 'notes' => []}
        ]
      }
      l.process(params, {
        :update_only => true,
        :user => u,
        :author => u2,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc'])
      notes2 = l.data['events'][0]['notes']
      expect(notes2.length).to eql(2)
    end
    
    it "should allow deleting notes with permission on update" do
      u = User.create
      d = Device.create(:user => u)
      now = 1415689201
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, },
        ]
      }
      l = LogSession.process_new(params, {
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc'])
      expect(l.data['events'].map{|e| e['notes'] }).to eql([nil])
      
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, 'notes' => [
            {'note' => 'ok cool'},
            {'note' => 'never mind'}
          ]}
        ]
      }
      l.process(params, {
        :update_only => true,
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc'])
      notes = l.data['events'][0]['notes']
      expect(notes.length).to eql(2)
      
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, 'notes' => [
            notes[1]
          ]}
        ]
      }
      l.process(params, {
        :update_only => true,
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['events'].map{|e| e['id'] }).to eql(['abc'])
      notes2 = l.data['events'][0]['notes']
      expect(notes2.length).to eql(1)
      expect(notes2[0]['id']).to eql(notes[1]['id'])
    end
    
    it "should record the event's current note count and set has_note correctly" do
      u = User.create
      d = Device.create(:user => u)
      now = 1415689201
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, },
        ]
      }
      l = LogSession.process_new(params, {
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['event_note_count']).to eql(0)
      expect(l.has_notes).to eql(false)
      
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, 'notes' => [
            {'note' => 'ok cool'},
            {'note' => 'never mind'}
          ]}
        ]
      }
      l.process(params, {
        :update_only => true,
        :user => u,
        :author => u,
        :device => d
      })
      expect(l.data['event_note_count']).to eql(2)
      expect(l.has_notes).to eql(true)
    end
  end

  describe "notifications" do
    it "should return a valid set of default_listeners" do
        u = User.create
        u2 = User.create
        u3 = User.create
        User.link_supervisor_to_user(u2, u)
        User.link_supervisor_to_user(u3, u)
        u.reload
      
        d = Device.create(:user => u)
        now = 1415689201
        params = {
          'events' => [
            {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, },
          ]
        }
        l = LogSession.process_new(params, {
          :user => u,
          :author => u,
          :device => d
        })
        expect(l.default_listeners('push_message').sort).to eq([u2, u3].map(&:record_code).sort)

        l = LogSession.process_new(params, {
          :user => u,
          :author => u2,
          :device => d
        })
        expect(l.default_listeners('push_message').sort).to eq([u, u3].map(&:record_code).sort)
    end
  
    it "should notify users when a pushed message is added to their log" do
      u = User.create
      u2 = User.create
      d = Device.create(:user => u2)
      l = LogSession.process_new({
        'note' => {
          'text' => 'ahem',
          'timestamp' => 1431461182
        },
        'notify' => true
      }, {:user => u, :author => u2, :device => d})
      Worker.process_queues
      expect(u.reload.settings['unread_messages']).to eq(1)
      expect(u.settings['user_notifications']).to eq([{
        'id' => l.global_id,
        'type' => 'push_message',
        'user_name' => u.user_name,
        'author_user_name' => u2.user_name,
        'text' => 'ahem',
        'occurred_at' => "2015-05-12T20:06:22Z",
        'added_at' => Time.now.iso8601
      }])
      expect(u2.reload.settings['user_notifications']).to eq(nil)
    end
  
    it "should notify supervisors when a pushed message is added to their supervisee's log" do
      u = User.create
      u2 = User.create
      u3 = User.create
      User.link_supervisor_to_user(u3, u)
      d = Device.create(:user => u2)
      l = LogSession.process_new({
        'note' => {
          'text' => 'ahem',
          'timestamp' => 1431461182
        },
        'notify' => true
      }, {:user => u, :author => u2, :device => d})
      Worker.process_queues
      expect(u.reload.settings['unread_messages']).to eq(1)
      expect(u.settings['user_notifications']).to eq([{
        'id' => l.global_id,
        'type' => 'push_message',
        'user_name' => u.user_name,
        'author_user_name' => u2.user_name,
        'text' => 'ahem',
        'occurred_at' => "2015-05-12T20:06:22Z",
        'added_at' => Time.now.iso8601
      }])
      expect(u2.reload.settings['user_notifications']).to eq(nil)
      expect(u3.reload.settings['unread_messages']).to eq(nil)
      expect(u3.settings['user_notifications']).to eq([{
        'id' => l.global_id,
        'type' => 'push_message',
        'user_name' => u.user_name,
        'author_user_name' => u2.user_name,
        'text' => 'ahem',
        'occurred_at' => "2015-05-12T20:06:22Z",
        'added_at' => Time.now.iso8601
      }])
    end
    
    it "should email everyone except the author when a pushed message is added to a user's log" do
      u = User.create
      u2 = User.create
      u3 = User.create
      User.link_supervisor_to_user(u3, u)
      d = Device.create(:user => u2)
      l = LogSession.process_new({
        'note' => {
          'text' => 'ahem',
          'timestamp' => 1431461182
        },
        'notify' => true
      }, {:user => u, :author => u2, :device => d})

      expect(UserMailer).to receive(:schedule_delivery).with(:log_message, u.global_id, l.global_id)
      expect(UserMailer).to receive(:schedule_delivery).with(:log_message, u3.global_id, l.global_id)
      Worker.process_queues
    end
  end
  
  it "should schedule a summary processing event" do
    l = LogSession.new(:user => User.create, :device => Device.create, :author => User.create)
    l.data = {}
    now = 1415689201
    l.data['events'] = [
      {'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10},
      {'type' => 'button', 'button' => {'label' => 'like', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 8},
      {'type' => 'button', 'button' => {'label' => 'ok go', 'board' => {'id' => '1_1'}}, 'timestamp' => now}
    ]
    l.save    
    expect(Worker.scheduled?(WeeklyStatsSummary, :perform_action, {'method' => 'update_for', 'arguments' => [l.global_id]})).to eq(true)
  end
end
