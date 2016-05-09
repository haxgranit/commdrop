module JsonApi::Log
  extend JsonApi::Json
  
  TYPE_KEY = 'log'
  DEFAULT_PAGE = 10
  MAX_PAGE = 25
    
  def self.build_json(log, args={})
    json = {}
    
    json['id'] = log.global_id
    json['pending'] = true if !log.global_id
    json['type'] = log.log_type
    json['started_at'] = log.started_at.iso8601 if log.started_at
    json['ended_at'] = log.ended_at.iso8601 if log.ended_at
    json['time_id'] = (log.started_at || 0).to_i
    if log.author
      json['author'] = {
        'id' => log.author.global_id,
        'user_name' => log.author.user_name
      }
    else
      json['author'] = {
        'user_name' => 'unknown'
      }
    end
    if log.user
      json['user'] = {
        'id' => log.user.global_id,
        'user_name' => log.user.user_name
      }
    else
      json['user'] = {
        'user_name' => 'unknown'
      }
    end
    
    if log.data['note']
      json['note'] = log.data['note']
      if log.data['note']['video'] && args[:permissions]
        video = UserVideo.find_by_global_id(log.data['note']['video']['id'])
        if video && video.url
          json['video'] = video.summary_hash
        end
      end
    elsif log.data['assessment']
      json['percent'] = log.data['stats']['percent_correct']
      json['assessment'] = {
        'description' => log.data['assessment']['description'],
        'summary' => log.data['assessment']['summary']
      }
    else
      json['duration'] = log.data['duration']
      json['button_count'] = log.data['button_count']
      json['utterance_count'] = log.data['utterance_count']
      json['utterance_word_count'] = log.data['utterance_word_count']
    end

    json['event_note_count'] = log.data['event_note_count'] || 0
    json['summary'] = log.data['event_summary']
    json
  end
  
  def self.extra_includes(log, json, args={})
    json['log']['events'] = []
    
    if log.data['geo'] && log.user && log.user.settings['preferences'] && log.user.settings['preferences']['geo_logging']
      json['log']['geo'] = {
        'latitude' => log.data['geo'][0],
        'longitude' => log.data['geo'][1]
      }
    end
    json['log']['geo_cluster_id'] = log.geo_cluster && log.geo_cluster.global_id
    json['log']['ip_cluster_id'] = log.ip_cluster && log.ip_cluster.global_id
    
    if log.data['readable_ip_address']
      json['log']['readable_ip_address'] = log.data['readable_ip_address']
    end

    (log.data['events'] || []).each do |event|
      entry = {}
      entry['id'] = event['id']
      entry['timestamp'] = event['timestamp']
      if event['button']
        entry['type'] = 'button'
        entry['spoken'] = !!event['button']['spoken']
        entry['summary'] = event['button']['label']
        if entry['summary'] == ':complete' && event['button']['completion']
          entry['summary'] += " (#{event['button']['completion']})"
        end
        entry['parts_of_speech'] = event['parts_of_speech']
        if event['button']['percent_x'] && event['button']['percent_y'] && event['button']['board']
          entry['touch_percent_x'] = event['button']['percent_x']
          entry['touch_percent_y'] = event['button']['percent_y']
          entry['board'] = event['button']['board']
        end
      elsif event['action']
        entry['type'] = 'action'
        entry['summary'] = "[#{event['action']['action']}]"
        if event['action']['action'] == 'open_board'
          entry['new_board'] = event['action']['new_id']
        end
      elsif event['utterance']
        entry['type'] = 'utterance'
        entry['summary'] = "[vocalize]"
      else
        entry['type'] = 'other'
        entry['summary'] = "unrecognized event"
      end
      if event['notes']
        entry['notes'] = event['notes'].map do |n|
          {
            'id' => n['id'],
            'note' => n['note'],
            'author' => {
              'id' => n['author']['id'],
              'user_name' => n['author']['user_name']
            }
          }
        end
      end
      json['log']['events'] << entry
    end
    
    if json['log']['type'] == 'assessment'
      json['log']['assessment'] = log.data['assessment']
      json['log']['assessment']['stats'] = log.data['stats']
    end
    
    if json['log']['type'] == 'session'
      device = {
        'name' => "Unknown device",
        'id' => nil
      }
      if log.device
        device['name'] = log.device.settings['name']
        device['id'] = log.device.global_id
      end
      json['log']['device'] = device
    end
    
    next_log = LogSession.where(['user_id = ? AND started_at >= ? AND id != ?', log.user_id, log.started_at, log.id]).order('started_at ASC, id').limit(1)[0]
    if next_log
      json['log']['next_log_id'] = next_log.global_id
    end
    previous_log = LogSession.where(['user_id = ? AND started_at <= ? AND id != ?', log.user_id, log.started_at, log.id]).order('started_at DESC, id').limit(1)[0]
    if previous_log
      json['log']['previous_log_id'] = previous_log.global_id
    end
    json['log']['nonce'] = log.require_nonce
    
    json
  end

  def self.paginate_meta(params, json)
    {:user_id => params['user_id'], :type => params['type'], :start => params['start'], :end => params['end'], :device_id => params['device_id'], :location_id => params['location_id']}
  end
end
