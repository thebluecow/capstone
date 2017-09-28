var mongoose = require('mongoose');
var Action = require('../../src/models/action');
var expect = require('chai').expect;
var should = require('chai').should;

// create test mongo database
mongoose.connect('mongodb://localhost:27017/mongotest');

describe ('TEST ACTION MODEL SCHEMA', function() {

	describe('actionModels', function() {

		Action.collection.drop();

		beforeEach(function(done) {
			var newAction = new Action({
				'name'  : 'MacGyver\'s Paperclip',
				'description' : 'multipurpose tool to slip past enemy lines.'
			});
			newAction.save(function(err) {
				done();
			});
		});

		afterEach(function(done) {
			Action.collection.remove();
			done();
		});

		it('validates name is required', function(done) {
			Action.create( { 'description' : 'a bendy piece of office equipment used for cleaning fingernails.' }, function(err, doc) {
				expect(err.errors.name.name).to.equal('ValidatorError');
				expect(err.errors.name.kind).to.equal('required');
				expect(err.errors.name.path).to.equal('name');
				done();
			});
		});

		it('validates name is unique', function(done) {
			Action.create( { 'name'  : 'MacGyver\'s Paperclip', 'description' : 'multipurpose tool to slip past enemy lines.' }, function(err, doc) {
				// check for code 11000, unique index error
				expect(err.code).to.equal(11000);
				done();
			});
		});

		it('validates value default is 0', function(done) {
			Action.create( { 'name'  : 'Murdock\'s trash bags', 'description' : 'I want some trash bags!' }, function(err, doc) {
				// check for code 11000, unique index error
				expect(doc.value).to.equal(0);
				done();
			});
		});

		it('validates min value is 0', function(done) {
			Action.create( { 'name'  : 'Murdock\'s trash bags', 'description' : 'I want some trash bags!', 'value': -1 }, function(err, doc) {
				// check for max errors
				expect(err.errors.value.name).to.equal('ValidatorError');
				expect(err.errors.value.kind).to.equal('min');
				expect(err.errors.value.path).to.equal('value');
				expect(err.errors.value.value).to.equal(-1);
				done();
			});
		});

		it('validates max value is 25', function(done) {
			Action.create( { 'name'  : 'Murdock\'s trash bags', 'description' : 'I want some trash bags!', 'value': 26 }, function(err, doc) {
				// check for max errors
				expect(err.errors.value.name).to.equal('ValidatorError');
				expect(err.errors.value.kind).to.equal('max');
				expect(err.errors.value.path).to.equal('value');
				expect(err.errors.value.value).to.equal(26);
				done();
			});
		});

		it('finds the action by name', function(done) {
			Action.find( { 'name' : 'MacGyver\'s Paperclip'}, function(err, doc) {
				expect(doc[0].name).to.equal('MacGyver\'s Paperclip');
				done();
			});
		});

		it('finds the action by description', function(done) {
			Action.find( { 'description' : 'multipurpose tool to slip past enemy lines.'}, function(err, doc) {
				expect(doc[0].description).to.equal('multipurpose tool to slip past enemy lines.');
				done();
			});
		});

		it('finds the action by name and updates', function(done) {
			var newAction = new Action({
				'name'  : 'MacGyver\'s Paperclip',
				'description' : 'multipurpose tool to slip past enemy lines.'
			});

			Action.findOneAndUpdate(
			{ 'name' : 'MacGyver\'s Paperclip'},
			{ 'value' : 17 },
			{ 'new' : true },
				function(err, doc) {
				expect(doc.name).to.equal('MacGyver\'s Paperclip');
				expect(doc.value).to.equal(17);
				done();
			});
		});
	});
});