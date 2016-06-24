class Api::UnitsController < ApplicationController
  before_filter :require_api_token

  def index
    org = Organization.find_by_global_id(params['organization_id'])
    return unless exists?(org, params['organization_id'])
    return unless allowed?(org, 'edit')
    
    # TODO: sharding
    @units = OrganizationUnit.where(:organization_id => org.id).order('position, id ASC')
    @units = @units.to_a.sort_by{|u| (u.settings['name'] || 'Unnamed Room').downcase }
    render json: JsonApi::Unit.paginate(params, @units)
  end
  
  def create
    org = Organization.find_by_global_id(params['unit']['organization_id'])
    return unless exists?(org, params['unit']['organization_id'])
    return unless allowed?(org, 'edit')
    @unit = OrganizationUnit.process_new(params['unit'], {:organization => org})
    if @unit.errored?
      api_error(400, {error: "unit creation failed", errors: @unit && @unit.processing_errors})
    else
      render json: JsonApi::Unit.as_json(@unit, :wrapper => true, :permissions => @api_user).to_json
    end
  end
  
  def show
    @unit = OrganizationUnit.find_by_global_id(params['id'])
    return unless exists?(@unit, params['id'])
    return unless allowed?(@unit, 'view')
    render json: JsonApi::Unit.as_json(@unit, :wrapper => true, :permissions => @api_user).to_json
  end

  def update
    @unit = OrganizationUnit.find_by_global_id(params['id'])
    return unless exists?(@unit, params['id'])
    return unless allowed?(@unit, 'edit')
    if @unit.process(params['unit'])
      render json: JsonApi::Unit.as_json(@unit, :wrapper => true, :permissions => @api_user).to_json
    else
      api_error(400, {error: "unit update failed", errors: @unit.processing_errors})
    end
  end
  
  def destroy
    @unit = OrganizationUnit.find_by_global_id(params['id'])
    return unless exists?(@unit, params['id'])
    return unless allowed?(@unit, 'delete')
    @unit.destroy
    render json: JsonApi::Unit.as_json(@unit, :wrapper => true, :permissions => @api_user).to_json
  end
end
