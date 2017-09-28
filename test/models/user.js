var mongoose = require('mongoose');
var User = require('../../src/models/user');
var expect = require('chai').expect;
var should = require('chai').should;

// create test mongo database
mongoose.connect('mongodb://localhost:27017/mongotest');

describe ('TEST USER MODEL SCHEMA', function() {

	describe('userModels', function() {

		User.collection.drop();

		beforeEach(function(done) {
			var newUser = new User({
				'email' : 'test@test.com',
				'name'  : 'Test User',
				'results' : { 'wins': 0, 'losses': 0}
			});
			newUser.save(function(err) {
				done();
			});
		});

		afterEach(function(done) {
			User.collection.remove();
			done();
		});

		it('validates email address is required', function(done) {
			User.create( { 'name' : 'New Test User' }, function(err, doc) {
				expect(err.errors.email.name).to.equal('ValidatorError');
				expect(err.errors.email.kind).to.equal('required');
				expect(err.errors.email.path).to.equal('email');
				done();
			});
		});

		it('validates name is required', function(done) {
			User.create( { 'email' : 'newtest@test.com' }, function(err, doc) {
				expect(err.errors.name.name).to.equal('ValidatorError');
				expect(err.errors.name.kind).to.equal('required');
				expect(err.errors.name.path).to.equal('name');
				done();
			});
		});

		it('validates email address is unique', function(done) {
			User.create( { 'email' : 'test@test.com', 'name' : 'Test User', 'results' : { 'wins': 0, 'losses': 0} }, function(err, doc) {
				// check for code 11000, unique index error
				expect(err.code).to.equal(11000);
				done();
			});
		});

		it('finds the user by email', function(done) {
			User.find( { 'email' : 'test@test.com'}, function(err, doc) {
				expect(doc[0].email).to.equal('test@test.com');
				done();
			});
		});

		it('finds the user by name', function(done) {
			User.find( { 'name' : 'Test User'}, function(err, doc) {
				expect(doc[0].name).to.equal('Test User');
				done();
			});
		});

		it('finds the user by email and updates', function(done) {
			User.findOneAndUpdate(
			{ 'email' : 'test@test.com'},
			{ 'results' : { 'wins': 2, 'losses': 1} },
			{ 'new' : true },
				function(err, doc) {
				expect(doc.name).to.equal('Test User');
				expect(doc.results.wins).to.equal(2);
				expect(doc.results.losses).to.equal(1);
				done();
			});
		});

		it('finds the user and update win by method', function(done) {
			User.find( { 'email' : 'test@test.com'}, function(err, doc) {
				doc[0].updateRecord('win', function(err, user) {
					expect(user.results.wins).to.equal(1);
					expect(user.results.losses).to.equal(0);
					done();
				});
			});
		});

		it('finds the user and update loss by method', function(done) {
			User.find( { 'email' : 'test@test.com'}, function(err, doc) {
				doc[0].updateRecord('loss', function(err, user) {
					expect(user.results.wins).to.equal(0);
					expect(user.results.losses).to.equal(1);
					done();
				});
			});
		});

	});
});