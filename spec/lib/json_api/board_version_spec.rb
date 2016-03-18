require 'spec_helper'

describe JsonApi::BoardVersion do
  it "should have defined pagination defaults" do
    expect(JsonApi::BoardVersion::TYPE_KEY).to eq('boardversion')
    expect(JsonApi::BoardVersion::DEFAULT_PAGE).to eq(25)
    expect(JsonApi::BoardVersion::MAX_PAGE).to eq(50)
  end

  describe "build_json" do
    it "should return appropriate attributes" do
      u = User.create
      PaperTrail.whodunnit = "user:#{u.global_id}"
      b = Board.process_new({'name' => 'fred'}, {'user' => u})
      expect(b.settings['edit_description']).to eq(nil)
      b.process({'name' => 'jed'}, {'user' => u})
      expect(b.settings['edit_description']['notes']).to eq(['renamed the board'])
      PaperTrail.whodunnit = "admin:somebody@example.com"
      b.process({'buttons' => [{'id' => 1, 'label' => 'something'}]})
      expect(b.settings['edit_description']['notes']).to eq(['modified buttons'])
      PaperTrail.whodunnit = "user:#{u.global_id}"
      b.process({'name' => 'jed'}, {'user' => u})
      expect(b.settings['edit_description']).to eq(nil)
      b.destroy
      
      vs = PaperTrail::Version.where(:item_type => 'Board', :item_id => b.id)
      expect(vs.length).to eq(5)
      
      versions = Board.user_versions(b.global_id)
      expect(versions.length).to eq(5)
      
      versions_json = JsonApi::BoardVersion.paginate({}, versions)
      expect(versions_json['boardversion'].length).to eq(5)
      expect(versions_json['boardversion'][0]['action']).to eq('deleted')
      expect(versions_json['boardversion'][0]['modifier']['user_name']).to eq(u.user_name)
      expect(versions_json['boardversion'][1]['action']).to eq('updated')
      expect(versions_json['boardversion'][1]['modifier']['user_name']).to eq(u.user_name)
      expect(versions_json['boardversion'][2]['action']).to eq('modified buttons')
      expect(versions_json['boardversion'][2]['modifier']['description']).to eq('CoughDrop Admin')
      expect(versions_json['boardversion'][3]['action']).to eq('renamed the board')
      expect(versions_json['boardversion'][3]['modifier']['user_name']).to eq(u.user_name)
      expect(versions_json['boardversion'][4]['action']).to eq('created')
      expect(versions_json['boardversion'][4]['modifier']['user_name']).to eq(u.user_name)
    end
    
    it "should return appropriate version descriptions" do
      u = User.create
      PaperTrail.whodunnit = "user:#{u.global_id}"
      b = Board.process_new({'name' => 'fred'}, {'user' => u})
      expect(b.settings['edit_description']).to eq(nil)
      b.process({'name' => 'jed'}, {'user' => u})
      expect(b.settings['edit_description']['notes']).to eq(['renamed the board'])
      PaperTrail.whodunnit = "admin:somebody@example.com"
      b.process({'buttons' => [{'id' => 1, 'label' => 'something'}]})
      expect(b.settings['edit_description']['notes']).to eq(['modified buttons'])
      PaperTrail.whodunnit = "user:#{u.global_id}"
      b.process({'name' => 'jed'}, {'user' => u})
      expect(b.settings['edit_description']).to eq(nil)
      b.destroy
      
      vs = PaperTrail::Version.where(:item_type => 'Board', :item_id => b.id)
      expect(vs.length).to eq(5)
      
      versions = Board.user_versions(b.global_id)
      expect(versions.length).to eq(5)
      
      versions_json = JsonApi::BoardVersion.paginate({}, versions)
      expect(versions_json['boardversion'].length).to eq(5)
      expect(versions_json['boardversion'][0]['action']).to eq('deleted')
      expect(versions_json['boardversion'][1]['action']).to eq('updated')
      expect(versions_json['boardversion'][2]['action']).to eq('modified buttons')
      expect(versions_json['boardversion'][3]['action']).to eq('renamed the board')
      expect(versions_json['boardversion'][4]['action']).to eq('created')
    end
    
    it "should return modifier if available" do
      u = User.create
      PaperTrail.whodunnit = "user:#{u.global_id}"
      b = Board.process_new({'name' => 'fred'}, {'user' => u})
      expect(b.settings['edit_description']).to eq(nil)
      b.process({'name' => 'jed'}, {'user' => u})
      expect(b.settings['edit_description']['notes']).to eq(['renamed the board'])
      PaperTrail.whodunnit = "admin:somebody@example.com"
      b.process({'buttons' => [{'id' => 1, 'label' => 'something'}]})
      expect(b.settings['edit_description']['notes']).to eq(['modified buttons'])
      PaperTrail.whodunnit = "user:#{u.global_id}"
      b.process({'name' => 'jed'}, {'user' => u})
      expect(b.settings['edit_description']).to eq(nil)
      b.destroy
      
      vs = PaperTrail::Version.where(:item_type => 'Board', :item_id => b.id)
      expect(vs.length).to eq(5)
      
      versions = Board.user_versions(b.global_id)
      expect(versions.length).to eq(5)
      
      versions_json = JsonApi::BoardVersion.paginate({}, versions)
      expect(versions_json['boardversion'].length).to eq(5)
      expect(versions_json['boardversion'][0]['action']).to eq('deleted')
      expect(versions_json['boardversion'][0]['modifier']['user_name']).to eq(u.user_name)
      expect(versions_json['boardversion'][1]['action']).to eq('updated')
      expect(versions_json['boardversion'][1]['modifier']['user_name']).to eq(u.user_name)
      expect(versions_json['boardversion'][2]['action']).to eq('modified buttons')
      expect(versions_json['boardversion'][2]['modifier']['description']).to eq('CoughDrop Admin')
      expect(versions_json['boardversion'][3]['action']).to eq('renamed the board')
      expect(versions_json['boardversion'][3]['modifier']['user_name']).to eq(u.user_name)
      expect(versions_json['boardversion'][4]['action']).to eq('created')
      expect(versions_json['boardversion'][4]['modifier']['user_name']).to eq(u.user_name)
    end
    
    it "should return a fallback modifier if none specified" do
      u = User.create
      PaperTrail.whodunnit = "user:asdf"
      b = Board.process_new({'name' => 'fred'}, {'user' => u})
      expect(b.settings['edit_description']).to eq(nil)
      b.process({'name' => 'jed'}, {'user' => u})
      expect(b.settings['edit_description']['notes']).to eq(['renamed the board'])
      PaperTrail.whodunnit = "admin:somebody@example.com"
      b.process({'buttons' => [{'id' => 1, 'label' => 'something'}]})
      expect(b.settings['edit_description']['notes']).to eq(['modified buttons'])
      PaperTrail.whodunnit = "user:#{u.global_id}"
      b.process({'name' => 'jed'}, {'user' => u})
      expect(b.settings['edit_description']).to eq(nil)
      b.destroy
      
      vs = PaperTrail::Version.where(:item_type => 'Board', :item_id => b.id)
      expect(vs.length).to eq(5)
      
      versions = Board.user_versions(b.global_id)
      expect(versions.length).to eq(5)
      
      versions_json = JsonApi::BoardVersion.paginate({}, versions)
      expect(versions_json['boardversion'].length).to eq(5)
      expect(versions_json['boardversion'][0]['action']).to eq('deleted')
      expect(versions_json['boardversion'][0]['modifier']['user_name']).to eq(u.user_name)
      expect(versions_json['boardversion'][1]['action']).to eq('updated')
      expect(versions_json['boardversion'][1]['modifier']['user_name']).to eq(u.user_name)
      expect(versions_json['boardversion'][2]['action']).to eq('modified buttons')
      expect(versions_json['boardversion'][2]['modifier']['description']).to eq('CoughDrop Admin')
      expect(versions_json['boardversion'][3]['action']).to eq('renamed the board')
      expect(versions_json['boardversion'][3]['modifier']['description']).to eq('Unknown User')
      expect(versions_json['boardversion'][4]['action']).to eq('created')
      expect(versions_json['boardversion'][4]['modifier']['description']).to eq('Unknown User')
    end
    
    it "should include immediately upstream board ids if admin specified" do
      u = User.create
      PaperTrail.whodunnit = "user:#{u.global_id}"
      b = Board.create(:user => u)
      b2 = Board.create(:user => u)
      b2.process({'buttons' => [
        {'id' => 1, 'load_board' => {'id' => b.global_id, 'key' => b.key}}
      ]}, {'user' => u})
      PaperTrail.whodunnit = nil
      Worker.process_queues
      expect(b.reload.settings['immediately_upstream_board_ids']).to eq([b2.global_id])
      
      PaperTrail.whodunnit = "user:#{u.global_id}"
      b.process({'name' => 'jed'}, {'user' => u})
      b.destroy
      
      vs = PaperTrail::Version.where(:item_type => 'Board', :item_id => b.id)
      expect(vs.length).to eq(5)
      
      versions = Board.user_versions(b.global_id)
      expect(versions.length).to eq(3)
      
      versions_json = JsonApi::BoardVersion.paginate({}, versions, {:admin => true})
      expect(versions_json['boardversion'].length).to eq(3)
      expect(versions_json['boardversion'][0]['immediately_upstream_boards']).to eq([])
      expect(versions_json['boardversion'][1]['immediately_upstream_boards']).to eq([{:id => b2.global_id, :key => b2.key}])
      expect(versions_json['boardversion'][2]['immediately_upstream_boards']).to eq([])

      versions_json = JsonApi::BoardVersion.paginate({}, versions)
      expect(versions_json['boardversion'].length).to eq(3)
      expect(versions_json['boardversion'][0]['immediately_upstream_boards']).to eq(nil)
      expect(versions_json['boardversion'][1]['immediately_upstream_boards']).to eq(nil)
      expect(versions_json['boardversion'][2]['immediately_upstream_boards']).to eq(nil)
    end
  end
end
# 
#       u = User.create
#       b = Board.create(:user => u)
#       u.settings['preferences']['home_board'] = {'id' => b.global_id, 'key' => b.key }
#       u.save
#       
#       expect(b).to receive(:notify) do |key, hash|
#         expect(key).to eq('board_buttons_changed')
#         expect(hash['revision']).not_to eq(nil)
#       end
#       b.process({'buttons' => [
#         {'id' => 1},
#         {'id' => 2, 'load_board' => {'id' => '12345'}},
#         {'id' => 3, 'load_board' => {'id' => '12345'}},
#         {'id' => 4, 'load_board' => {'id' => '23456'}}
#       ]})

# module JsonApi::BoardVersion
#   extend JsonApi::Json
#   
#   TYPE_KEY = 'boardversion'
#   DEFAULT_PAGE = 25
#   MAX_PAGE = 50
#   
#   def self.build_json(version, args={})
#     json = {}
#     json['id'] = version.id
#     json['action'] = version.event
#     json['action'] = 'deleted' if json['action'] == 'destroy'
#     json['action'] = 'created' if json['action'] == 'create'
#     json['action'] = 'updated' if json['action'] == 'update'
#     json['created'] = version.created_at.iso8601
# 
#     bucket = ENV['STATIC_S3_BUCKET'] || "coughdrop"
#     if version.whodunnit
#       if version.whodunnit.match(/^user:/)
#         user_id = version.whodunnit.split(/:/)[1]
#         user = User.find_by_path(user_id)
#         if user
#           user_json = JsonApi::User.as_json(user, :limited_identity => true)
#           json['modifier'] = {
#             'description' => user.user_name,
#             'user_name' => user.user_name,
#             'image' => user_json['avatar_url']
#           }
#         end
#       elsif version.whodunnit.match(/^admin:/)
#         json['modifier'] = {
#           'description' => 'CoughDrop Admin',
#           'image' => "https://www.mycoughdrop.com/images/logo-big.png"
#         }
#       end
#       next_version = version.instance_variable_get('@next')
#       
#       obj = next_version && next_version.reify rescue nil
#       if obj && !obj.settings
#         obj.load_secure_object rescue nil
#       end
#       if obj && obj.settings
#         if obj.settings['edit_description'] && obj.settings['edit_description']['notes'] && obj.settings['edit_description']['notes'].length > 0
#           json['action'] = obj.settings['edit_description']['notes'].join(', ')
#         end
#         if args[:admin]
#           args[:board_lookups] ||= {}
#           upstream_ids = obj.settings['immediately_upstream_board_ids'] || []
#           upstream_boards = []
#           found_upstream_ids = []
#           upstream_ids.each do |id|
#             if args[:board_lookups][id]
#               found_upstream_ids << id 
#               upstream_boards << args[:board_lookups][id]
#             end
#           end
#           missing_upstream_ids = upstream_ids - found_upstream_ids
#           # TODO: sharding
#           missing_boards = Board.select('key, id').where(:id => Board.local_ids(missing_upstream_ids))
#           missing_boards.each do |board|
#             args[:board_lookups][board.global_id] = {
#               id: board.global_id,
#               key: board.key
#             }
#             upstream_boards << args[:board_lookups][board.global_id]
#           end
#           json['immediately_upstream_boards'] = upstream_boards
#         end
#       end
#     end
#     json['modifier'] ||= {
#       'description' => 'Unknown User',
#       'image' => "https://s3.amazonaws.com/#{bucket}/avatars/avatar-0.png"
#     }
# 
#     json
#   end
# end
