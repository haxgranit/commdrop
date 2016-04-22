require 'spec_helper'

describe Api::CallbacksController, :type => :controller do
  describe 'callback' do
    it 'should error on confirming invalid arn' do
      expect(ENV).to receive('[]').with('SNS_ARNS').and_return('bacon,fried')
      request.headers['x-amz-sns-message-type'] = 'SubscriptionConfirmation'
      request.headers['x-amz-sns-topic-arn'] = 'ham'
      post 'callback'
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json).to eq({'error' => 'invalid arn', 'status' => 400})
    end
    
    it 'should succeed on confirming valid arn' do
      ENV['SNS_ARNS'] = 'bacon,fried'
      ENV['AWS_KEY'] = 'nonsense'
      ENV['AWS_SECRET'] = 'shhhhhh'
      ENV['SNS_REGION'] = 'overthere'
      expect(Aws::Credentials).to receive(:new).with('nonsense', 'shhhhhh').and_return('creds')
      client = OpenStruct.new
      expect(Aws::SNS::Client).to receive(:new).with(region: 'overthere', credentials: 'creds').and_return(client)
      expect(client).to receive(:confirm_subscription).with(topic_arn: 'fried', token: 'ahem', authenticate_on_unsubscribe: 'true')
      request.headers['x-amz-sns-message-type'] = 'SubscriptionConfirmation'
      request.headers['x-amz-sns-topic-arn'] = 'fried'
      post 'callback', :Token => 'ahem'
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json).to eq({'confirmed' => true})
    end
    
    it "should ping back subscription confirmation" do
      ENV['SNS_ARNS'] = 'bacon,fried'
      ENV['AWS_KEY'] = 'nonsense'
      ENV['AWS_SECRET'] = 'shhhhhh'
      ENV['SNS_REGION'] = 'overthere'
      expect(Aws::Credentials).to receive(:new).with('nonsense', 'shhhhhh').and_return('creds')
      client = OpenStruct.new
      expect(Aws::SNS::Client).to receive(:new).with(region: 'overthere', credentials: 'creds').and_return(client)
      expect(client).to receive(:confirm_subscription).with(topic_arn: 'fried', token: 'ahem', authenticate_on_unsubscribe: 'true')
      request.headers['x-amz-sns-message-type'] = 'SubscriptionConfirmation'
      request.headers['x-amz-sns-topic-arn'] = 'fried'
      post 'callback', :Token => 'ahem'
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json).to eq({'confirmed' => true})
    end
    
    it "should error on notification missing arn" do
      request.headers['x-amz-sns-message-type'] = 'Notification'
      post 'callback'
      expect(response).to_not be_success
      json = JSON.parse(response.body)
      expect(json).to eq({'error' => 'missing topic arn', 'status' => 400})
    end
    
    it "should error on unrecognized callback" do
      request.headers['x-amz-sns-message-type'] = 'SomethingDifferent'
      post 'callback'
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json).to eq({'error' => 'unrecognized callback', 'status' => 400})
    end
    
    it "should error on unhandled transcoding event" do
      request.headers['x-amz-sns-message-type'] = 'Notification'
      request.headers['x-amz-sns-topic-arn'] = 'fried:audio_conversion_events:chicken'
      expect(Transcoder).to receive(:handle_event){|params|
        expect(params[:a]).to eq('1')
      }.and_return(false)
      post 'callback', {a: 1}
      expect(response).to_not be_success
      json = JSON.parse(response.body)
      expect(json).to eq({'error' => 'event not handled', 'status' => 400})
    end
    
    it "should succeed on handled transcoding event" do
      request.headers['x-amz-sns-message-type'] = 'Notification'
      request.headers['x-amz-sns-topic-arn'] = 'fried:audio_conversion_events:chicken'
      expect(Transcoder).to receive(:handle_event){|params|
        expect(params[:a]).to eq('1')
      }.and_return(true)
      post 'callback', {a: 1}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json).to eq({'handled' => true})
    end
    
    it "should handle transcoding" do
      bs = ButtonSound.create(:settings => {
        'full_filename' => 'a/4/3/0.wav'
      })
      prefix = bs.file_prefix + "-" + Time.now.to_i.to_s
      expect(Worker.scheduled?(Transcoder, :convert_audio, bs.global_id, prefix)).to eq(true)
      config = OpenStruct.new
      expect(bs.settings['transcoding_attempted']).to eq(true)
      job = OpenStruct.new
      job.id = 'onetwo'
      resp = OpenStruct.new
      resp.job = job
      expect(config).to receive(:create_job){|job_args|
        expect(job_args[:pipeline_id]).to eq('')
        expect(job_args[:user_metadata]).to_not eq(nil)
        expect(job_args[:input]).to_not eq(nil)
        expect(job_args[:output]).to_not eq(nil)
        expect(job_args[:output][:preset_id]).to eq(Transcoder::AUDIO_PRESET)
        expect(job_args[:user_metadata]).to_not eq(nil)
        expect(job_args[:user_metadata][:conversion_type]).to eq('audio')
        expect(job_args[:user_metadata][:audio_id]).to eq(bs.global_id)
        job.user_metadata = job_args[:user_metadata].with_indifferent_access
        job.outputs = [OpenStruct.new(job_args[:output])]
        job.outputs[0].duration = 111
      }.and_return(resp)
      
      expect(config).to receive(:read_job).with({id: 'onetwo'}).and_return(resp)
      expect(Transcoder).to receive(:config).and_return(config)

      Worker.process_queues

      request.headers['x-amz-sns-message-type'] = 'Notification'
      request.headers['x-amz-sns-topic-arn'] = 'fried:audio_conversion_events:chicken'
      post 'callback', {
        'jobId' => 'onetwo',
        'state' => 'COMPLETED'
      }
#      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json).to eq({'handled' => true})
      bs.reload
      expect(bs.settings['full_filename']).to eq('')
      expect(bs.settings['content_type']).to eq('audio/mp3')
      expect(bs.settings['duration']).to eq(111)
    end
  end
end
#       self.settings['full_filename'] = opts['filename']
#       self.settings['content_type'] = opts['content_type']
#       self.settings['duration'] = opts['duration']
#       self.settings['thumbnail_filename'] = opts['thumbnail_filename']


# require 'aws-sdk'
# 
# module Transcoder
#   def self.handle_event(args)
#     job = config.read_job({id: args['jobId']})
#     return false if !job || !job.user_metadata
#     progress = Progress.find_by_global_id(job.user_metadata['progress_id'])
#     record = nil
#     new_record = {}
#     if job.user_metadata['conversion_type'] == 'audio'
#       record = ButtonSound.find_by_global_id(job.user_metadata['audio_id'])
#       new_record['filename'] = job.outputs[0].key
#       new_record['duration'] = job.outputs[0].duration
#       new_record['content_type'] = 'audio/mp3'
#     elsif job.user_metadata['conversion_type'] == 'video'
#       record = ButtonSound.find_by_global_id(job.user_metadata['video_id'])
#       new_record['filename'] = job.outputs[0].key
#       new_record['duration'] = job.outputs[0].duration
#       new_record['content_type'] = 'video/mp4'
#       new_record['thumbnail_filename'] = job.outputs[0].key + '.0000.png'
#     else
#       return false
#     end
#     if args['state'] == 'COMPLETED'
#       record.update_media_object(new_record) if record
#     elsif args['state'] == 'ERROR'
#       # record the error on the record
#       record.media_object_error({code: args['errorCode'], job: args['jobId']})
#     end
#     return true
#   end
#   
#   AUDIO_PRESET = '1351620000001-300040' # MP3 - 128k
#   VIDEO_PRESET = '1351620000001-000030' # MP4 480p 4:3
#   
#   def self.convert_audio(button_sound_id, prefix)
#     button_sound = ButtonSound.find_by_global_id(button_sound_id)
#     return false unless button_sound
#     config = self.config
#     res = config.create_job({
#       pipeline_id: '',
#       input: {
#         key: button_sound.full_filename
#       },
#       output: {
#         key: "#{prefix}.mp3",
#         preset_id: AUDIO_PRESET 
#       },
#       user_metadata: {
#         audio_id: button_sound.global_id,
#         conversion_type: 'audio'
#       }
#     })
#     {job_id: res.job.id}
#   end
#   
#   def self.convert_video(video_id, prefix)
#     video = nil
#     return false unless video
#     config = self.config
#     res = config.create_job({
#       pipeline_id: '',
#       input: {
#         key: video.full_filename
#       },
#       output: {
#         key: "#{prefix}.mp4",
#         preset_id: VIDEO_PRESET,
#         thumbnail_pattern: "#{prefix}.mp4.{count}"
#       },
#       user_metadata: {
#         audio_id: video.global_id,
#         conversion_type: 'video'
#       }
#     })
#     {job_id: res.job.id}
#   end
#   
#   def self.config
#     cred = Aws::Credentials.new((ENV['TRANSCODER_KEY'] || ENV['AWS_KEY']), (ENV['TRANSCODER_SECRET'] || ENV['AWS_SECRET']))
#     Aws::ElasticTranscoder::Client.new(region: ENV['TRANSCODER_REGION'], credentials: cred)
#   end
# end

# us-east-1

# require 'aws-sdk'
# 
# class Api::CallbacksController < ApplicationController
#   def callback
#     topic_arn = request.headers['x-amz-sns-topic-arn']
#     if request.headers['x-amz-sns-message-type'] == 'SubscriptionConfirmation'
#       valid_arns = (ENV['SNS_ARNS'] || '').split(/,/)
#       if valid_arns.include?(topic_arn)
#         token = params['Token']
#         cred = Aws::Credentials.new(ENV['AWS_KEY'), ENV['AWS_SECRET'])
#         Aws::SNS::Client.new(region: ENV['SNS_REGION'], credentials: cred)
#         cred.confirm_subscription({topic_arn: topic_arn, token: token, authenticate_on_unsubscribe: 'true'})
#       else
#         api_error 400, {error: 'invalid arn'}
#       end
#     elsif request.headers['x-amz-sns-message-type'] == 'Notification'
#       if !topic_arn
#         api_error 400, {error: 'missing topic arn'}
#       elsif topic_arn.match(/audio_conversion_events/) || topic_arn.match(/video_conversion_events/)
#         res = Transcoder.handle_event(params)
#         if res
#           render json: {handled: true}
#         else
#           api_error 400, {error: 'event not handled'}
#         end
#       end
#     else
#       api_error 400, {error: 'unrecognized callback'}
#     end
#   end
# end
