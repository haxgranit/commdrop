module JsonApi::ButtonSet
  extend JsonApi::Json
  
  TYPE_KEY = 'buttonset'
  DEFAULT_PAGE = 1
  MAX_PAGE = 1
  
  def self.build_json(button_set, args={})
    board = button_set.board
    json = {} #board.settings
    json['id'] = board.global_id
    json['key'] = board.key
    json['buttons'] = button_set.data['buttons']
    json['name'] = board.settings && board.settings['name']

    json
  end
end
