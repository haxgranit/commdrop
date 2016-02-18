class BoardDownstreamButtonSet < ActiveRecord::Base
  MAX_DEPTH = 10
  include Async
  include GlobalId
  include SecureSerialize
  secure_serialize :data
  belongs_to :board

  before_save :generate_defaults
  
  def generate_defaults
    self.data ||= {}
    self.data['buttons'] ||= []
    self.data['button_count'] = self.data['buttons'].length
    self.data['board_count'] = self.data['buttons'].map{|b| b['board_id'] }.uniq.length
  end
  
  def self.update_for(board_id)
    board = Board.find_by_global_id(board_id)
    if board
      set = BoardDownstreamButtonSet.find_or_create_by(:board_id => board.id)
      boards_to_visit = [{:board => board, :depth => 0, :index => 0}]
      visited_board_ids = []
      linked_board_ids = []
      all_buttons = []
      while boards_to_visit.length > 0
        bv = boards_to_visit.shift
        board_to_visit = bv[:board]
        images = board_to_visit.button_images
        visited_board_ids << board_to_visit.global_id
        # add all buttons
        board_to_visit.settings['buttons'].each_with_index do |button, idx|
          image = images.detect{|i| button['image_id'] == i.global_id }
          button_data = {
            'id' => button['id'],
            'board_id' => board_to_visit.global_id,
            'board_key' => board_to_visit.key,
            'hidden' => !!button['hidden'],
            'image' => image && image.url,
            'label' => button['label'],
            'vocalization' => button['vocalization'],
            'link_disabled' => !!button['link_disabled'],
            'depth' => bv[:depth] || 0
          }
          # check for any linked buttons
          if button['load_board'] && button['load_board']['id']
            linked_board = Board.find_by_global_id(button['load_board']['id'])
            if linked_board
              button_data['linked_board_id'] = linked_board.global_id
              button_data['linked_board_key'] = linked_board.key
            end
            # mark the first link to each board as "preferred"
            # TODO: is this a good idea? is there a better strategy? It honestly
            # shouldn't happen that much, having multiple links to the same board
            if linked_board && !linked_board_ids.include?(linked_board.global_id) && !button['hidden'] && !button['link_disabled']
              button_data['preferred_link'] = true
              linked_board_ids << button['load_board']['id']
              boards_to_visit << {:board => linked_board, :depth => bv[:depth] + 1, :index => idx} if !visited_board_ids.include?(linked_board.global_id)
            end
          end
          all_buttons << button_data
        end
        boards_to_visit.sort_by!{|bv| [bv[:depth], bv[:index]] }
      end
      set.data['buttons'] = all_buttons
      set.save
      set.schedule(:cache_buttons_json)
      set
    end
  end
  
  def cache_buttons_json
    self.data['buttons_json'] = self.data['buttons'].to_json
  end
end
