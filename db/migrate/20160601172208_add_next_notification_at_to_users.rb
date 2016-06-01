class AddNextNotificationAtToUsers < ActiveRecord::Migration
  def change
    add_column :users, :next_notification_at, :datetime
    add_index :users, [:next_notification_at]
  end
end
