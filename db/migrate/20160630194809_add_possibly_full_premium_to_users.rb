class AddPossiblyFullPremiumToUsers < ActiveRecord::Migration
  def change
    add_column :users, :possibly_full_premium, :boolean
    add_index :users, [:possibly_full_premium]
  end
end
