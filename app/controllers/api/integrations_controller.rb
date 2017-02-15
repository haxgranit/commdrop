class Api::IntegrationsController < ApplicationController
  before_action :require_api_token
  
  def index
    integrations = UserIntegration.where(:template => true).order('id ASC')
    if params['user_id']
      user = User.find_by_path(params['user_id'])
      return unless exists?(user, params['user_id'])
      return unless allowed?(user, 'supervise')
      # TODO: sharding
      integrations = UserIntegration.where(:user_id => user.id).order('id DESC')
      if params['for_button']
        integrations = integrations.where(:for_button => true)
      end
    end
    render json: JsonApi::Integration.paginate(params, integrations)
  end
  
  def show
    integration = UserIntegration.find_by_path(params['id'])
    return unless exists?(integration, params['id'])
    return unless allowed?(integration, 'edit')
    render json: JsonApi::Integration.as_json(integration, {wrapper: true, permissions: @api_user})
  end
  
  def create
    user = User.find_by_path(params['integration']['user_id'])
    return unless exists?(user, params['integration']['user_id'])
    return unless allowed?(user, 'supervise')
    integration = nil
    if params['integration'] && params['integration']['integration_key']
      template = UserIntegration.find_by(template: true, integration_key: params['integration']['integration_key'])
      integration = UserIntegration.find_or_create_by(user: user, template_integration: template)
    end
    if integration
      integration.process(params['integration'], {user: user})
    else
      integration = UserIntegration.process_new(params['integration'], {user: user})
    end
    if integration.errored?
      api_error(400, {error: "integration creation failed", errors: integration && integration.processing_errors})      
    else
      render json: JsonApi::Integration.as_json(integration, {wrapper: true, permissions: @api_user})
    end
  end
  
  def update
    integration = UserIntegration.find_by_path(params['id'])
    return unless exists?(integration, params['id'])
    return unless allowed?(integration, 'edit')
    if integration.process(params['integration'])
      render json: JsonApi::Integration.as_json(integration, {wrapper: true, permissions: @api_user})
    else
      api_error(400, {error: "integration update failed", errors: integration.processing_errors})
    end
  end
  
  def destroy
    integration = UserIntegration.find_by_path(params['id'])
    return unless exists?(integration, params['id'])
    return unless allowed?(integration, 'delete')
    if integration.destroy
      render json: JsonApi::Integration.as_json(integration, {wrapper: true, permissions: @api_user})
    else
      api_error(400, {error: "integration deletion failed"})
    end
  end
end
