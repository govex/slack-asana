'use strict';

var NorrisBot = require('../lib/norrisbot');

var token = process.env.BOT_API_KEY;
var dbPath = 'data/norrisbot.db';
var name = 'insightly';

var norrisbot = new NorrisBot({
    token: token,
    dbPath: dbPath,
    name: name
});


norrisbot.run();


