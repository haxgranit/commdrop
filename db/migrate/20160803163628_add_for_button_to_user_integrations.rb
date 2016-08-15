class AddForButtonToUserIntegrations < ActiveRecord::Migration
  def change
    add_column :user_integrations, :for_button, :boolean
    add_index :user_integrations, [:user_id, :for_button]
  end
end
