'use strict';

var NorrisBot = require('../lib/norrisbot');

var token = process.env.BOT_API_KEY;
var username = process.env.USERNAME;
var dbPath = 'data/norrisbot.db';
var name = 'insightly';

var norrisbot = new NorrisBot({
    token: token,
    username: username,
    dbPath: dbPath,
    name: name
});


norrisbot.run();


