require 'spec_helper'

describe Converters::Utils do
  describe "board_to_remote" do
    it "should update progress" do
      u = User.create()
      b = Board.create(:user => u)
      expect(Uploader).to receive(:check_existing_upload).and_return("http://www.example.com/file.obf")
      expect(Progress).to receive(:update_current_progress).with(0.2, :converting_file)
      Converters::Utils.board_to_remote(b, u.global_id, 'obf', 'this')
    end
    
    it "should convert to only obf, obz or pdf" do
      u = User.create()
      b = Board.create(:user => u)
      expect(Uploader).to receive(:remote_upload).and_return("http://www.example.com/file.obf")
      res = Converters::Utils.board_to_remote(b, u.global_id, 'obf', 'this')
      expect(res).to eq("http://www.example.com/file.obf")

      expect(Uploader).to receive(:remote_upload).and_return("http://www.example.com/file.obf")
      res = Converters::Utils.board_to_remote(b, u.global_id, 'obf', 'all')
      expect(res).to eq("http://www.example.com/file.obf")

      expect(Uploader).to receive(:remote_upload).and_return("http://www.example.com/file.pdf")
      res = Converters::Utils.board_to_remote(b, u.global_id, 'pdf', 'this')
      expect(res).to eq("http://www.example.com/file.pdf")

      expect(Uploader).to receive(:remote_upload).and_return("http://www.example.com/file.obz")
      res = Converters::Utils.board_to_remote(b, u.global_id, 'obz', 'this')
      expect(res).to eq("http://www.example.com/file.obz")

      expect(Uploader).to receive(:remote_upload).and_return("http://www.example.com/file.obz")
      res = Converters::Utils.board_to_remote(b, u.global_id, 'obz', 'all')
      expect(res).to eq("http://www.example.com/file.obz")

      expect { Converters::Utils.board_to_remote(b, u.global_id, 'txt', 'this') }.to raise_error("Unrecognized conversion type: txt")
    end
    
    it "should upload the file to the remote storage service" do
      u = User.create()
      b = Board.create(:user => u)
      expect(Uploader).to receive(:remote_upload).and_return("http://www.example.com/file.obf")
      res = Converters::Utils.board_to_remote(b, u.global_id, 'obf', 'this')
      expect(res).to eq("http://www.example.com/file.obf")
    end
    
    it "should raise an error for unrecognized file types" do
      u = User.create()
      b = Board.create(:user => u)
      expect { Converters::Utils.board_to_remote(b, u.global_id, 'txt', 'this') }.to raise_error("Unrecognized conversion type: txt")
    end
    
    it "should raise an error if the upload failed" do
      u = User.create()
      b = Board.create(:user => u)
      expect(Uploader).to receive(:remote_upload).and_return(nil)
      expect { Converters::Utils.board_to_remote(b, u.global_id, 'obf', 'this') }.to raise_error("File not uploaded")
    end
  end

  describe "remote_to_boards" do
    it "should make a request to the specified url" do
      res = OpenStruct.new(:body => "bacon", :headers => {'Content-Type' => 'image/png'})
      expect(Typhoeus).to receive(:get).with("http://example.com/board").and_return(res)
      expect { Converters::Utils.remote_to_boards(nil, "http://example.com/board") }.to raise_error("Unrecognized file type: image/png")
    end
    
    it "should error on unrecognized file type" do
      res = OpenStruct.new(:body => "bacon", :headers => {'Content-Type' => 'image/png'})
      expect(Typhoeus).to receive(:get).with("http://example.com/board").and_return(res)
      expect { Converters::Utils.remote_to_boards(nil, "http://example.com/board") }.to raise_error("Unrecognized file type: image/png")
    end
    
    it "should download and process an obf file" do
      shell = Converters::Utils.obf_shell
      shell['id'] = '1234'
      shell['name'] = "Cool Board"

      res = OpenStruct.new(:body => shell.to_json, :headers => {'Content-Type' => 'application/obf'})
      expect(Typhoeus).to receive(:get).with("http://example.com/board").and_return(res)
      b = Board.new
      expect(Converters::CoughDrop).to receive(:from_obf).and_return(b)
      res = Converters::Utils.remote_to_boards(nil, "http://example.com/board")
      expect(res).to eq([b])
    end
    
    it "should download and process and obz file" do
      shell = Converters::Utils.obf_shell
      shell['id'] = '1234'
      shell['name'] = "Cool Board"

      res = OpenStruct.new(:body => shell.to_json, :headers => {'Content-Type' => 'application/obz'})
      expect(Typhoeus).to receive(:get).with("http://example.com/board").and_return(res)
      b = Board.new
      expect(Converters::CoughDrop).to receive(:from_obz).and_return([b])
      res = Converters::Utils.remote_to_boards(nil, "http://example.com/board")
      expect(res).to eq([b])
    end
  end
  
  describe "find_by_data_url" do
    it "should have specs"
  end
end
