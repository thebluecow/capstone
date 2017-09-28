
'use strict';

var _stories = {
    "draw": [{
            "story": ["WINNER, your pathetic attempts at world domination were countered at ever turn.",
                " What's worse is that OPPONENT laughed at your feeble attempts and is now more emboldened than ever.",
                " Perhaps next time you should choose more carefully before picking on the neighborhood bully and now having",
                " your lunch money stolen daily. I would suggest training, starting with an opponent more equal to your skill",
                " level--Alf, perhaps--and trying anew. Just not on this server. We're ashamed of you."
            ]
        },
        {
            "story": ["WINNER, you came. You saw. You conquered...the time tested art of negotiation. Seeing that OPPONENT was of equal",
                " strength, you wisely chose to call your duel a draw and live to fight another day. Will this gain you honor in",
                " the eyes of your friends and family? Perhaps not. They are shortsighted and narrowminded. They are the type of",
                " people that buy cereal simply for the toys. Not you. Eat your Wheaties, friend. Reach for the stars. Perhaps",
                " next time you'll conquer your foe and win adulation for your clan."
            ]
        }
    ],
    "momentum": [{
            "story": ["Few things in life are as rewarding as absolute domination, and in this respect WINNER excels. OPPONENT was",
                " overmatched at every turn, and in the end, OPPONENT decided that surrendering was the best course of action. Would",
                " someone with actual courage do such a thing? No. But OPPONENT was never one to possess much courage while WINNER measures",
                " courage by the APC full. Congratulations WINNER. Of all the opponents you could have chosen this day, you found the most",
                " craven, and that, my friend, is a real talent!"
            ]
        },
        {
            "story": ["We're ashamed for OPPONENT. We've combed through the records and found little evidence to support that",
                " OPPONENT exists on our servers. Did WINNER invent this person? Surrender? Sometimes people have bad days. You roll out of bed.",
                " You slip on a banana peel. You veer into a truckload of manure. We understand. WINNER dominated OPPONENT so thoroughly",
                " that OPPONENT was seen weeping in the corner with a sun-warmed glass of Kool Aid and a worn copy of the Tao Te Ching.",
                " Perhaps combat isn't their specialty? Perk up, OPPONENT. Tomorrow you start your new job brushing feral hamsters at the",
                " local animal shelter. Opportunity!"
            ]
        }
    ],
    "standard": [{
            "story": ["One day, in the not so distant future, OPPONENT will look back upon this day and consider his or her battle as a",
                " learning experience. 'The loss does not matter,' OPPONENT, thinks. Of course, he or she is an idiot and of course the",
                " loss matters. Moral victories are great for the movies, but in real life, WINNER understands that the sweet taste of",
                " victory is more important than slow motion celebrations in the runner's up tent. Congratulations WINNER. The day is",
                " yours. Hold your head high as you march through the streets, waving your victory banner. Does a beverage taste better",
                " after a win. Yes. Yes it does. Enjoy a beverage of choice!"
            ]
        },
        {
            "story": ["It was perhaps the most exciting match we've yet seen here. Perhaps. It could also be described as a waste of our",
                " time because we bet money on OPPONENT and now they've lost. We lost big.",
                " The odds on OPPONENT were 100-1, the longest of long shots, and we bet accordingly. Is gambling illegal? Not when it's a sure thing.",
                " That's called investing, friend, and now we realize that we should have 'invested' in WINNER. Oh, to think of our champagne",
                " wishes and caviar dreams now being turned into RC Cola and Spam. OPPONENT, we never should have doubted your ability to screw everything up.",
                " WINNER, we never should have doubted your tenacity and force of will. Also your big guns. Those came in handy.",
                " Probably more than the tenacity and will. Yes. Much, much more."
            ]
        }
    ]
};

function _getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

function _capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function _buildStory(storyArray, players) {
    var story = '';
    var opponent = '';
    var winner = '';

    if (players.winner === "player 1" || players.winner === "draw") {
        winner = players["player 1"]["name"];
        opponent = players["player 2"]["name"];
    } else {
        winner = players["player 2"]["name"];
        opponent = players["player 1"]["name"];
    }

    for (var i = 0; i < storyArray['story'].length; i++) {
        var line = storyArray['story'][i];
        line = line.replace("WINNER", winner);
        line = line.replace("OPPONENT", opponent);
        story += line;
    }
    console.log(story);
    return story;
}

function getStory(type, players) {
    var story = _stories[type];
    story = story[_getRandomInt(0, story.length)];
    return _buildStory(story, players);
}

module.exports.getStory = getStory;