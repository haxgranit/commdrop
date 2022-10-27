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
      res = OpenStruct.new(:success? => false, body: 'nothing')
      f = Tempfile.new("stash")
      expect(Typhoeus).to receive(:post).and_return(res)
      expect{ Uploader.remote_upload("bacon", f.path, "text/plaintext") }.to raise_error("nothing")
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
  
  describe "remote_remove" do
    it "should raise error on unexpected path" do
      expect{ Uploader.remote_remove("https://www.google.com/bacon") }.to raise_error("scary delete, not a path I'm comfortable deleting...")
      expect{ Uploader.remote_remove("https://s3.amazonaws.com/#{ENV['UPLOADS_S3_BUCKET']}/images/abcdefg/asdf/asdfasdf.asdf") }.to raise_error("scary delete, not a path I'm comfortable deleting...")
    end
    
    it "should remove the object if found" do
      object = OpenStruct.new
      expect(object).to receive(:destroy).and_return(true)
      objects = OpenStruct.new
      expect(objects).to receive(:find).with('images/abcdefg/asdf-asdf.asdf').and_return(object)
      bucket = OpenStruct.new({
        objects: objects
      })
      buckets = OpenStruct.new
      expect(buckets).to receive(:find).and_return(bucket)
      service = OpenStruct.new({
        buckets: buckets
      })
      expect(S3::Service).to receive(:new).and_return(service)
      res = Uploader.remote_remove("https://s3.amazonaws.com/#{ENV['UPLOADS_S3_BUCKET']}/images/abcdefg/asdf-asdf.asdf")
      expect(res).to eq(true)
    end
    
    it "should not error if the object is not found" do
      objects = OpenStruct.new
      expect(objects).to receive(:find).with('images/abcdefg/asdf-asdf.asdf').and_raise("not found")
      bucket = OpenStruct.new({
        objects: objects
      })
      buckets = OpenStruct.new
      expect(buckets).to receive(:find).and_return(bucket)
      service = OpenStruct.new({
        buckets: buckets
      })
      expect(S3::Service).to receive(:new).and_return(service)
      res = Uploader.remote_remove("https://s3.amazonaws.com/#{ENV['UPLOADS_S3_BUCKET']}/images/abcdefg/asdf-asdf.asdf")
      expect(res).to eq(nil)
    end
    
  end
  
  describe 'find_images' do
    it 'should return nothing for unknown libraries' do
      expect(Typhoeus).to_not receive(:get)
      expect(Uploader.find_images('bacon', 'cool-pics', nil)).to eq(false)
      expect(Uploader.find_images('bacon', '', nil)).to eq(false)
      expect(Uploader.find_images('bacon', nil, nil)).to eq(false)
      expect(Uploader.find_images('bacon', '   ', nil)).to eq(false)
    end
    
    it 'should return nothing for empty queries' do
      expect(Typhoeus).to_not receive(:get)
      expect(Uploader.find_images(nil, 'arasaac', nil)).to eq(false)
      expect(Uploader.find_images('', 'arasaac', nil)).to eq(false)
      expect(Uploader.find_images('    ', 'arasaac', nil)).to eq(false)
    end
    
    it 'should make a remote request' do
      res = OpenStruct.new(body: [
      ].to_json)
      expect(Typhoeus).to receive(:get).with("https://www.opensymbols.org/api/v1/symbols/search?q=bacon+repo%3Aarasaac&search_token=#{ENV['OPENSYMBOLS_TOKEN']}", :ssl_verifypeer => false).and_return(res)
      images = Uploader.find_images('bacon', 'arasaac', nil)
      expect(images).to eq([])
    end

    it 'should pass the search token' do
      res = OpenStruct.new(body: [
      ].to_json)
      expect(Typhoeus).to receive(:get).with("https://www.opensymbols.org/api/v1/symbols/search?q=bacon+repo%3Aarasaac&search_token=#{ENV['OPENSYMBOLS_TOKEN']}", :ssl_verifypeer => false).and_return(res)
      images = Uploader.find_images('bacon', 'arasaac', nil)
      expect(images).to eq([])
    end

    it 'should allow searching all public images via opensymbols key' do
      res = OpenStruct.new(body: [
      ].to_json)
      expect(Typhoeus).to receive(:get).with("https://www.opensymbols.org/api/v1/symbols/search?q=bacon&search_token=#{ENV['OPENSYMBOLS_TOKEN']}", :ssl_verifypeer => false).and_return(res)
      images = Uploader.find_images('bacon', 'opensymbols', nil)
      expect(images).to eq([])
    end

    it 'should not allow searching for pcs and marking results as from a protected source if not authorized for the user' do
      res = OpenStruct.new(body: [
      ].to_json)
      u = User.create
      expect(Typhoeus).to receive(:get).with("https://www.opensymbols.org/api/v1/symbols/search?q=bacon+repo%3Apcs&search_token=#{ENV['OPENSYMBOLS_TOKEN']}", :ssl_verifypeer => false).and_return(res)
      images = Uploader.find_images('bacon', 'pcs', u)
      expect(images).to eq([])
    end
    
    it 'should allow searching for pcs and marking results as from a protected source' do
      res = OpenStruct.new(body: [
        {
          'image_url' => 'http://www.example.com/pic.png',
          'extension' => 'png',
          'width' => '200',
          'height' => '200',
          'id' => '123',
          'license' => 'public_domain',
          'license_url' => 'http://www.example.com/cc0',
          'source_url' => 'http://www.example.com/pics',
          'author' => 'bob',
          'author_url' => 'http://www.example.com/bob'
        }
      ].to_json)
      u = User.create
      User.purchase_extras({'user_id' => u.global_id})
      u.reload
      expect(Typhoeus).to receive(:get).with("https://www.opensymbols.org/api/v1/symbols/search?q=bacon+repo%3Apcs&search_token=#{ENV['OPENSYMBOLS_TOKEN']}:pcs", :ssl_verifypeer => false).and_return(res)
      images = Uploader.find_images('bacon', 'pcs', u)
      expect(images).to eq([{
        'url' => 'http://www.example.com/pic.png',
        'thumbnail_url' => 'http://www.example.com/pic.png',
        'content_type' => 'image/png',
        'width' => '200',
        'height' => '200',
        'external_id' => '123',
        'public' => true,
        'protected' => true,
        'protected_source' => 'pcs',
        'license' => {
          'type' => 'public_domain',
          'copyright_notice_url' => 'http://www.example.com/cc0',
          'source_url' => 'http://www.example.com/pics',
          'author_name' => 'bob',
          'author_url' => 'http://www.example.com/bob',
          'uneditable' => true
        }
      }])
    end
    
    it 'should parse results' do
      res = OpenStruct.new(body: [
        {
          'image_url' => 'http://www.example.com/pic.png',
          'extension' => 'png',
          'width' => '200',
          'height' => '200',
          'id' => '123',
          'license' => 'public_domain',
          'license_url' => 'http://www.example.com/cc0',
          'source_url' => 'http://www.example.com/pics',
          'author' => 'bob',
          'author_url' => 'http://www.example.com/bob'
        }
      ].to_json)
      expect(Typhoeus).to receive(:get).with("https://www.opensymbols.org/api/v1/symbols/search?q=bacon+repo%3Aarasaac&search_token=#{ENV['OPENSYMBOLS_TOKEN']}", :ssl_verifypeer => false).and_return(res)
      images = Uploader.find_images('bacon', 'arasaac', nil)
      expect(images).to eq([{
        'url' => 'http://www.example.com/pic.png',
        'thumbnail_url' => 'http://www.example.com/pic.png',
        'content_type' => 'image/png',
        'width' => '200',
        'height' => '200',
        'external_id' => '123',
        'public' => true,
        'protected' => false,
        'protected_source' => nil,
        'license' => {
          'type' => 'public_domain',
          'copyright_notice_url' => 'http://www.example.com/cc0',
          'source_url' => 'http://www.example.com/pics',
          'author_name' => 'bob',
          'author_url' => 'http://www.example.com/bob',
          'uneditable' => true
        }
      }])
    end
    
    it 'should handle pixabay searches' do
      ENV['PIXABAY_KEY'] = 'pixkey'
      res = OpenStruct.new(body: {'hits' => [
        {
          'webformatURL' => 'http://www.example.com/pic.png',
          'webformatWidth' => 200,
          'webformatHeight' => 200,
          'id' => '123',
          'pageURL' => 'http://www.example.com/pics',
        }, {
          'webformatURL' => 'http://www.example.com/pic2.jpg',
          'webformatWidth' => 123,
          'webformatHeight' => 234,
          'id' => '1234',
          'pageURL' => 'http://www.example.com/pics2',
        }]}.to_json)
      expect(Typhoeus).to receive(:get).with('https://pixabay.com/api/?key=pixkey&q=bacon&image_type=vector&per_page=30&safesearch=true', :ssl_verifypeer => false).and_return(res)
      images = Uploader.find_images('bacon', 'pixabay_vectors', nil)
      expect(images).to eq([{
        'url' => 'http://www.example.com/pic.png',
        'thumbnail_url' => 'http://www.example.com/pic.png',
        'content_type' => 'image/png',
        'width' => 200,
        'height' => 200,
        'external_id' => '123',
        'public' => true,
        'license' => {
          'type' => 'public_domain',
          'copyright_notice_url' => 'https://creativecommons.org/publicdomain/zero/1.0/',
          'source_url' => 'http://www.example.com/pics',
          'author_name' => 'unknown',
          'author_url' => 'https://creativecommons.org/publicdomain/zero/1.0/',
          'uneditable' => true
        }
      }, {
        'url' => 'http://www.example.com/pic2.jpg',
        'thumbnail_url' => 'http://www.example.com/pic2.jpg',
        'content_type' => 'image/jpeg',
        'width' => 123,
        'height' => 234,
        'external_id' => '1234',
        'public' => true,
        'license' => {
          'type' => 'public_domain',
          'copyright_notice_url' => 'https://creativecommons.org/publicdomain/zero/1.0/',
          'source_url' => 'http://www.example.com/pics2',
          'author_name' => 'unknown',
          'author_url' => 'https://creativecommons.org/publicdomain/zero/1.0/',
          'uneditable' => true
        }
      }])
    end
    
    it "should handle lessonpix searches" do
      expect(Uploader).to receive(:lessonpix_credentials).with(nil).and_return(nil)
      expect(Uploader.find_images('bacon', 'lessonpix', nil)).to eq(false)
      
      u = User.create
      expect(Uploader).to receive(:lessonpix_credentials).with(u).and_return({
        'username' => 'pocatello',
        'pid' => '99999',
        'token' => 'for_the_team'
      }).exactly(2).times
      expect(Typhoeus).to receive(:get).with("http://lessonpix.com/apiKWSearch.php?pid=99999&username=pocatello&token=for_the_team&word=bacon&fmt=json&allstyles=n&limit=30").and_return(OpenStruct.new(body: 'Token Mismatch'))
      expect(Uploader.find_images('bacon', 'lessonpix', u)).to eq(false)

      expect(Typhoeus).to receive(:get).with("http://lessonpix.com/apiKWSearch.php?pid=99999&username=pocatello&token=for_the_team&word=cheddar&fmt=json&allstyles=n&limit=30").and_return(OpenStruct.new(body: [
        {'iscategory' => 't'},
        {
          'image_id' => '2345',
          'title' => 'good pic'
        }
      ].to_json))
      expect(Uploader.find_images('cheddar', 'lessonpix', u)).to eq([
        {
          'url' => "#{JsonApi::Json.current_host}/api/v1/users/#{u.global_id}/protected_image/lessonpix/2345",
          'thumbnail_url' => "https://lessonpix.com/drawings/2345/100x100/2345.png",
          'content_type' => 'image/png',
          'name' => 'good pic',
          'width' => 300,
          'height' => 300,
          'external_id' => '2345',
          'public' => false,
          'protected' => true,
          'protected_source' => 'lessonpix',
          'license' => {
            'type' => 'private',
            'source_url' => "http://lessonpix.com/pictures/2345/good+pic",
            'author_name' => 'LessonPix',
            'author_url' => 'http://lessonpix.com',
            'uneditable' => true,
            'copyright_notice_url' => 'http://lessonpix.com/articles/11/28/LessonPix+Terms+and+Conditions'
          }
        }
      ])
    end
    
    it "should handle giphy searches" do
      ENV['GIPHY_KEY'] = 'giphy'
      expect(Typhoeus).to receive(:get).with("http://api.giphy.com/v1/gifs/search?q=%23asl+bacon&api_key=giphy").and_return(OpenStruct.new({
        body: {
          data: [
            {
              slug: 'signwithrobert',
              url: 'http://www.example.com/pic1',
              username: 'bob',
              user: {profile_url: 'http://www.example.com/bob'},
              images: {
                original: {url: 'http://www.example.com/pic1.gif', width: 100, height: 100},
                downsized_still: {url: 'http://www.example.com/pic1-small.gif'}
              }
            },
            {
              slug: 'asl-is-cool',
              url: 'http://www.example.com/pic2',
              username: 'sue',
              user: {profile_url: 'http://www.example.com/sue'},
              images: {
                original: {url: 'http://www.example.com/pic2.gif', width: 100, height: 100},
                downsized_still: {url: 'http://www.example.com/pic2-small.gif'}
              }
            },
            {
              slug: 'good-stuff',
              url: 'http://www.example.com/pic3',
              username: 'max',
              user: {profile_url: 'http://www.example.com/max'},
              images: {
                original: {url: 'http://www.example.com/pic3.gif', width: 100, height: 100},
                downsized_still: {url: 'http://www.example.com/pic3-small.gif'}
              }
            },
            {
              slug: 'signwithrobert',
              url: 'http://www.example.com/pic4',
              username: 'ren',
              user: {profile_url: 'http://www.example.com/ren'},
              images: {
                original: {url: 'http://www.example.com/pic4.gif', width: 100, height: 100},
                downsized_still: {url: 'http://www.example.com/pic4-small.gif'}
              }
            }
          ]
        }.to_json
      }))
      expect(Uploader.find_images('bacon', 'giphy_asl', nil)).to eq([
        {
          'url' => 'https://www.example.com/pic1.gif',
          'thumbnail_url' => 'https://www.example.com/pic1-small.gif',
          'content_type' => 'image/gif',
          'width' => 100,
          'height' => 100,
          'public' => false,
          'license' => {
            'type' => 'private',
            'copyright_notice_url' => 'https://giphy.com/terms',
            'source_url' => 'http://www.example.com/pic1',
            'author_name' => 'bob',
            'author_url' => 'http://www.example.com/bob',
            'uneditable' => true
          }
        },
        {
          'url' => 'https://www.example.com/pic2.gif',
          'thumbnail_url' => 'https://www.example.com/pic2-small.gif',
          'content_type' => 'image/gif',
          'width' => 100,
          'height' => 100,
          'public' => false,
          'license' => {
            'type' => 'private',
            'copyright_notice_url' => 'https://giphy.com/terms',
            'source_url' => 'http://www.example.com/pic2',
            'author_name' => 'sue',
            'author_url' => 'http://www.example.com/sue',
            'uneditable' => true
          }
        },
        {
          'url' => 'https://www.example.com/pic4.gif',
          'thumbnail_url' => 'https://www.example.com/pic4-small.gif',
          'content_type' => 'image/gif',
          'width' => 100,
          'height' => 100,
          'public' => false,
          'license' => {
            'type' => 'private',
            'copyright_notice_url' => 'https://giphy.com/terms',
            'source_url' => 'http://www.example.com/pic4',
            'author_name' => 'ren',
            'author_url' => 'http://www.example.com/ren',
            'uneditable' => true
          }
        }
      ])
    end
        
    it 'should schedule caching action for returned results' do
      expect(Uploader).to receive(:lessonpix_credentials).with(nil).and_return(nil)
      expect(Uploader.find_images('bacon', 'lessonpix', nil)).to eq(false)
      
      u = User.create
      expect(Uploader).to receive(:lessonpix_credentials).with(u).and_return({
        'username' => 'pocatello',
        'pid' => '99999',
        'token' => 'for_the_team'
      }).exactly(2).times
      expect(Typhoeus).to receive(:get).with("http://lessonpix.com/apiKWSearch.php?pid=99999&username=pocatello&token=for_the_team&word=bacon&fmt=json&allstyles=n&limit=30").and_return(OpenStruct.new(body: 'Token Mismatch'))
      expect(Uploader.find_images('bacon', 'lessonpix', u)).to eq(false)

      expect(Typhoeus).to receive(:get).with("http://lessonpix.com/apiKWSearch.php?pid=99999&username=pocatello&token=for_the_team&word=cheddar&fmt=json&allstyles=n&limit=30").and_return(OpenStruct.new(body: [
        {'iscategory' => 't'},
        {
          'image_id' => '2345',
          'title' => 'good pic'
        }
      ].to_json))
      expect(JsonApi::Json).to receive(:current_host).and_return("http://test.host")
      expect(Worker).to receive(:schedule_for).with(:slow, ButtonImage, :perform_action, {'method' => 'assert_cached_copies', 'arguments' => [["http://test.host/api/v1/users/#{u.global_id}/protected_image/lessonpix/2345"]]})
      expect(Uploader.find_images('cheddar', 'lessonpix', u)).to eq([
        {
          'url' => "http://test.host/api/v1/users/#{u.global_id}/protected_image/lessonpix/2345",
          'thumbnail_url' => "https://lessonpix.com/drawings/2345/100x100/2345.png",
          'content_type' => 'image/png',
          'name' => 'good pic',
          'width' => 300,
          'height' => 300,
          'external_id' => '2345',
          'public' => false,
          'protected' => true,
          'protected_source' => 'lessonpix',
          'license' => {
            'type' => 'private',
            'source_url' => "http://lessonpix.com/pictures/2345/good+pic",
            'author_name' => 'LessonPix',
            'author_url' => 'http://lessonpix.com',
            'uneditable' => true,
            'copyright_notice_url' => 'http://lessonpix.com/articles/11/28/LessonPix+Terms+and+Conditions'
          }
        }
      ])
    end
  end

  describe "lessonpix_credentials" do
    it "should return the correct value" do
      ENV['LESSONPIX_PID'] = nil
      ENV['LESSONPIX_SECRET'] = nil
      expect(Uploader.lessonpix_credentials({})).to eq(nil)
      ENV['LESSONPIX_PID'] = '90123'
      expect(Uploader.lessonpix_credentials({})).to eq(nil)
      ENV['LESSONPIX_SECRET'] = 'asdfuiop'
      expect(Uploader.lessonpix_credentials({})).to eq({
        'username' => nil,
        'pid' => '90123',
        'token' => 'e64ff981c5100fe1d0ed87f3fc029890'
      })
      expect(Uploader.lessonpix_credentials(nil)).to eq(nil)
      expect(Uploader.lessonpix_credentials('asdf')).to eq(nil)
      expect(Uploader.lessonpix_credentials({'username' => 'fred', 'password' => 'passy'})).to eq({
        'username' => 'fred',
        'pid' => '90123',
        'token' => Digest::MD5.hexdigest(Digest::MD5.hexdigest('passy') + 'asdfuiop')
      })
      template = UserIntegration.create(template: true, integration_key: 'lessonpix')
      u = User.create
      ui = UserIntegration.create(user: u, template_integration: template)
      secret, salt = GoSecure.encrypt('secretss', 'integration_password')

      ui.settings['user_settings'] = {
        'username' => {'value' => 'susan'},
        'password' => {'value_crypt' => secret, 'salt' => salt}
      }
      ui.save
      expect(Uploader.lessonpix_credentials(ui)).to eq({
        'username' => 'susan',
        'pid' => '90123',
        'token' => Digest::MD5.hexdigest('secretss' + 'asdfuiop')
      })
      expect(Uploader.lessonpix_credentials(u)).to eq({
        'username' => 'susan',
        'pid' => '90123',
        'token' => Digest::MD5.hexdigest('secretss' + 'asdfuiop')
      })
    end
  end
  
  describe "found_image_url" do
    it "should return the correct value" do
      u = User.create
      expect(Uploader).to receive(:lessonpix_credentials).with(u).and_return({
        'username' => 'amelia',
        'pid' => 'qwert',
        'token' => 'tokenss'
      })
      expect(Uploader.found_image_url('asdf', 'lessonpix', u)).to eq("https://lessonpix.com/apiGetImage.php?pid=qwert&username=amelia&token=tokenss&image_id=asdf&h=300&w=300&fmt=png")
      
      expect(Uploader).to receive(:lessonpix_credentials).with(nil).and_return(nil)
      expect(Uploader.found_image_url('qwer', 'lessonpix', nil)).to eq(nil)
    end
  end
  
  describe "protected_remote_url?" do
    it "should return a correct result" do
      expect(Uploader.protected_remote_url?('http://www.example.com')).to eq(false)
      expect(Uploader.protected_remote_url?('/api/v1/users/bob/protected_image/a/b')).to eq(true)
    end
  end
  
  describe "remote_zip" do
    it "should call the block with the loaded zip" do
      expect(OBF::Utils).to receive(:load_zip).and_yield({zipper: true})
      res = OpenStruct.new(body: 'abc')
      expect(Typhoeus).to receive(:get).with('http://www.example.com/import.zip').and_return(res)
      Uploader.remote_zip('http://www.example.com/import.zip') do |zipper|
        expect(zipper).to eq({zipper: true})
      end
    end
  end
 
  describe "generate_zip" do
    class TestZipper
      def add(filename, data)
        @files ||= []
        @files << [filename, data]
      end
      
      def files
        @files
      end
    end
    
    it "should return the known url if known" do
      hash = Digest::MD5.hexdigest([].to_json)
      key = GoSecure.sha512(hash, 'url_list')
      expect(Uploader).to receive(:check_existing_upload).with("downloads/#{key}/zippy.zip").and_return('http://www.example.com/zip.zip')
      res = Uploader.generate_zip([], 'zippy.zip')
      expect(res).to eq('http://www.example.com/zip.zip')
    end
    
    it "should add urls to the zip" do
      zipper = TestZipper.new
      expect(OBF::Utils).to receive(:build_zip).and_yield(zipper)
      expect(Uploader).to receive(:remote_upload).and_return('http://www.example.com/import.zip')
      expect(OBF::Utils).to receive(:get_url).with('http://www.example.com/pic.png').and_return({'data' => 'data:image/png;base64,R0lGODdh'})
      res = Uploader.generate_zip([
        {
          'name' => 'file.png',
          'url' => 'http://www.example.com/pic.png'
        },
        {
          'name' => 'file2.png',
          'data' => 'data:image/png;base64,R0lGODdh'
        }
      ], 'zippy.zip')
      expect(res).to eq('http://www.example.com/import.zip')
      expect(zipper.files).to eq([
        ['file.png', 'data:image/png;base64,R0lGODdh'],
        ['file2.png', 'data:image/png;base64,R0lGODdh']
      ])
    end
  end
  
  describe "find_resources" do
    it 'should return an empty list by default' do
      expect(Uploader.find_resources('bacon', 'something', nil)).to eq([])
      expect(Uploader.find_resources('bacon', 'whatever', nil)).to eq([])
      expect(Uploader.find_resources('bacon', nil, nil)).to eq([])
    end
    
    it 'should search for tarheel results' do
      expect(Typhoeus).to receive(:get).with("https://tarheelreader.org/find/?search=bacon&category=&reviewed=R&audience=E&language=en&page=1&json=1").and_return(OpenStruct.new(body: {
        books: [
          {
            'link' => '/bacon1',
            'cover' => {
              'url' => '/bacon.png'
            },
            'title' => 'Bacon One',
            'author' => 'Amir',
            'slug' => 'bacon-1',
            'ID' => '12345'
          },
          {
            'link' => '/bacon2',
            'cover' => {
              'url' => '/bacon.png'
            },
            'title' => 'Bacon Two',
            'author' => 'Radish',
            'slug' => 'bacon-2',
            'ID' => '123456'
          }
        ]
      }.to_json))
      expect(Uploader.find_resources('bacon', 'tarheel', nil)).to eq([
        {
          'url' => 'https://tarheelreader.org/bacon1',
          'image' => 'https://tarheelreader.org/bacon.png',
          'title' => 'Bacon One',
          'author' => 'Amir',
          'id' => 'bacon-1',
          'image_attribution' => 'https://tarheelreader.org/photo-credits/?id=12345'
        },
        {
          'url' => 'https://tarheelreader.org/bacon2',
          'image' => 'https://tarheelreader.org/bacon.png',
          'title' => 'Bacon Two',
          'author' => 'Radish',
          'id' => 'bacon-2',
          'image_attribution' => 'https://tarheelreader.org/photo-credits/?id=123456'
        }
      ])
    end
    
    it 'should return tarheel book pages' do
      expect(Typhoeus).to receive(:get).with("https://tarheelreader.org/book-as-json/?slug=bacon-1", {:followlocation=>true}).and_return(OpenStruct.new(headers: {}, body: {
        'slug' => 'bacon-1',
        'ID' => '12345',
        'link' => '/bacon',
        'pages' => [
          {
            'text' => 'Bacon is Yummy',
            'url' => '/bacon-yum.png'
          },
          {
            'text' => 'I Love Bacon',
            'url' => '/heart.png'
          },
          {
            'text' => 'We Should Get Some Bacon',
            'url' => '/shopping.png'
          }
        ]
      }.to_json))
      expect(Uploader.find_resources('bacon-1', 'tarheel_book', nil)).to eq([
        {
          'id' => 'bacon-1-0',
          'title' => 'Bacon is Yummy',
          'image' => 'https://tarheelreader.org/bacon-yum.png',
          'image_content_type' => 'image/jpeg',
          'url' => 'https://tarheelreader.org/bacon',
          'image_attribution' => 'https://tarheelreader.org/photo-credits/?id=12345',
          'image_author' => 'Flickr User'
        },
        {
          'id' => 'bacon-1-1',
          'title' => 'I Love Bacon',
          'image' => 'https://tarheelreader.org/heart.png',
          'image_content_type' => 'image/jpeg',
          'url' => 'https://tarheelreader.org/bacon',
          'image_attribution' => 'https://tarheelreader.org/photo-credits/?id=12345',
          'image_author' => 'Flickr User'
        },
        {
          'id' => 'bacon-1-2',
          'title' => 'We Should Get Some Bacon',
          'image' => 'https://tarheelreader.org/shopping.png',
          'image_content_type' => 'image/jpeg',
          'url' => 'https://tarheelreader.org/bacon',
          'image_attribution' => 'https://tarheelreader.org/photo-credits/?id=12345',
          'image_author' => 'Flickr User'
        }
      ])
    end

    it "should return custom book pages" do
      expect(Typhoeus).to receive(:get).with("http://www.example.com/book.json", {:followlocation=>true}).and_return(OpenStruct.new(headers: {}, body: {
        "book_url": "http://github.com/whitmer",
        "author": "Brian",
        "attribution_url": "http://github.com/whitmer",
        "pages": [
          {
            "id": "title_page",
            "text": "Test Book",
            "image_url": "https://s3.amazonaws.com/opensymbols/libraries/noun-project/Test-Tube_89_g.svg",
            "image_content_type": "image/svg",
            "image_attribution_url": "http://creativecommons.org/licenses/by/3.0/us/",
            "image_attribution_author": "Hopkins"
          },
          {
            "id": "page_1",
            "text": "I like cats",
            "image_url": "https://s3.amazonaws.com/opensymbols/libraries/mulberry/cat.svg",
            "image_content_type": "image/svg",
            "image_attribution_url": "http://creativecommons.org/licenses/by-sa/2.0/uk",
            "image_attribution_author": "Paxtoncrafts Charitable Trust"
          },
          {
            "id": "page_2",
            "text": "Actually I really prefer dogs",
            "image_url": "https://s3.amazonaws.com/opensymbols/libraries/arasaac/dog.png",
            "image_content_type": "image/png",
            "image_attribution_url": "http://creativecommons.org/licenses/by-nc-sa/3.0/",
            "image_attribution_author": "ARASAAC"
          }
        ]
      }.to_json))
      expect(Uploader.find_resources('http://www.example.com/book.json', 'tarheel_book', nil)).to eq([
        {
          'id' => 'title_page',
          'title' => 'Test Book',
          'image' => 'https://s3.amazonaws.com/opensymbols/libraries/noun-project/Test-Tube_89_g.svg',
          'image_content_type' => 'image/svg',
          'url' => 'http://github.com/whitmer',
          'image_attribution' => 'http://creativecommons.org/licenses/by/3.0/us/',
          'image_author' => 'Hopkins'
        },
        {
          'id' => 'page_1',
          'title' => 'I like cats',
          'image' => 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/cat.svg',
          'image_content_type' => 'image/svg',
          'url' => 'http://github.com/whitmer',
          'image_attribution' => 'http://creativecommons.org/licenses/by-sa/2.0/uk',
          'image_author' => 'Paxtoncrafts Charitable Trust'
        },
        {
          'id' => 'page_2',
          'title' => 'Actually I really prefer dogs',
          'image' => 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/dog.png',
          'image_content_type' => 'image/png',
          'url' => 'http://github.com/whitmer',
          'image_attribution' => 'http://creativecommons.org/licenses/by-nc-sa/3.0/',
          'image_author' => 'ARASAAC'
        }
      ])
    end
  end
  
  describe "fronted_url" do
    it 'should return nil on nil' do
      expect(Uploader.fronted_url(nil)).to eq(nil)
    end
    
    it 'should return the same url on no match' do
      expect(Uploader.fronted_url('asdf')).to eq('asdf')
      expect(Uploader.fronted_url('http://www.example.com/pig.png')).to eq('http://www.example.com/pig.png')
    end
    
    it 'should return the CDN url if matching' do
      expect(ENV).to receive('[]').with('UPLOADS_S3_BUCKET').and_return(nil).at_least(1).times
      expect(ENV).to receive('[]').with('UPLOADS_S3_CDN').and_return('bacon').at_least(1).times
      expect(ENV).to receive('[]').with('OPENSYMBOLS_S3_BUCKET').and_return('cheese').at_least(1).times
      expect(ENV).to receive('[]').with('OPENSYMBOLS_S3_CDN').and_return('https://abc.cdn.com').at_least(1).times
      expect(Uploader.fronted_url('https://cheese.s3.amazonaws.com/c/d/pic.png')).to eq('https://abc.cdn.com/c/d/pic.png')
      expect(Uploader.fronted_url('https://cheese.s3.amazonaws.com/pic.png')).to eq('https://abc.cdn.com/pic.png')
      expect(Uploader.fronted_url('https://s3.amazonaws.com/cheese/c/d/pic.png')).to eq('https://abc.cdn.com/c/d/pic.png')
    end
  end
end
