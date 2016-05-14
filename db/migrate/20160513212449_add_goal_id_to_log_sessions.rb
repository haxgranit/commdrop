class AddGoalIdToLogSessions < ActiveRecord::Migration
  def change
    add_column :log_sessions, :goal_id, :integer
    add_index :log_sessions, [:user_id, :goal_id]
  end
end
