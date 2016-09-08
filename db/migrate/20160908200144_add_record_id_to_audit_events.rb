class AddRecordIdToAuditEvents < ActiveRecord::Migration
  def change
    add_column :audit_events, :record_id, :string
    add_index :audit_events, [:event_type, :record_id]
  end
end
