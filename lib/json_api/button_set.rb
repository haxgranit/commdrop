module JsonApi::ButtonSet
  extend JsonApi::Json
  
  TYPE_KEY = 'buttonset'
  DEFAULT_PAGE = 1
  MAX_PAGE = 1
  
  def self.build_json(button_set, args={})
    board = button_set.board
    json = {}
    if board
      json['id'] = board.global_id
      json['key'] = board.key
      json['name'] = board.settings && board.settings['name']
    end
    # TODO: remove this for better perf once all apps are updated
    json['buttons'] = button_set.data['buttons']
    board_ids = button_set.data['board_ids'] || button_set.data['buttons'].map{|b| b['board_id'] }.uniq
    
    # TODO: sharding
    allowed_ids = {}
    public_board_ids = 
    Board.where(:id => Board.local_ids(board_ids), :public => true).select('id').each do |b|
      allowed_ids[b.global_id] = true
    end
    if args[:permissions]
      args[:permissions].private_viewable_board_ids.each do |id|
        allowed_ids[id] = true
      end
    end
    
    json['buttons'] = json['buttons'].select{|b| allowed_ids[b['board_id']] }

    json
  end
end
