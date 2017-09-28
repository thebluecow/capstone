'use strict';

var mongoose = require('mongoose');

var ActionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
  },
  active: {
    type: Boolean,
    required: true,
    default: true
  },
  value: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 25
  },
  bonuses: {
        snow: { 
            type: Number,
            default: 0,
            min: -20,
            max: 20,
        },
        rain: { 
            type: Number,
            default: 0,
            min: -20,
            max: 20,
        },
        extreme: { 
            type: Number,
            default: 0,
            min: -20,
            max: 20,
        },
        desert: { 
            type: Number,
            default: 0,
            min: -20,
            max: 20,
        },
        jungle: { 
            type: Number,
            default: 0,
            min: -20,
            max: 20,
        },
        city: { 
            type: Number,
            default: 0,
            min: -20,
            max: 20,
        }
    }
});

// authenticate input against database documents
ActionSchema.statics.setValues = function(callback) {

  var actionValues = [];
  var totalActions = 0;

  var buildArray = function() {
    // set max to be half of totalActions
    var max = Math.floor(totalActions / 2);

    // push the same value twice since two actions
    // will have a value of 1, two of 2, etc.
    for (var i = 1; i <= max; i++) {
      actionValues.push(i);
      actionValues.push(i);
    }

    totalActions % 2 === 0 ? true : actionValues.push(max + 1);

    // call shuffle function to return the array of shuffled values
    return shuffle(actionValues);
  };

  // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  // Fisher-Yates Shuffle Algorithm
  function shuffle(array) {
      var currentIndex = array.length, temporaryValue, randomIndex;

      // While there remain elements to shuffle...
      while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
      }

      return array;
  }


  this.model("Action").find({}, function(err, actions) {
    if (err) { return callback(err); }
    totalActions = actions.length;
    buildArray();

    actions.map(action => {
      action.update( { "value" : actionValues.pop() }, function(err, result) {
        if (err) { 
          return err; 
        }
      });
    });
    if (callback) {
      return callback(null, actions);
    }
  });
}

var Action = mongoose.model('Action', ActionSchema);
module.exports = Action;