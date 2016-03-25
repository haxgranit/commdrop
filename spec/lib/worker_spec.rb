require 'spec_helper'

describe Worker do
  it "should properly flush queues" do
    Worker.schedule(User, 'do_something', 2)
    Worker.flush_queues
    expect(Worker.scheduled?(User, :do_something, 2)).to eq(false)
  end
  
  describe "perform" do
    it "should parse out Worker options and call the appropriate method" do
      expect(User).to receive(:bacon).with(12)
      Worker.perform('User', 'bacon', 12)
      
      expect(Board).to receive(:halo).with(6, {a: 1})
      Worker.perform('Board', :halo, 6, {a: 1})
    end
    
    it "should run scheduled events when told" do
      Worker.schedule(User, :bacon, 12)
      Worker.schedule(Board, :halo, 6, {a: 1})
      expect(User).to receive(:bacon).with(12)
      expect(Board).to receive(:halo).with(6, {'a' => 1})
      Worker.process_queues
    end
    
    it "should catch termination exceptions and re-queue" do
      expect(User).to receive(:bacon).with(12).and_raise(Resque::TermException.new('SIGTERM'))
      Worker.schedule(User, :bacon, 12)
      Worker.process_queues
      expect(Worker.scheduled?(User, :bacon, 12)).to be_truthy
    end
  end
  
  describe "schedule" do
    it "should add to the queue" do
      Worker.schedule(User, 'do_something', 2)
      expect(Worker.scheduled?(User, :do_something, 2)).to be_truthy
      expect(Worker.scheduled?(User, :do_something, 1)).to be_falsey
      Worker.schedule(User, 'do_something', {a: 1, b: [2,3,4], c: {d: 7}})
      expect(Worker.scheduled?(User, :do_something, {a: 1, b: [2,3,4], c: {d: 7}})).to be_truthy
    end

    it "should add to a difference queue" do
      Worker.schedule_for('bacon', User, 'do_something', 2)
      expect(Worker.scheduled?(User, :do_something, 2)).to be_falsey
      expect(Worker.scheduled?(User, :do_something, 1)).to be_falsey
      expect(Worker.scheduled_for?('bacon', User, :do_something, 2)).to be_truthy
      expect(Worker.scheduled_for?('bacon', User, :do_something, 1)).to be_falsey
      Worker.schedule_for('priority', User, 'do_something', {a: 1, b: [2,3,4], c: {d: 7}})
      expect(Worker.scheduled?(User, :do_something, {a: 1, b: [2,3,4], c: {d: 7}})).to be_falsey
      expect(Worker.scheduled_for?('priority', User, :do_something, {a: 1, b: [2,3,4], c: {d: 7}})).to be_truthy
    end
    
    it "should add to the queue from async-enabled models" do
      User.schedule(:hip_hop, 16)
      u = User.create!
      u.schedule(:hip_hop, 17)
      expect(Worker.scheduled?(User, :perform_action, {'method' => 'hip_hop', 'arguments' => [16]})).to be_truthy
      expect(Worker.scheduled?(User, :perform_action, {'id' => u.id, 'method' => 'hip_hop', 'arguments' => [17]})).to be_truthy
    end
  end
end
