'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3').verbose();
var Bot = require('slackbots');

var NorrisBot = function Constructor(settings) {
    this.settings = settings;
    this.settings.name = this.settings.name || 'insightly';
    this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'norrisbot.db');

    this.user = null;
    this.db = null;
};

// inherits methods and properties from the Bot constructor
util.inherits(NorrisBot, Bot);

module.exports = NorrisBot;

NorrisBot.prototype.run = function () {
    NorrisBot.super_.call(this, this.settings);
    this.on('start', this._onStart);
    this.on('message', this._onMessage);
};

NorrisBot.prototype._onStart = function () {
  
    this.postMessageToGroup('slackly-testing', 'starting up!', {as_user: true});

    this._loadBotUser();
    this._connectDb();
    this._firstRunCheck();
};

NorrisBot.prototype._loadBotUser = function () {
  
    var self = this;
    this.user = this.users.filter(function (user) {
      
      //console.log(user.name, self.name);
      return user.name === self.name;
    })[0];
    
    //console.log('loading bot user', this.user.name );
};

NorrisBot.prototype._connectDb = function () {
    if (!fs.existsSync(this.dbPath)) {
        console.error('Database path ' + '"' + this.dbPath + '" does not exists or it\'s not readable.');
        process.exit(1);
    }

    this.db = new SQLite.Database(this.dbPath);
    //console.log('DB:', this.db);
};

NorrisBot.prototype._firstRunCheck = function () {
  
  //console.log('first run');
    var self = this;
    
    console.log(self.db);
    self.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', function (err, record) {
      
      console.log('database:', record);
        if (err) {
            return console.error('DATABASE ERROR:', err);
        }

        var currentTime = (new Date()).toJSON();

        // this is a first run
        if (!record) {
            self._welcomeMessage();
            return self.db.run('INSERT INTO info(name, val) VALUES("lastrun", ?)', currentTime);
        }

        // updates with new last running time
        self.db.run('UPDATE info SET val = ? WHERE name = "lastrun"', currentTime);
    });
};

NorrisBot.prototype._welcomeMessage = function () {
  //console.log('welcome message');
    this.postMessageToChannel(this.channels[0].name, 'Hi guys, roundhouse-kick anyone?' +
        '\n I can tell jokes, but very honest ones. Just say `Chuck Norris` or `' + this.name + '` to invoke me!',
        {as_user: true});
};

NorrisBot.prototype._onMessage = function (message) {
  
    if (this._isChatMessage(message) &&
       /* this._isChannelConversation(message) || */this._isGroupConversation(message) &&
        !this._isFromNorrisBot(message)// &&
        //this._isMentioningChuckNorris(message)
    ) {
        //console.log('\n replying with something: ', message);
        this._replyWithRandomJoke(message);
        
    } 
};

NorrisBot.prototype._isChatMessage = function (message) {
  
  //console.log('\n ------ checking is chat message ------ ', message, 'type',  message.type, '\n', message.text);
  return message.type === 'message' && Boolean(message.text);
};

NorrisBot.prototype._isChannelConversation = function (message) {
  
  //console.log('\n ------ is channel conversation ------ ', message.channel);
    return typeof message.channel === 'string' &&
        message.channel[0] === 'C';
};

NorrisBot.prototype._isGroupConversation = function (message) {
  
  //console.log('\n ------ is group conversation ------ ', message.channel);
    return typeof message.channel === 'string' &&
        message.channel[0] === 'G';
};

NorrisBot.prototype._isFromNorrisBot = function (message) {
  //console.log('\n ------ is from norrisbot ------ ', message);
    return message.user === this.user.id;
};

NorrisBot.prototype._isMentioningChuckNorris = function (message) {
  
  //console.log('\n ------ mentions chuck norris ------ ', message.text);
    //return message.text.toLowerCase().indexOf('chuck norris') > -1 ||
        //message.text.toLowerCase().indexOf(this.name) > -1 ||
       // message.text.indexOf(this.self.id);
};

NorrisBot.prototype._replyWithRandomJoke = function (originalMessage) {
  
  //console.log('\n ------ gets to the random joke ------ ', originalMessage.channel);
    var self = this;
    
    //console.log('what does this return? ', self._getChannelById(originalMessage.channel));
    var channel = originalMessage.channel; //self._getChannelById(originalMessage.channel);
    
    //console.log('replying:', originalMessage);
    this._callInsightly(originalMessage);
    //self.postMessageToGroup('slackly-testing', 'connecting to insightly?', {as_user: true});
            
    self.db.get('SELECT id, joke FROM jokes ORDER BY used ASC, RANDOM() LIMIT 1', function (err, record) {
        if (err) {
            return console.error('DATABASE ERROR:', err);
        }

        //var channel = self._getGroupById(originalMessage.channel);
        self.postMessageToGroup('slackly-testing', record.joke, {as_user: true});
        self.db.run('UPDATE jokes SET used = used + 1 WHERE id = ?', record.id);
    });/**/
};

NorrisBot.prototype._getChannelById = function (channelId) {
  
  //console.log('\n ------ finding channel ID ------ ', channelId);
    return this.channels.filter(function (item) {
      
        //console.log('what is item? ', item.id);
        return item.id === channelId;
    })[0];
};

/* -------------------------- insightly ------------------------------- */

/* -----
  
  'show' triggers GET
  'create' triggers POST
  
  'my profile' gets 'Users/Me'
  'users' gets 'Users'
  'tasks' gets 'Tasks'
  'events' gets 'Events'
  'calendar' gets 'Events'
  'projects' gets 'Projects'
  'milestones' gets 'Milestones'
  
  //use pluralize
  
  ----- */
  
  var verbs = ['show', 'create', 'get', 'make'];
  var commands = ['profile', 'user', 'task', 'event', 'calendar', 'project', 'milestone', 'users', 'tasks', 'events', 'calendars', 'projects', 'profiles'];
  
NorrisBot.prototype._filterForCommand = function(item, type) {
    
    var nItem = item.replace(/(?:[^a-z])/gi, '')
    var array = [];
    
    if(type == 'verb') {
      array = verbs; 
    } else {
      array = commands;
    }
    
    for(var i = 0; i < array.length; i++) {
      
      if(array[i] == nItem.toLowerCase()) {
        
        console.log('commands are: ', array[i], nItem);
        return array[i];
        break;
      }
    }
    
  }
  
NorrisBot.prototype._getInsightlyCommand = function(msg) {
  
  // get the message
  // split along spaces
  // look for two keywords: show or create, and command
  
  var verb = undefined;
  var command = undefined;
  var parts = [];
  
  parts = msg.split(' ');
  
  for(var i = 0; i < parts.length; i++) {
    
    if(command == undefined || verb == undefined) {
      
      if(command == undefined) {
        
        command = this._filterForCommand(parts[i], 'command');
      }
      
      if(verb == undefined) {
        
        verb = this._filterForCommand(parts[i], 'verb');
      }
      
    } else {
      
      break;
      
    }  
  }
  
  console.log('message is:', command, verb);
  
  verb = this._setVerb(verb);
  command = this._setCommand(command);
  
  console.log('this is the command: "', command.length,'"');
  console.log('this is the verb: ', verb);
  
  //this will deprecate
  if(command == 'Users') {
    
    console.log('should return users');
    return 'Users';
    
  } else {
    
    console.log('should return null');
    return null;
  }
}

NorrisBot.prototype._callInsightly = function(message) {
  
  var msg = message.text;
  var channel = message.channel;
  var command = this._getInsightlyCommand(msg);
  
  console.log('command is: ', command);
  
  if(command == 'nope') {
    
    this.postMessageToGroup('slackly-testing', "So sorry, you've asked for something I can't do yet.", {as_user: true});
    //eventually create /bot for a glossary of commands here
  } else {
    
    this._callAPI(command);
      
  }
  
}
  
NorrisBot.prototype._setCommand = function(command) {
  
  switch(command) {
    
    case 'profile':
      return 'nope';
      break;
      
    case 'profiles':
      return 'nope';
      break;
      
    case 'user':
      return 'User';
      break;
      
    case 'users':
      return 'Users';
      break;
      
    case 'task':
      return 'nope';
      break;
      
    case 'tasks':
      return 'nope';
      break;
      
    case 'project':
      return 'nope';
      break;
      
    case 'projects':
      return 'nope';
      break;
      
    case 'calendar':
      return 'nope';
      break;
      
    case 'calendars':
      return 'nope';
      break;
      
    case 'milestone':
      return 'nope';
      break;
      
    case 'milestones':
      return 'nope';
      break;
      
    case 'event':
      return 'nope';
      break;
      
    case 'events':
      return 'nope';
      break;
    
  }
}

NorrisBot.prototype._setVerb = function(verb) {
  
  switch(verb) {
    
    case 'create':
      return 'POST';
      break;
      
    case 'make':
      return 'POST';
      break;
      
    case 'show':
      return 'GET';
      break;
      
    case 'get':
      return 'GET';
      break;
  }
}
  
NorrisBot.prototype._callAPI = function(command) {
  
  var self = this;
  if(authed) {
    
    var options = { method: 'GET',
      url: 'https://api.insight.ly/v2.2/' + command,
      headers: 
      { 
        authorization: 'Basic ' + username
      } 
      };

    request(options, function (error, response, data) {
      
      if (error) throw new Error(error);
      //console.log(data);
      
      var json = JSON.stringify(eval("(" + data + ")"));
      
      console.log(typeof(json));
      //this will eventually need to be a callback
      self._postUsersToSlack(data);
      
    })  
  }
  
}

NorrisBot.prototype._postUsersToSlack = function(data) {
  
  data = JSON.parse(data);
  console.log(typeof(data));
  
  var name = '*These are all your Insightly users:*\n';
  
  for(var key in data) {
    
    name += data[key].FIRST_NAME + ' ' + data[key].LAST_NAME +  '\n';
    //console.log(name);
    
    
  }
  
  this.postMessageToGroup('slackly-testing', name, {as_user: true});
}

/*
  
  "USER_ID": 957700,
    "CONTACT_ID": 138762555,
    "FIRST_NAME": "Eric",
    "LAST_NAME": "Reese",
    "TIMEZONE_ID": "Eastern Standard Time",
    "EMAIL_ADDRESS": "ereese@jhu.edu",
    "EMAIL_DROPBOX_IDENTIFIER": "PVGGYP",
    "ADMINISTRATOR": true,
    "ACCOUNT_OWNER": false,
    "ACTIVE": true,
    "DATE_CREATED_UTC": "2015-09-17 14:24:08",
    "DATE_UPDATED_UTC": "2015-10-27 11:56:20",
    "USER_CURRENCY": "USD",
    "CONTACT_DISPLAY": "LastFirst",
    "CONTACT_ORDER": "LastFirst",
    "TASK_WEEK_START": 2,
    "INSTANCE_ID": 555941
    
*/
//https://api.insight.ly/v2.1/{resource_name}

/*
  
  Example API Call

If we wanted to retrieve all the contacts available to a particular user with an API key of
ac9a2292-f25a-4483-9d54-000000000000
and we wanted a JSON response that's GZIP encoded, we would use the following GET call with both the Authorization header and Accept-Encoding header:

GET: https://api.insight.ly/v1/contacts
Authorization: Basic YWM5YTIyOTItZjI1YS00NDgzLTlkNTQtMDAwMDAwMDAwMDAw
Accept-Encoding: gzip

  */

var https = require('https');
var request = require('request');

var username = '';
var password = '';
var url = 'https://' + username + ':' + password + '@api.insight.ly/v2.2/';
var api = 'https://api.insight.ly/v2.2/';
var authed = false;

// authenticate to insightly
request(
  {
      url : url
  },
  function (error, response, body) {
      // Do more stuff with 'body' here
      
     // console.log('url error', error);
     // console.log('\n url response', response);
     // console.log('\n body', body);
     
     if(error) {
       
       console.log('authentication fails');
       
     } else {
       
       authed = true;
       console.log('authentication succeeds');
     }
      
  }
);

