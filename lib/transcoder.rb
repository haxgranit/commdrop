require 'aws-sdk'

module Transcoder
  def self.handle_event(args)
    res = config.read_job({id: args['jobId']})
    job = res && res.job
    return false if !job || !job.user_metadata
    progress = Progress.find_by_global_id(job.user_metadata['progress_id'])
    record = nil
    new_record = {}
    if job.user_metadata['conversion_type'] == 'audio'
      record = ButtonSound.find_by_global_id(job.user_metadata['audio_id'])
      new_record['filename'] = job.outputs[0].key
      new_record['duration'] = job.outputs[0].duration
      new_record['content_type'] = 'audio/mp3'
    elsif job.user_metadata['conversion_type'] == 'video'
#      record = ButtonSound.find_by_global_id(job.user_metadata['video_id'])
      new_record['filename'] = job.outputs[0].key
      new_record['duration'] = job.outputs[0].duration
      new_record['content_type'] = 'video/mp4'
      new_record['thumbnail_filename'] = job.outputs[0].key + '.0000.png'
    else
      return false
    end
    if args['state'] == 'COMPLETED'
      record.update_media_object(new_record) if record
    elsif args['state'] == 'ERROR'
      # record the error on the record
      record.media_object_error({code: args['errorCode'], job: args['jobId']})
    end
    return true
  end
  
  AUDIO_PRESET = '1351620000001-300040' # MP3 - 128k
  VIDEO_PRESET = '1351620000001-000030' # MP4 480p 4:3
  
  def self.convert_audio(button_sound_id, prefix)
    button_sound = ButtonSound.find_by_global_id(button_sound_id)
    return false unless button_sound
    config = self.config
    res = config.create_job({
      pipeline_id: ENV['TRANSCODER_AUDIO_PIPELINE'],
      input: {
        key: button_sound.full_filename
      },
      output: {
        key: "#{prefix}.mp3",
        preset_id: AUDIO_PRESET 
      },
      user_metadata: {
        audio_id: button_sound.global_id,
        conversion_type: 'audio'
      }
    })
    {job_id: res.job.id}
  end
  
  def self.convert_video(video_id, prefix)
    video = nil
    return false unless video
    config = self.config
    res = config.create_job({
      pipeline_id: '',
      input: {
        key: video.full_filename
      },
      output: {
        key: "#{prefix}.mp4",
        preset_id: VIDEO_PRESET,
        thumbnail_pattern: "#{prefix}.mp4.{count}"
      },
      user_metadata: {
        audio_id: video.global_id,
        conversion_type: 'video'
      }
    })
    {job_id: res.job.id}
  end
  
  def self.config
    cred = Aws::Credentials.new((ENV['TRANSCODER_KEY'] || ENV['AWS_KEY']), (ENV['TRANSCODER_SECRET'] || ENV['AWS_SECRET']))
    Aws::ElasticTranscoder::Client.new(region: (ENV['TRANSCODER_REGION'] || ENV['AWS_REGION']), credentials: cred)
  end
end

# us-east-1