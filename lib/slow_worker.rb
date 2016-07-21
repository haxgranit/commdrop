module SlowWorker
  @queue = :slow

  def self.perform(*args)
    Worker.perform_at(:slow, *args)
  end
end