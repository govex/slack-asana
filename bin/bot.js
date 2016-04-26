'use strict';

var InsightBot = require('../lib/insightbot');

var token = process.env.BOT_API_KEY;
var username = process.env.USERNAME;
var dbPath = 'data/norrisbot.db';
var name = 'insightly';

var InsightBot = new InsightBot({
    token: token,
    username: username,
    dbPath: dbPath,
    name: name
});

InsightBot.run();


