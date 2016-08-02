class AddNeedsRemotePushToLogSessions < ActiveRecord::Migration
  def change
    add_column :log_sessions, :needs_remote_push, :boolean
    add_index :log_sessions, [:needs_remote_push]
  end
end
