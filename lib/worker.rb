module Worker
  @queue = :default

  def self.thread_id
    "#{Process.pid}_#{Thread.current.object_id}"
  end
  
  def self.schedule_for(queue, klass, method_name, *args)
    @queue = queue.to_s
    Resque.enqueue(Worker, klass.to_s, method_name, *args)
  end
  
  def self.schedule(klass, method_name, *args)
    schedule_for(:default, klass, method_name, *args)
  end
  
  def self.perform(*args)
    args_copy = [] + args
    klass_string = args_copy.shift
    klass = Object.const_get(klass_string)
    method_name = args_copy.shift
    hash = args_copy[0] if args_copy[0].is_a?(Hash)
    hash ||= {'method' => 'unknown'}
    action = "#{klass_string} . #{hash['method']} (#{hash['id']})"
    Rails.logger.info("performing #{action}")
    klass.send(method_name, *args_copy)
    Rails.logger.info("done performing #{action}")
  rescue Resque::TermException
    Resque.enqueue(self, *args)
  end
  
  def self.on_failure_retry(e, *args)
    # TODO...
  end
  
  def self.scheduled_actions(queue='default')
    idx = Resque.size(queue)
    res = []
    idx.times do |i|
      res << Resque.peek(queue, i)
    end
    res
  end
  
  def self.scheduled_for?(queue, klass, method_name, *args)
    idx = Resque.size(queue)
    idx.times do |i|
      schedule = Resque.peek(queue, i)
      if schedule && schedule['class'] == 'Worker' && schedule['args'][0] == klass.to_s && schedule['args'][1] == method_name.to_s
        if args.to_json == schedule['args'][2..-1].to_json
          return true
        end
      end
    end
    return false
  end
  
  def self.scheduled?(klass, method_name, *args)
    scheduled_for?('default', klass, method_name, *args)
  end
  
  def self.stop_stuck_workers
    timeout = 8.hours.to_i
    Resque.workers.each {|w| w.unregister_worker if w.processing['run_at'] && Time.now - w.processing['run_at'].to_time > timeout}    
  end
  
  def self.prune_dead_workers
    Resque.workers.each{|w| w.prune_dead_workers }
  end
  
  def self.kill_all_workers
    Resque.workers.each{|w| w.unregister_worker }
  end
  
  def self.process_queues
    schedules = []
    Resque.queues.each do |key|
      while Resque.size(key) > 0
        schedules << Resque.pop(key)
      end
    end
    schedules.each do |schedule|
      raise "unknown job: #{schedule.to_json}" if schedule['class'] != 'Worker'
      Worker.perform(*(schedule['args']))
    end
  end
  
  def self.queues_empty?
    found = false
    Resque.queues.each do |key|
      return false if Resque.size(key) > 0
    end
    true
  end
  
  def self.flush_queues
    if Resque.redis
      Resque.queues.each do |key|
        Resque.redis.ltrim("queue:#{key}", 1, 0)
      end
    end
  end
end