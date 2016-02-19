module JsonApi::ButtonSet
  extend JsonApi::Json
  
  TYPE_KEY = 'buttonset'
  DEFAULT_PAGE = 1
  MAX_PAGE = 1
  
  def self.build_json(button_set, args={})
    bad_keys = (args.keys - [:wrapper, :nocache])
    raise "args not allowed because of cached responses, #{bad_keys.join(',')}" if bad_keys.length > 0
    board = button_set.board
    json = {} #board.settings
    json['id'] = board.global_id
    json['key'] = board.key
    # TODO: remove this for better perf once all apps are updated
    json['buttons'] = button_set.data['buttons']
    json['name'] = board.settings && board.settings['name']

    json
  end
end
