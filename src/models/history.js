'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Action = require('./action');

var HistorySchema = new mongoose.Schema({
    updateDate: {
        type: Date,
        default: Date.now
    },
    actions: [{
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
        value: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
            max: 25
        }
    }]
});

// hash password before saving to database
HistorySchema.post('save', function(next) {
    Action.setValues();
});

var History = mongoose.model('History', HistorySchema);
module.exports = History;