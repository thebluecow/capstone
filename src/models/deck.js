'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var DeckSchema = new mongoose.Schema({
  user: { "type": Schema.Types.ObjectId, "ref": "User"},
  actions: [{ "type": Schema.Types.ObjectId, "ref": "Action" }],
  createDate: { "type": Date, "default": Date.now }
});

var Deck = mongoose.model('Deck', DeckSchema);
module.exports = Deck;