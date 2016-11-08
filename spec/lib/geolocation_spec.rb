require 'spec_helper'

describe Geolocation do
  describe "find_places" do
    it "should query for matching places based on the specified location" do
      expect(Geolocation.find_places(0, 0)).to eq([])
    end
  end
end
