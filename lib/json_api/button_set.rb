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
    # TODO: remove this for better perf once all apps are updated
    json['buttons'] = button_set.data['buttons']
    if button_set.data['buttons_json']
      json['buttons_json'] = button_set.data['buttons_json']
    else
      json['buttons_json'] = button_set.data['buttons'].to_json
    end
    json['name'] = board.settings && board.settings['name']

    json
  end
end
