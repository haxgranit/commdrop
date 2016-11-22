class AddDisabledToUserBadges < ActiveRecord::Migration
  def change
    add_column :user_badges, :disabled, :boolean
    add_index :user_badges, [:disabled]
    UserBadge.update_all(:disabled => false)
  end
end
