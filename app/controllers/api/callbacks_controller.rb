require 'aws-sdk'

class Api::CallbacksController < ApplicationController
  def callback
    topic_arn = request.headers['x-amz-sns-topic-arn']
    if request.headers['x-amz-sns-message-type'] == 'SubscriptionConfirmation'
      valid_arns = (ENV['SNS_ARNS'] || '').split(/,/)
      if valid_arns.include?(topic_arn)
        token = params['Token']
        cred = Aws::Credentials.new(ENV['AWS_KEY'), ENV['AWS_SECRET'])
        Aws::SNS::Client.new(region: ENV['SNS_REGION'], credentials: cred)
        cred.confirm_subscription({topic_arn: topic_arn, token: token, authenticate_on_unsubscribe: 'true'})
      else
        api_error 400, {error: 'invalid arn'}
      end
    elsif request.headers['x-amz-sns-message-type'] == 'Notification'
      if !topic_arn
        api_error 400, {error: 'missing topic arn'}
      elsif topic_arn.match(/audio_conversion_events/) || topic_arn.match(/video_conversion_events/)
        res = Transcoder.handle_event(params)
        if res
          render json: {handled: true}
        else
          api_error 400, {error: 'event not handled'}
        end
      end
    else
      api_error 400, {error: 'unrecognized callback'}
    end
  end
end
