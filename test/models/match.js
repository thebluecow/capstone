var mongoose = require('mongoose');
var User = require('../../src/models/user');
var Match = require('../../src/models/match');
var expect = require('chai').expect;
var should = require('chai').should;

// create test mongo database
mongoose.connect('mongodb://localhost:27017/mongotest');

describe ('TEST MATCH MODEL SCHEMA', function() {

	describe('matchModels', function() {

		Match.collection.drop();
		User.collection.drop();

		var firstUser, secondUser, newMatch = null;

		beforeEach(function(done) {
			firstUser = new User({
				'email' : 'user1@test.com',
				'name'  : 'User 1',
				'results' : { 'wins': 0, 'losses': 0}
			});

			secondUser = new User({
				'email' : 'user2@test.com',
				'name'  : 'User 2',
				'results' : { 'wins': 0, 'losses': 0}
			});

			firstUser.save(function(err, user) {
				if (err) {
					console.error(err);
				}
			});

			secondUser.save(function(err, user) {
				if (err) {
					console.error(err);
				}
			});

			newMatch = new Match({
				'player_one' : firstUser._id,
				'player_two' : secondUser._id
			});

			newMatch.save(function(err, doc) {
				if (err) { console.error(err); }
				done();
			});
		});

		afterEach(function(done) {
			Match.collection.remove();
			User.collection.remove();
			firstUser, secondUser, newMatch = null;
			done();
		});

		it('validates match exists with valid users', function(done) {
			Match.findOne( { _id: newMatch._id }, function(err, doc) {
				if (err) {
					console.error(err);
				}
				//doc.player_one._id.should.exist;
				//doc.player_two._id.should.exist;
				expect(doc.type).to.equal('vs');
				done();
			});
		});

		/*it('validates name is required', function(done) {
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
		});*/

	});
});