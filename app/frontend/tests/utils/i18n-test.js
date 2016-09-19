import { describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub } from 'frontend/tests/helpers/jasmine';
import { easyPromise, db_wait } from 'frontend/tests/helpers/ember_helper';
import i18n from '../../utils/i18n';
import Ember from 'ember';


describe("i18n", function() {
  describe("pluralize", function() {
    it("should pluralize without an inflector", function() {
      expect(i18n.pluralize).not.toEqual(null);
      expect(i18n.pluralize("cat")).toEqual("cats");
      expect(i18n.pluralize("cow")).toEqual("cows");
      expect(i18n.pluralize("wish")).toEqual("wishes");
      expect(i18n.pluralize("box")).toEqual("boxes");
      expect(i18n.pluralize("day")).toEqual("days");
    });
  });

  describe("handlebars_helpers", function() {
    it("should format dates", function() {
      var str = Ember.templateHelpers.date();
      expect(str).toMatch(/\w+ \w+ \d+, \d+:\d+ \w+/);
      str = Ember.templateHelpers.date({});
      expect(str).toMatch(/\w+ \w+ \d+, \d+:\d+ \w+/);

      var date = new Date(0 + ((new Date()).getTimezoneOffset() * 1000 * 60));
      var date_string = window.moment(date).format("MMMM Do YYYY, h:mm a");
      expect(Ember.templateHelpers.date(date, {})).toEqual(date_string);
    });
    it("should handle date_ago", function() {
      var date = new Date();
      var str = Ember.templateHelpers.date_ago(date);
      expect(str).toEqual("a few seconds ago");
      date = new Date((new Date()).getTime() - (1000 * 60 * 5));
      str = Ember.templateHelpers.date_ago(date);
      expect(str).toEqual("5 minutes ago");
    });

    it("should handle t (translation)", function() {
      var str = Ember.templateHelpers.t("happiness", {});
      expect(str.string).toEqual("happiness");

      str = Ember.templateHelpers.t("%{type} cow", {hash: {type: "happy"}, hashTypes: {}});
      expect(str.string).toEqual("happy cow");

      str = Ember.templateHelpers.t("%{num} cow", {hash: {num: 0}, hashTypes: {}});
      expect(str.string).toEqual("0 cow");
    });
    it("should not escape t results", function() {
      var str = Ember.templateHelpers.t("happi<b>ness</b>", {});
      expect(str.string).toEqual("happi<b>ness</b>");
    });
    it("should format time strings", function() {
      var str = Ember.templateHelpers.duration(null);
      expect(str).toEqual("");

      str = Ember.templateHelpers.duration(0);
      expect(str).toEqual("");

      str = Ember.templateHelpers.duration(-5);
      expect(str).toEqual("");

      str = Ember.templateHelpers.duration(5);
      expect(str).toEqual("0:05");

      str = Ember.templateHelpers.duration(23);
      expect(str).toEqual("0:23");

      str = Ember.templateHelpers.duration(90);
      expect(str).toEqual("1:30");

      str = Ember.templateHelpers.duration(3923);
      expect(str).toEqual("1:05:23");
    });
  });

  describe("t", function() {
    it("should return the entered string", function() {
      expect(i18n.t('key', "I like you")).toEqual("I like you");
      expect(i18n.t('key', "I like you a lot")).toEqual("I like you a lot");
      expect(i18n.t('key', "I like you", {})).toEqual("I like you");
    });
    it("should properly handle a count argument", function() {
      expect(i18n.t('horse', "horse", {hash: {count: 1}})).toEqual("1 horse");
      expect(i18n.t('horse', "horse", {hash: {count: 0}})).toEqual("0 horses");
      expect(i18n.t('horse', "horse", {hash: {count: 2}})).toEqual("2 horses");
    });
    it("should properly substitute variables", function() {
      expect(i18n.t('crab', "The crab is %{color}", {hash: {color: "yellow"}, hashTypes: {}})).toEqual("The crab is yellow");
      expect(i18n.t('crab', "The crab is %{color}", {hash: {color: "green"}, hashTypes: {}})).toEqual("The crab is green");
      expect(i18n.t('crab', "The crab is %{color}", {})).toEqual("The crab is %{color}");

      var context = Ember.Object.create({crab_color: "white"});
      expect(i18n.t('crab', "The crab is %{color}", {hash: {color: "crab_color"}, hashTypes: {color: 'ID'}, hashContexts: {color: context}})).toEqual("The crab is white");
    });
  });

  describe("verb negation", function() {
    it("should properly negate verbs", function() {
      expect(i18n.verb_negation('is')).toEqual("isn't");
      expect(i18n.verb_negation('am')).toEqual("am not");
      expect(i18n.verb_negation('was')).toEqual("wasn't");
      expect(i18n.verb_negation('were')).toEqual("weren't");
      expect(i18n.verb_negation('do')).toEqual("don't");
      expect(i18n.verb_negation('does')).toEqual("doesn't");
      expect(i18n.verb_negation('did')).toEqual("didn't");
      expect(i18n.verb_negation('have')).toEqual("haven't");
      expect(i18n.verb_negation('has')).toEqual("hasn't");
      expect(i18n.verb_negation('had')).toEqual("hadn't");
      expect(i18n.verb_negation('can')).toEqual("can't");
      expect(i18n.verb_negation('could')).toEqual("couldn't");
      expect(i18n.verb_negation('will')).toEqual("won't");
      expect(i18n.verb_negation('would')).toEqual("wouldn't");
      expect(i18n.verb_negation('may')).toEqual("mayn't");
      expect(i18n.verb_negation('might')).toEqual("mightn't");
      expect(i18n.verb_negation('must')).toEqual("mustn't");
      expect(i18n.verb_negation('shall')).toEqual("shan't");
      expect(i18n.verb_negation('should')).toEqual("shouldn't");
      expect(i18n.verb_negation('are')).toEqual("aren't");
    });
  });

  describe("tense", function() {
    it("should properly tensify a present-participle", function() {
      expect(i18n.tense('laugh', {present_participle: true})).toEqual("laughing");
      expect(i18n.tense('know', {present_participle: true})).toEqual("knowing");
      expect(i18n.tense('fix', {present_participle: true})).toEqual("fixing");
      expect(i18n.tense('rush', {present_participle: true})).toEqual("rushing");
      expect(i18n.tense('pass', {present_participle: true})).toEqual("passing");
      expect(i18n.tense('pit', {present_participle: true})).toEqual("pitting");
      expect(i18n.tense('begin', {present_participle: true})).toEqual("beginning");
      expect(i18n.tense('control', {present_participle: true})).toEqual("controlling");
      expect(i18n.tense('contemplate', {present_participle: true})).toEqual("contemplating");
      expect(i18n.tense('care', {present_participle: true})).toEqual("caring");
      expect(i18n.tense('bury', {present_participle: true})).toEqual("burying");
      expect(i18n.tense('hit', {present_participle: true})).toEqual("hitting");
      expect(i18n.tense('bus', {present_participle: true})).toEqual("bussing");
    });

    it("should properly tensify a simple-past", function() {
      expect(i18n.tense('laugh', {simple_past: true})).toEqual("laughed");
      expect(i18n.tense('know', {simple_past: true})).toEqual("knew");
      expect(i18n.tense('fix', {simple_past: true})).toEqual("fixed");
      expect(i18n.tense('relax', {simple_past: true})).toEqual("relaxed");
      expect(i18n.tense('sit', {simple_past: true})).toEqual("sat");
      expect(i18n.tense('put', {simple_past: true})).toEqual("put");
      expect(i18n.tense('miss', {simple_past: true})).toEqual("missed");
      expect(i18n.tense('admit', {simple_past: true})).toEqual("admitted");
      expect(i18n.tense('like', {simple_past: true})).toEqual("liked");
      expect(i18n.tense('bury', {simple_past: true})).toEqual("buried");
      expect(i18n.tense('hurry', {simple_past: true})).toEqual("hurried");
      expect(i18n.tense('hit', {simple_past: true})).toEqual("hit");
      expect(i18n.tense('bus', {simple_past: true})).toEqual("bussed");
    });

    it("should properly tensify a simple-present", function() {
      expect(i18n.tense('laugh', {simple_present: true})).toEqual("laughs");
      expect(i18n.tense('know', {simple_present: true})).toEqual("knows");
      expect(i18n.tense('fix', {simple_present: true})).toEqual("fixes");
      expect(i18n.tense('relax', {simple_present: true})).toEqual("relaxes");
      expect(i18n.tense('sit', {simple_present: true})).toEqual("sits");
      expect(i18n.tense('put', {simple_present: true})).toEqual("puts");
      expect(i18n.tense('miss', {simple_present: true})).toEqual("misses");
      expect(i18n.tense('admit', {simple_present: true})).toEqual("admits");
      expect(i18n.tense('like', {simple_present: true})).toEqual("likes");
      expect(i18n.tense('bury', {simple_present: true})).toEqual("buries");
      expect(i18n.tense('hurry', {simple_present: true})).toEqual("hurries");
      expect(i18n.tense('hit', {simple_present: true})).toEqual("hits");
      expect(i18n.tense('bus', {simple_present: true})).toEqual("buses");
    });

    it("should properly tensify a past-participle", function() {
      expect(i18n.tense('laugh', {past_participle: true})).toEqual("laughed");
      expect(i18n.tense('know', {past_participle: true})).toEqual("known");
      expect(i18n.tense('box', {past_participle: true})).toEqual("boxed");
      expect(i18n.tense('commit', {past_participle: true})).toEqual("committed");
      expect(i18n.tense('bury', {past_participle: true})).toEqual("buried");
      expect(i18n.tense('hurry', {past_participle: true})).toEqual("hurried");
      expect(i18n.tense('hit', {past_participle: true})).toEqual("hit");
      expect(i18n.tense('bus', {past_participle: true})).toEqual("bussed");
    });
  });

  describe("seconds_ago", function() {
    it("should return correct values", function() {
      expect(Ember.templateHelpers.seconds_ago(12)).toEqual("12 seconds");
      expect(Ember.templateHelpers.seconds_ago(1)).toEqual("1 second");
      expect(Ember.templateHelpers.seconds_ago(0)).toEqual("");
      expect(Ember.templateHelpers.seconds_ago(100)).toEqual("1.7 minutes");
      expect(Ember.templateHelpers.seconds_ago(5000)).toEqual("1.4 hours");
      expect(Ember.templateHelpers.seconds_ago(12600)).toEqual("3.5 hours");
      expect(Ember.templateHelpers.seconds_ago(270000)).toEqual("75 hours");
      expect(Ember.templateHelpers.seconds_ago(345800)).toEqual("96.1 hours");
      expect(Ember.templateHelpers.seconds_ago(691800)).toEqual("192.2 hours");
      expect(Ember.templateHelpers.seconds_ago(1382990)).toEqual("384.2 hours");
      expect(Ember.templateHelpers.seconds_ago(2851200)).toEqual("792 hours");
      expect(Ember.templateHelpers.seconds_ago(8553600)).toEqual("2376 hours");
      expect(Ember.templateHelpers.seconds_ago(17280000)).toEqual("4800 hours");
      expect(Ember.templateHelpers.seconds_ago(3801999)).toEqual("1056.1 hours");
      expect(Ember.templateHelpers.seconds_ago(3801500)).toEqual("1056 hours");
      expect(Ember.templateHelpers.seconds_ago(86400)).toEqual("24 hours");
      expect(Ember.templateHelpers.seconds_ago(86401)).toEqual("24 hours");
      expect(Ember.templateHelpers.seconds_ago(86399)).toEqual("24 hours");
      expect(Ember.templateHelpers.seconds_ago(100, 'long')).toEqual("1.7 minutes");
      expect(Ember.templateHelpers.seconds_ago(5000, 'long')).toEqual("1.4 hours");
      expect(Ember.templateHelpers.seconds_ago(12600, 'long')).toEqual("3.5 hours");
      expect(Ember.templateHelpers.seconds_ago(270000, 'long')).toEqual("3 days");
      expect(Ember.templateHelpers.seconds_ago(345800, 'long')).toEqual("4 days");
      expect(Ember.templateHelpers.seconds_ago(691800, 'long')).toEqual("1.1 weeks");
      expect(Ember.templateHelpers.seconds_ago(1382990, 'long')).toEqual("2.3 weeks");
      expect(Ember.templateHelpers.seconds_ago(2851200, 'long')).toEqual("4.7 weeks");
      expect(Ember.templateHelpers.seconds_ago(8553600, 'long')).toEqual("3.3 months");
      expect(Ember.templateHelpers.seconds_ago(17280000, 'long')).toEqual("6.7 months");
      expect(Ember.templateHelpers.seconds_ago(3801999, 'long')).toEqual("6.3 weeks");
      expect(Ember.templateHelpers.seconds_ago(3801500, 'long')).toEqual("6.3 weeks");
      expect(Ember.templateHelpers.seconds_ago(86400, 'long')).toEqual("1 day");
      expect(Ember.templateHelpers.seconds_ago(86401, 'long')).toEqual("1 day");
      expect(Ember.templateHelpers.seconds_ago(86399, 'long')).toEqual("1 day");
    });
  });
  describe("date", function() {
    it("should return the correct value", function() {
      var d = new Date(1474326397835);
      expect(Ember.templateHelpers.date(d, 'day')).toEqual('September 19th 2016');
      expect(Ember.templateHelpers.date(d, 'short_day')).toEqual('Sep 19th 2016');
      expect(Ember.templateHelpers.date(d, 'whatever')).toEqual('September 19th 2016, 5:06 pm');
    });
  });
});
