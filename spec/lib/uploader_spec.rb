require 'spec_helper'

describe Uploader do
  describe "remote_upload" do
    it "should request upload parameters" do
      expect(Uploader).to receive(:remote_upload_params).with("bacon", "hat/beret").and_return({})
      Uploader.remote_upload("bacon", "/hat", "hat/beret")
    end
    it "should fail gracefully if the file is not found" do
      expect(Uploader.remote_upload("bacon", "/hat", "hat/beret")).to eq(nil)
    end
    
    it "should post the upload, including a file handle" do
      expect(Uploader).to receive(:remote_upload_params).with("bacon", "text/plaintext").and_return({
        :upload_params => {:a => 1, :b => 2},
        :upload_url => "http://www.upload.com/"
      })
      res = OpenStruct.new(:success? => true)
      f = Tempfile.new("stash")
      expect(Typhoeus).to receive(:post) { |url, args|
        expect(url).to eq("http://www.upload.com/")
        expect(args[:body][:a]).to eq(1)
        expect(args[:body][:b]).to eq(2)
        expect(args[:body][:file].path).to eq(f.path)
      }.and_return(res)
      Uploader.remote_upload("bacon", f.path, "text/plaintext")
      f.unlink
    end
    
    it "should return the url to the uploaded object if successful" do
      expect(Uploader).to receive(:remote_upload_params).with("bacon", "text/plaintext").and_return({
        :upload_params => {:a => 1, :b => 2},
        :upload_url => "http://www.upload.com/"
      })
      res = OpenStruct.new(:success? => true)
      f = Tempfile.new("stash")
      expect(Typhoeus).to receive(:post).and_return(res)
      expect(Uploader.remote_upload("bacon", f.path, "text/plaintext")).to eq("http://www.upload.com/bacon")
      f.unlink
    end
    it "should return nil if upload unsuccessful" do
      expect(Uploader).to receive(:remote_upload_params).with("bacon", "text/plaintext").and_return({
        :upload_params => {:a => 1, :b => 2},
        :upload_url => "http://www.upload.com/"
      })
      res = OpenStruct.new(:success? => false)
      f = Tempfile.new("stash")
      expect(Typhoeus).to receive(:post).and_return(res)
      expect(Uploader.remote_upload("bacon", f.path, "text/plaintext")).to eq(nil)
      f.unlink
    end
  end

  describe "check_existing_upload" do
    it "should do something work speccing"
  end  

  describe "remote_upload_params" do
    it "should generate signed upload parameters" do
      res = Uploader.remote_upload_params("downloads/file.png", "image/png")
      expect(res[:upload_url]).to eq(Uploader.remote_upload_config[:upload_url])
      expect(res[:upload_params]).not_to eq(nil)
      expect(res[:upload_params]['AWSAccessKeyId']).not_to eq(nil)
      expect(res[:upload_params]['Content-Type']).to eq('image/png')
      expect(res[:upload_params]['acl']).to eq('public-read')
      expect(res[:upload_params]['key']).to eq('downloads/file.png')
      expect(res[:upload_params]['policy']).not_to eq(nil)
      expect(res[:upload_params]['signature']).not_to eq(nil)
      expect(res[:upload_params]['success_action_status']).to eq('200')
    end
  end

  describe "remote_upload_config" do
    it "should return data from environment variables" do
      Uploader.instance_variable_set('@remote_upload_config', nil)
      expect(Uploader.remote_upload_config).to eq({
        :upload_url => "https://#{ENV['UPLOADS_S3_BUCKET']}.s3.amazonaws.com/",
        :access_key => ENV['AWS_KEY'],
        :secret => ENV['AWS_SECRET'],
        :bucket_name => ENV['UPLOADS_S3_BUCKET'],
        :static_bucket_name => ENV['STATIC_S3_BUCKET']
      })
    end
  end
  
  describe "signed_download_url" do
    it "should return a signed url if the object is found" do
      object = OpenStruct.new(:temporary_url => "asdfjkl")
      objects = OpenStruct.new
      expect(objects).to receive(:find).with('asdf').and_return(object)
      bucket = OpenStruct.new(:objects => objects)
      buckets = OpenStruct.new
      expect(buckets).to receive(:find).with(ENV['STATIC_S3_BUCKET']).and_return(bucket)
      service = OpenStruct.new(:buckets => buckets)
      expect(S3::Service).to receive(:new).and_return(service)
      
      expect(Uploader.signed_download_url("asdf")).to eq("asdfjkl")
    end
    
    it "should return nil if an object is not found" do
      objects = OpenStruct.new
      expect(objects).to receive(:find).with('asdf').and_return(nil)
      bucket = OpenStruct.new(:objects => objects)
      buckets = OpenStruct.new
      expect(buckets).to receive(:find).with(ENV['STATIC_S3_BUCKET']).and_return(bucket)
      service = OpenStruct.new(:buckets => buckets)
      expect(S3::Service).to receive(:new).and_return(service)
      
      expect(Uploader.signed_download_url("asdf")).to eq(nil)
    end
    
    it "should return nil if the bucket is not found" do
      buckets = OpenStruct.new
      expect(buckets).to receive(:find).with(ENV['STATIC_S3_BUCKET']).and_return(nil)
      service = OpenStruct.new(:buckets => buckets)
      expect(S3::Service).to receive(:new).and_return(service)
      
      expect(Uploader.signed_download_url("asdf")).to eq(nil)
    end
    
    it "should filter out the bucket host and protocol" do
      object = OpenStruct.new(:temporary_url => "asdfjkl")
      objects = OpenStruct.new
      expect(objects).to receive(:find).with('asdf').and_return(object).exactly(3).times
      bucket = OpenStruct.new(:objects => objects)
      buckets = OpenStruct.new
      expect(buckets).to receive(:find).with(ENV['STATIC_S3_BUCKET']).and_return(bucket).exactly(3).times
      service = OpenStruct.new(:buckets => buckets)
      expect(S3::Service).to receive(:new).and_return(service).exactly(3).times
      
      expect(Uploader.signed_download_url("asdf")).to eq("asdfjkl")
      expect(Uploader.signed_download_url("https://#{ENV['STATIC_S3_BUCKET']}.s3.amazonaws.com/asdf")).to eq("asdfjkl")
      expect(Uploader.signed_download_url("https://s3.amazonaws.com/#{ENV['STATIC_S3_BUCKET']}/asdf")).to eq("asdfjkl")
    end
  end

  describe "valid_remote_url?" do
    it "should return true only for known URLs" do
      expect(Uploader.valid_remote_url?("https://#{ENV['UPLOADS_S3_BUCKET']}.s3.amazonaws.com/bacon")).to eq(true)
      expect(Uploader.valid_remote_url?("http://#{ENV['UPLOADS_S3_BUCKET']}.s3.amazonaws.com/bacon")).to eq(false)
      expect(Uploader.valid_remote_url?("https://#{ENV['UPLOADS_S3_BUCKET']}.s3.amazonaws.com/bacon/downloads/maple.zip")).to eq(true)
      expect(Uploader.valid_remote_url?("https://s3.amazonaws.com/#{ENV['OPENSYMBOLS_S3_BUCKET']}/hat.png")).to eq(true)
      expect(Uploader.valid_remote_url?("http://s3.amazonaws.com/#{ENV['OPENSYMBOLS_S3_BUCKET']}/hat.png")).to eq(false)
      expect(Uploader.valid_remote_url?("https://s3.amazonaws.com/#{ENV['OPENSYMBOLS_S3_BUCKET']}2/hat.png")).to eq(false)
      expect(Uploader.valid_remote_url?("https://images.com/cow.png")).to eq(false)
    end
  end  
end
