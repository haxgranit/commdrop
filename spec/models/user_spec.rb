require 'spec_helper'

describe User, :type => :model do
  describe "paper trail" do
    it "should make sure paper trail is doing its thing"
  end
  
  describe "permissions" do
    it "should always allow view_existence for valid (not deleted) users" do
      u = User.create
      u2 = User.new
      expect(u.allows?(nil, 'view_existence')).to eq(true)
      expect(u.allows?(u, 'view_existence')).to eq(true)
      expect(u.allows?(u2, 'view_existence')).to eq(true)
    end
    
    it "should allow view_detailed if public or self" do
      u = User.create
      u2 = User.new
      expect(u.allows?(nil, 'view_detailed')).to eq(false)
      expect(u.allows?(u, 'view_detailed')).to eq(true)
      expect(u.allows?(u2, 'view_detailed')).to eq(false)
      u.settings['public'] = true
      expect(u.allows?(nil, 'view_detailed')).to eq(true)
      expect(u.allows?(u, 'view_detailed')).to eq(true)
      expect(u.allows?(u2, 'view_detailed')).to eq(true)
    end
    
    it "should allow edit if self" do
      u = User.create
      u2 = User.new
      expect(u.allows?(nil, 'edit')).to eq(false)
      expect(u.allows?(u, 'edit')).to eq(true)
      expect(u.allows?(u2, 'edit')).to eq(false)
      u.settings['public'] = true
      expect(u.allows?(nil, 'edit')).to eq(false)
      expect(u.allows?(u, 'edit')).to eq(true)
      expect(u.allows?(u2, 'edit')).to eq(false)
    end
    
    it "should only allow managers view_deleted_boards" do
      u = User.create
      u2 = User.create
      expect(u.allows?(u2, 'view_deleted_boards')).to eq(false)
      User.link_supervisor_to_user(u2, u)
      expect(u.allows?(u2, 'view_deleted_boards')).to eq(true)
      
      u3 = User.create
      o = Organization.create(:admin => true)
      o.add_manager(u3.user_name, true)
      expect(u.allows?(u3.reload, 'view_deleted_boards')).to eq(true)
    end
  end
  
  describe "session_duration" do
    it "should return the default unless overridden" do
      expect(User).to be_respond_to(:default_log_session_duration)
      u = User.new
      u.settings = {}
      expect(u.log_session_duration).to eq(User.default_log_session_duration)
      u.settings['preferences'] = {'log_session_duration' => 104}
      expect(u.log_session_duration).to eq(104)
      u.settings['preferences'] = {'log_session_duration' => 106}
      expect(u.log_session_duration).to eq(106)
    end
  end
  
  describe "named_email" do
    it "should return a named email" do
      u = User.new
      u.generate_defaults
      u.settings['email'] = "bob@yahoo.com"
      expect(u.named_email).to eq("No name <bob@yahoo.com>")
    end
  end

  describe "registration_code" do
    it "should generate a registration code if it doesn't exist yet" do
      u = User.new
      c = u.registration_code
      expect(c).not_to eq(nil)
      expect(c.length).to eq(24)
      expect(u.registration_code).to eq(c)
    end
    
    it "should return the existing code if it exists" do
      u = User.new(:settings => {'registration_code' => '123wer'})
      expect(u.registration_code).to eq('123wer')
      expect(u.registration_code).to eq('123wer')
    end
  end

  describe "generate_defaults" do
    it "should generate expected defaults" do
      u = User.new
      u.generate_defaults
      expect(u.settings['name']).not_to eq(nil)
      expect(u.settings['preferences']).not_to eq(nil)
      expect(u.settings['preferences']['devices']['default']).to eq({
        'name' => 'Web browser for Desktop',
        'voice' => {'pitch' => 1.0, 'volume' => 1.0},
        'button_spacing' => 'small',
        'button_border' => 'small',
        'button_text' => 'medium',
        'vocalization_height' => 'small'
      })
      expect(u.settings['preferences']['activation_location']).to eq('end')
      expect(u.settings['preferences']['logging']).to eq(false)
      expect(u.settings['preferences']['geo_logging']).to eq(false)
      expect(u.settings['preferences']['auto_home_return']).to eq(true)
      expect(u.settings['preferences']['auto_open_speak_mode']).to eq(true)
      expect(u.user_name).to eq("no-name")
      expect(u.email_hash).not_to eq(nil)
    end
    
    it "should not override existing values" do
      u = User.new
      u.settings = {}
      u.settings['name'] = "Bob Miller"
      u.settings['preferences'] = {'devices' => {'default' => {
        'name' => 'not_browser',
        'voice' => {'pitch' => 2.0, 'volume' => 2.0},
        'auto_home_return' => false
      }}}
      u.generate_defaults
      expect(u.settings['name']).not_to eq(nil)
      expect(u.settings['preferences']).not_to eq(nil)
      expect(u.settings['preferences']['devices']['default']).to eq({
        'name' => 'not_browser',
        'voice' => {'pitch' => 2.0, 'volume' => 2.0},
        'auto_home_return' => false,
        'button_spacing' => 'small',
        'button_border' => 'small',
        'button_text' => 'medium',
        'vocalization_height' => 'small'
      })
      expect(u.user_name).to eq("bob-miller")
      expect(u.email_hash).not_to eq(nil)
      expect(u.settings['preferences']['activation_location']).to eq('end')
      u.settings['preferences']['devices']['default']['voice'] = nil
      u.generate_defaults
      expect(u.settings['preferences']['devices']['default']['voice']['pitch']).to eq(1.0)
    end
    
    it "should clear expected attributes for non-communicator role" do
      u = User.new
      u.generate_defaults
      expect(u.settings['preferences']).not_to eq(nil)
      expect(u.settings['preferences']['auto_open_speak_mode']).to eq(true)
      u.settings['preferences']['role'] = 'supporter'
      u.generate_defaults
      expect(u.settings['preferences']['auto_open_speak_mode']).to eq(nil)
    end
    
    it "should restore attributes when returned to communicator role" do
      u = User.new
      u.generate_defaults
      expect(u.settings['preferences']).not_to eq(nil)
      expect(u.settings['preferences']['auto_open_speak_mode']).to eq(true)

      u.settings['preferences']['role'] = 'supporter'
      u.generate_defaults
      expect(u.settings['preferences']['auto_open_speak_mode']).to eq(nil)

      u.settings['preferences']['role'] = 'communicator'
      u.generate_defaults
      expect(u.settings['preferences']['auto_open_speak_mode']).to eq(true)
    end
  end

  describe "generate_email_hash" do
    it "should generate a hash for any value" do
      expect(User.generate_email_hash(nil)).to eq("334c4a4c42fdb79d7ebc3e73b517e6f8")
      expect(User.generate_email_hash("")).to eq("d41d8cd98f00b204e9800998ecf8427e")
      expect(User.generate_email_hash(123)).to eq("202cb962ac59075b964b07152d234b70")
      expect(User.generate_email_hash("bob@yahoo.com")).to eq("ff38ca9b84b9f5acd849848f5dbeb1bf")
    end
  end

  describe "track_boards" do
    it "should schedule a background job by default" do
      u = User.create
      expect(u.track_boards).to eq(true)
      expect(Worker.scheduled?(User, :perform_action, {'id' => u.id, 'method' => 'track_boards', 'arguments' => [true]})).to eq(true)
    end
    
    it "should delete orphan connections" do
      u = User.create
      UserBoardConnection.create(:user_id => u.id, :board_id => 123)
      expect(UserBoardConnection.count).to eq(1)
      u.track_boards(true)
      expect(UserBoardConnection.count).to eq(0)
    end
    
    it "should trigger board updates for orphan connections" do
      u = User.create
      b = Board.create(:user => u)
      UserBoardConnection.create(:user_id => u.id, :board_id => b.id)
      expect_any_instance_of(Board).to receive(:save)
      u.track_boards(true)
    end
    
    it "should create missing connections" do
      u = User.create
      b = Board.create(:user => u)
      b2 = Board.create(:user => u)
      b.settings['buttons'] = [
        {'id' => 1, 'load_board' => {'id' => b2.global_id}}
      ]
      b.save
      expect(b.settings['immediately_downstream_board_ids']).to eq([b2.global_id])
      Worker.process_queues
      b.reload
      expect(b.settings['downstream_board_ids']).to eq([b2.global_id])
      u.settings['preferences']['home_board'] = {'id' => b.global_id}
      u.track_boards(true)
      expect(UserBoardConnection.count).to eq(2)
      expect(UserBoardConnection.find_by(:user_id => u.id, :board_id => b.id, :home => true)).not_to eq(nil)
      expect(UserBoardConnection.find_by(:user_id => u.id, :board_id => b2.id, :home => false)).not_to eq(nil)
    end
  end
        
  describe "remember_starred_board!" do
    it "should do nothing if the board no longer exists" do
      u = User.new
      expect { u.remember_starred_board!(0) }.to_not raise_error
    end
    
    it "should add to the user's list if starred" do
      u = User.create
      b = Board.create(:user => u)
      b.settings['starred_user_ids'] = [u.global_id]
      b.save
      u.remember_starred_board!(b.global_id)
      expect(u.settings['starred_board_ids']).to eq([b.global_id])
    end

    it "should not add to the user's list if already added" do
      u = User.create
      b = Board.create(:user => u)
      b.settings['starred_user_ids'] = [u.global_id]
      b.save
      u.settings['starred_board_ids'] = [b.global_id, 'ac', 'def']
      u.remember_starred_board!(b.global_id)
      expect(u.settings['starred_board_ids']).to eq([b.global_id, 'ac', 'def'])
    end
    
    it "should remove from the user's list if not starred" do
      u = User.create
      b = Board.create(:user => u)
      b.save
      u.settings['starred_board_ids'] = [b.global_id, 'ac', 'def']
      u.remember_starred_board!(b.global_id)
      expect(u.settings['starred_board_ids']).to eq(['ac', 'def'])
    end
  end

  describe "process_params" do
    it "should ignore missing parameters" do
      u = User.new
      expect { u.process_params({}, {}) }.to_not raise_error
      expect(u.settings['name']).to eq(nil)
      expect(u.settings['email']).to eq(nil)
      expect(u.settings['location']).to eq(nil)
      expect(u.settings['public']).to eq(nil)
      
      u.process_params({
        'name' => 'bob',
        'email' => 'bob@example.com',
        'public' => true
      }, {})
      expect(u.settings['name']).to eq('bob')
      expect(u.settings['email']).to eq('bob@example.com')
      expect(u.settings['location']).to eq(nil)
      expect(u.settings['public']).to eq(true)
    end
    
    it "should pipe device preferences to the correct settings" do
      u = User.new
      d = Device.create(:user => u, :developer_key_id => 0, :device_key => '1.234 Other One')
      u.process_params({
        'preferences' => {'device' => {
          'something' => '123',
          'voice' => {
            'voice_uri' => 'good_voice'
          }
        }}
      }, {'device' => d})
      expect(u.settings['preferences']['devices']).not_to eq(nil)
      expect(u.settings['preferences']['devices']['1.234 Other One']).not_to be_nil
      expect(u.settings['preferences']['devices']['1.234 Other One']['something']).to eq('123')
      expect(u.settings['preferences']['devices']['1.234 Other One']['voice']['voice_uris']).to eq(['good_voice'])

      u.process_params({
        'preferences' => {'device' => {
          'something' => '123',
          'voice' => {
            'voice_uri' => 'good_voice'
          }
        }}
      }, {})
      expect(u.settings['preferences']['devices']['default']).not_to be_nil
      expect(u.settings['preferences']['devices']['default']['something']).to eq('123')
      expect(u.settings['preferences']['devices']['default']['voice']['voice_uris']).to eq(['good_voice'])
    end
    
    it "should keep a trimmed list of old voice_uris" do
      u = User.new
      u.generate_defaults
      u.settings['preferences']['devices']['default']['voice'] = {'voice_uris' => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']}
      u.process_params({
        'preferences' => {'device' => {
          'something' => '123',
          'voice' => {
            'voice_uri' => 'good_voice'
          }
        }}
      }, {})
      expect(u.settings['preferences']['devices']['default']['voice']['voice_uris']).to eq(["good_voice", "a", "b", "c", "d", "e", "f", "g", "h", "i"])
    end
    
    it "should reset password only if allowed" do
      u = User.new
      u.settings = {}
      u.settings['password'] = {}
      expect(u.process_params({
        'password' => 'chicken'
      }, {}) ).to eq(false)
      expect( u.processing_errors ).to eq(["incorrect current password"])
      u.instance_variable_set('@processing_errors', [])

      expect( u.process_params({
        'password' => 'chicken',
        'old_password' => 'bacon'
      }, {}) ).to eq(false)
      expect( u.processing_errors ).to eq(["incorrect current password"])
      
      u.generate_password('horseradish')
      expect { u.process_params({
        'password' => 'chicken',
        'old_password' => 'horseradish'
      }, {}) }.to_not raise_error
      expect(u.valid_password?('chicken')).to eq(true)
      
      expect { u.process_params({
        'password' => 'chicken-little'
      }, {:allow_password_change => true}) }.to_not raise_error
      expect(u.valid_password?('chicken-little')).to eq(true)
      
      u.settings['password'] = nil
      expect { u.process_params({
        'password' => 'braised-beef'
      }, {}) }.to_not raise_error
      expect(u.valid_password?('braised-beef')).to eq(true)
    end
    
    it "should generate a username only if none yet and provided or forced" do
      u = User.new
      u.process_params({
      }, {:user_name => 'splendid'})
      expect(u.user_name).to eq('splendid')
      
      u.process_params({
      }, {:user_name => 'splendidly'})
      expect(u.user_name).to eq('splendidly')
      
      u.process_params({
        'user_name' => 'awkward'
      }, {})
      expect(u.user_name).to eq('splendidly')
      
      u.user_name = nil
      u.process_params({
        'user_name' => 'awkward'
      }, {})
      expect(u.user_name).to eq('awkward')
    end
    
    it "should clear unread messages only with a more-recent timestamp" do
      u = User.new
      u.settings ||= {}
      u.settings['last_message_read'] = 123
      u.settings['unread_messages'] = 4
      
      u.process_params({
        'last_message_read' => 122
      }, {})
      expect(u.settings['unread_messages']).to eq(4)
      expect(u.settings['last_message_read']).to eq(123)
      
      u.process_params({
        'last_message_read' => 124
      }, {})
      expect(u.settings['unread_messages']).to eq(0)
      expect(u.settings['last_message_read']).to eq(124)
    end
    
    it "should remember the agreement date/stamp" do
      u = User.new
      u.process_params({
      }, {});
      expect(u.settings['terms_agreed']).to eq(nil)
      
      u.process_params({'terms_agree' => true}, {})
      expect(u.settings['terms_agreed']).to eq(Time.now.to_i)
    end
  end

  describe "replace_board" do
    it "should pass the arguments to Board" do
      u = User.create
      b = Board.create(:user => u)
      b2 = Board.create(:user => u)
      expect(Board).to receive(:replace_board_for).with(u, b, b2, true)
      u.replace_board(b.global_id, b2.global_id, true)
    end
  end
    
  describe "copy_board_links" do
    it "should pass the arguments to Board" do
      u = User.create
      b = Board.create(:user => u)
      b2 = Board.create(:user => u)
      expect(Board).to receive(:copy_board_links_for).with(u, b, b2)
      u.copy_board_links(b.global_id, b2.global_id)
    end
  end
 
  describe "notify_of_changes" do
    it "should not trigger password change event on first set" do
      expect(UserMailer).not_to receive(:schedule_delivery)
      u = User.process_new(:password => 'abcdefgh')
    end
    it "should schedule a notification when a user password changes" do
      expect(UserMailer).to receive(:schedule_delivery).with(:password_changed, /\d+_\d+/).and_return(true)
      u = User.process_new(:password => 'abcdefgh')
      u.process({'old_password' => 'abcdefgh', 'password' => 'baconator'})
    end
    it "should not trigger email changed event on first set" do
      expect(UserMailer).not_to receive(:schedule_delivery)
      u = User.process_new(:email => 'bob@example.com')
    end
    it "should schedule a notification to both addresses when a user email changes" do
      expect(UserMailer).to receive(:schedule_delivery).with(:email_changed, /\d+_\d+/).and_return(true)
      u = User.process_new(:email => 'bob@example.com')
      u.process({'email' => 'fred@example.com'})
    end
  end
  
  describe "board_set_ids" do
    it "should include the user's home board and all sub-boards" do
      u = User.create
      b = Board.create(:user => u)
      b2 = Board.create(:user => u)
      b3 = Board.create(:user => u)
      b.settings['buttons'] = [
        {'id' => 1, 'load_board' => {'id' => b2.global_id}}
      ]
      b.save
      Worker.process_queues
      expect(b.reload.settings['downstream_board_ids']).to eq([b2.global_id])

      u.settings['preferences'] = {'home_board' => {'id' => b.global_id, 'key' => b.key}}
      u.save
      expect(u.reload.board_set_ids.sort).to eq([b.global_id, b2.global_id])
    end
    
    it "should include supervisee board ids if specified" do
      u = User.create
      u2 = User.create
      b = Board.create(:user => u)
      b2 = Board.create(:user => u)
      b3 = Board.create(:user => u)
      b4 = Board.create(:user => u)
      b.settings['buttons'] = [
        {'id' => 1, 'load_board' => {'id' => b2.global_id}}
      ]
      b.save
      User.link_supervisor_to_user(u, u2)
      Worker.process_queues
      expect(b.reload.settings['downstream_board_ids']).to eq([b2.global_id])

      u.settings['preferences'] = {'home_board' => {'id' => b.global_id, 'key' => b.key}}
      u.save
      u2.settings['preferences'] = {'home_board' => {'id' => b4.global_id, 'key' => b4.key}}
      u2.save
      expect(u.reload.board_set_ids(:include_supervisees => true).sort).to eq([b.global_id, b2.global_id, b4.global_id])
    end
    
    it "should include starred board ids if specified" do
      u = User.create
      u2 = User.create
      b = Board.create(:user => u)
      b2 = Board.create(:user => u)
      b3 = Board.create(:user => u)
      b4 = Board.create(:user => u)
      b.settings['buttons'] = [
        {'id' => 1, 'load_board' => {'id' => b2.global_id}}
      ]
      b.save
      User.link_supervisor_to_user(u, u2)
      Worker.process_queues
      expect(b.reload.settings['downstream_board_ids']).to eq([b2.global_id])

      u.settings['preferences'] = {'home_board' => {'id' => b.global_id, 'key' => b.key}}
      u.settings['starred_board_ids'] = ['1_4', b3.global_id]
      u.save
      u2.settings['preferences'] = {'home_board' => {'id' => b4.global_id, 'key' => b4.key}}
      u2.save
      expect(u.reload.board_set_ids(:include_starred => true).sort).to eq([b.global_id, b2.global_id, b3.global_id, '1_4'].sort)
    end
    
    it "should not include supervisee board ids if not specified" do
      u = User.create
      u2 = User.create
      b = Board.create(:user => u)
      b2 = Board.create(:user => u)
      b3 = Board.create(:user => u)
      b4 = Board.create(:user => u)
      b.settings['buttons'] = [
        {'id' => 1, 'load_board' => {'id' => b2.global_id}}
      ]
      b.save
      User.link_supervisor_to_user(u, u2)
      Worker.process_queues
      expect(b.reload.settings['downstream_board_ids']).to eq([b2.global_id])

      u.settings['preferences'] = {'home_board' => {'id' => b.global_id, 'key' => b.key}}
      u.save
      u2.settings['preferences'] = {'home_board' => {'id' => b4.global_id, 'key' => b4.key}}
      u2.save
      expect(u.reload.board_set_ids(false).sort).to eq([b.global_id, b2.global_id])
    end
    
  end
  
  describe "add_premium_voice" do
    it "should add the voice if not already claimed" do
      u = User.create
      res = u.add_premium_voice('abcd')
      expect(res).to eq(true)
      expect(u.settings['premium_voices']['claimed']).to eq(['abcd'])
    end
    
    it "should generate default values" do
      u = User.create
      res = u.add_premium_voice('abcd')
      expect(res).to eq(true)
      expect(u.settings['premium_voices']['claimed']).to eq(['abcd'])
      expect(u.settings['premium_voices']['allowed']).to eq(2)
    end
    
    it "should error if too many voices have been claimed" do
      u = User.create
      res = u.add_premium_voice('abcd')
      expect(res).to eq(true)
      res = u.add_premium_voice('abcdef')
      expect(res).to eq(true)
      res = u.add_premium_voice('abcdefg')
      expect(res).to eq(false)
      res = u.add_premium_voice('abcd')
      expect(res).to eq(true)
      expect(u.settings['premium_voices']['claimed']).to eq(['abcd', 'abcdef'])
    end
    
    it "should honor a manual change the the allowed number of voices" do
      u = User.create
      u.settings['premium_voices'] = {'claimed' => [], 'allowed' => 3}
      res = u.add_premium_voice('abcd')
      expect(res).to eq(true)
      res = u.add_premium_voice('abcdef')
      expect(res).to eq(true)
      res = u.add_premium_voice('abcdefg')
      expect(res).to eq(true)
      res = u.add_premium_voice('abcd')
      expect(res).to eq(true)
      expect(u.settings['premium_voices']['claimed']).to eq(['abcd', 'abcdef', 'abcdefg'])
    end
    
    it "should generate an AuditEvent record when a voice is added" do
      u = User.create
      u.settings['premium_voices'] = {'claimed' => [], 'allowed' => 3}
      expect(AuditEvent.count).to eq(0)
      res = u.add_premium_voice('abcd')
      expect(res).to eq(true)
      expect(AuditEvent.count).to eq(1)
      ae = AuditEvent.last
      expect(ae.event_type).to eq('voice_added')
      expect(ae.data['voice_id']).to eq('abcd')
    end
    
    it "should not generate an AuditEvent record for an already-claimed voice" do
      u = User.create
      u.settings['premium_voices'] = {'claimed' => ['abcd'], 'allowed' => 3}
      expect(AuditEvent.count).to eq(0)
      res = u.add_premium_voice('abcd')
      expect(res).to eq(true)
      expect(AuditEvent.count).to eq(0)
    end
  end
  

  describe "process_sidebar_boards" do
    it "should work on an empty list" do
      u = User.new
      u.settings = {}
      u.process_sidebar_boards([], {})
      expect(u.settings['preferences']['sidebar_boards']).to eq(nil)
      
      u.settings['preferences']['sidebar_boards'] = [{}, {}]
      u.process_sidebar_boards([], {})
      expect(u.settings['preferences']['sidebar_boards']).to eq(nil)
    end
    
    it "should filter out extra attributes" do
      u = User.create
      b = Board.create(:user => u)
      u.process_sidebar_boards([
        {
          'alert' => true,
          'bacon' => true
        },
        {
          'key' => b.key,
          'bacon' => true
        }
      ], {})
      expect(u.settings['preferences']['sidebar_boards'].length).to eq(2)
      expect(u.settings['preferences']['sidebar_boards'][0]).to eq({
        'alert' => true,
        'name' => 'Alert',
        'image' => 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/to%20sound.png'
      })
      expect(u.settings['preferences']['sidebar_boards'][1]).to eq({
        'name' => b.settings['name'],
        'key' => b.key,
        'home_lock' => false,
        'image' => 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/board_3.png'
      })
    end
    
    it "should only include each board once" do
      u = User.create
      b = Board.create(:user => u)
      u.process_sidebar_boards([
        {
          'alert' => true,
          'bacon' => true
        },
        {
          'alert' => true,
          'bacon' => true
        },
        {
          'key' => b.key,
          'home_lock' => true,
          'image' => 'http://www.example.com/pic.png',
          'name' => 'Fred',
          'bacon' => true
        },
        {
          'key' => b.key,
          'bacon' => true
        }
      ], {})
      expect(u.settings['preferences']['sidebar_boards'].length).to eq(2)
      expect(u.settings['preferences']['sidebar_boards'][1]).to eq({
        'name' => 'Fred',
        'key' => b.key,
        'home_lock' => true,
        'image' => 'http://www.example.com/pic.png'
      })
    end
    
    it "should support alert-style buttons" do
      u = User.create
      b = Board.create(:user => u)
      u.process_sidebar_boards([
        {
          'alert' => true,
          'name' => 'Ahem',
          'image' => 'http://www.example.com/pic.png'
        }
      ], {})
      expect(u.settings['preferences']['sidebar_boards'].length).to eq(1)
      expect(u.settings['preferences']['sidebar_boards'][0]).to eq({
        'alert' => true,
        'name' => 'Ahem',
        'image' => 'http://www.example.com/pic.png'
      })
    end
    
    it "should check for view permission before allowing on the sidebar" do
      u = User.create
      u2 = User.create
      b = Board.create(:user => u2)
      u.process_sidebar_boards([
        {
          'alert' => true
        },
        {
          'key' => b.key
        }
      ], {})
      expect(u.settings['preferences']['sidebar_boards'].length).to eq(1)
    end
    
    it "should automatically share with the user if the updater has permission" do
      u = User.create
      u2 = User.create
      b = Board.create(:user => u2)
      u.process_sidebar_boards([
        {
          'alert' => true
        },
        {
          'key' => b.key
        }
      ], {'updater' => u2})
      expect(b.shared_with?(u)).to eq(true)
      expect(u.settings['preferences']['sidebar_boards'].length).to eq(2)
    end
    
    it "should add buttons to prior_sidebar_boards" do
      u = User.create
      b = Board.create(:user => u)
      b2 = Board.create(:user => u)
      u.process_sidebar_boards([
        {
          'alert' => true
        },
        {
          'key' => b.key
        }
      ], {})
      expect(u.settings['preferences']['sidebar_boards'].length).to eq(2)
      expect(u.settings['preferences']['prior_sidebar_boards'].length).to eq(2)

      u.process_sidebar_boards([
        {
          'alert' => true
        },
        {
          'key' => b.key
        }
      ], {})
      expect(u.settings['preferences']['prior_sidebar_boards'].length).to eq(2)

      u.process_sidebar_boards([
        {
          'alert' => true
        },
        {
          'key' => b2.key
        }
      ], {})
      expect(u.settings['preferences']['prior_sidebar_boards'].length).to eq(3)

      u.process_sidebar_boards([
        {
          'alert' => true
        }
      ], {})
      expect(u.settings['preferences']['prior_sidebar_boards'].length).to eq(3)
    end
  end

  it "should securely serialize settings" do
    u = User.new(:settings => {:a => 2})
    u.generate_defaults
    expect(SecureJson).to receive(:dump).with(u.settings)
    u.save
  end
end
