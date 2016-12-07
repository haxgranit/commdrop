class Api::SnapshotsController < ApplicationController
  before_action :require_api_token

  def index
    user = User.find_by_global_id(params['user_id'])
    return unless exists?(user, params['user_id'])
    return unless allowed?(user, 'supervise')
    
    # TODO: sharding
    @snapshots = LogSnapshot.where(:user_id => user.id).order('started_at DESC')
    render json: JsonApi::Snapshot.paginate(params, @snapshots)
  end
  
  def create
    user = User.find_by_global_id(params['snapshot']['user_id'])
    return unless exists?(user, params['snapshot']['user_id'])
    return unless allowed?(user, 'edit')
    @snapshot = LogSnapshot.process_new(params['snapshot'], {:user => user})
    if @snapshot.errored?
      api_error(400, {error: "snapshot creation failed", errors: @snapshot && @snapshot.processing_errors})
    else
      render json: JsonApi::Snapshot.as_json(@snapshot, :wrapper => true, :permissions => @api_user).to_json
    end
  end
  
  def show
    @snapshot = LogSnapshot.find_by_global_id(params['id'])
    return unless exists?(@snapshot, params['id'])
    return unless allowed?(@snapshot, 'view')
    render json: JsonApi::Snapshot.as_json(@snapshot, :wrapper => true, :permissions => @api_user).to_json
  end

  def update
    @snapshot = LogSnapshot.find_by_global_id(params['id'])
    return unless exists?(@snapshot, params['id'])
    return unless allowed?(@snapshot, 'edit')
    if @snapshot.process(params['snapshot'])
      render json: JsonApi::Snapshot.as_json(@snapshot, :wrapper => true, :permissions => @api_user).to_json
    else
      api_error(400, {error: "snapshot update failed", errors: @snapshot.processing_errors})
    end
  end
  
  def destroy
    @snapshot = LogSnapshot.find_by_global_id(params['id'])
    return unless exists?(@snapshot, params['id'])
    return unless allowed?(@snapshot, 'delete')
    @snapshot.destroy
    render json: JsonApi::Snapshot.as_json(@snapshot, :wrapper => true, :permissions => @api_user).to_json
  end
end
