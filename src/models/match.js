'use strict';

var mongoose = require('mongoose');
var User = require('./user');
var Schema = mongoose.Schema;

var MatchSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    trim: true,
    default: 'vs',
    enum: ['vs', 'tournament']
  },
  gameDate: { type: Date, default: Date.now },
  deck_one: { 
    type: Schema.Types.ObjectId,
    ref: 'Deck',
    required: true
  },
  deck_two: { 
    type: Schema.Types.ObjectId,
    ref: 'Deck',
    required: true
  },
  story: {
    type: String,
    required: false
  },
  reason: {
    type: String,
    required: false
  },
  winner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  player_one: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  player_two: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
});

var Match = mongoose.model('Match', MatchSchema);
module.exports = Match;