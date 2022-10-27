module Async
  extend ActiveSupport::Concern
  
  def schedule(method, *args)
    return nil unless method
    id = self.id
    settings = {
      'id' => id,
      'method' => method,
      'arguments' => args
    }
    Worker.schedule(self.class, :perform_action, settings)
  end
  
  def schedule_once(method, *args)
    return nil unless method && id
    already_scheduled = Worker.scheduled?(self.class, :perform_action, {
      'id' => id,
      'method' => method,
      'arguments' => args
    })
    if !already_scheduled
      schedule(method, *args)
    else
      false
    end
  end

  module ClassMethods
    def schedule(method, *args)
      return nil unless method
      settings = {
        'method' => method,
        'arguments' => args
      }
      Worker.schedule(self, :perform_action, settings)
    end
    
    def schedule_once(method, *args)
      return nil unless method
      already_scheduled = Worker.scheduled?(self, :perform_action, {
        'method' => method,
        'arguments' => args
      })
      if !already_scheduled
        schedule(method, *args)
      else
        false
      end
    end
    
    def perform_action(settings)
      obj = self
      if settings['id']
        obj = obj.find_by(:id => settings['id'].to_s)
      end
      if !obj
        # record not found so there's nothing to do on it
        # TODO: probably log this somewhere so we don't lose it..
        Rails.logger.warn "expected record not found: #{self.to_s}:#{settings['id']}"
      elsif obj.respond_to?(settings['method'])
        obj.send(settings['method'], *settings['arguments'])
      else
        id = settings['id'] ? "#{settings['id']}:" : ""
        raise "method not found: #{self.to_s}:#{id}#{settings['method']}"
      end
    end
  end
end