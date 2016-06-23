class CreateOrganizationUnits < ActiveRecord::Migration
  def change
    create_table :organization_units do |t|
      t.integer :organization_id
      t.text :settings
      t.integer :position

      t.timestamps null: false
    end
    add_index :organization_units, [:organization_id, :position]
  end
end
