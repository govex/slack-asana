'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3').verbose();
var Bot = require('slackbots');
var self;
var authed = false;

var username = '';

var NorrisBot = function Constructor(settings) {
    this.settings = settings;
    this.settings.name = this.settings.name || 'NorrisBot';
    this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'norrisbot.db');

    this.user = null;
    this.db = null;
    
    self = this;
};

// inherits methods and properties from the Bot constructor
util.inherits(NorrisBot, Bot);

module.exports = NorrisBot;

NorrisBot.prototype.run = function () {
    NorrisBot.super_.call(this, this.settings);
    this.on('start', this._onStart);
    this.on('message', this._onMessage);
    
    username = this.settings.username;
    self.authenticate();

};

NorrisBot.prototype._onStart = function () {
  
    //this.postMessageToGroup('slackly-testing', 'starting up!', {as_user: true});

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
    
    self.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', function (err, record) {
      
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
    return message.text.toLowerCase().indexOf('chuck norris') > -1 ||
        message.text.toLowerCase().indexOf(this.name) > -1 ||
        message.text.indexOf(this.self.id);
};

var listeningForMore = false;
var userChecked = false;
var detailsAdded = false;
var dateAdded = false;
var titleAdded = false;
var hasUser = false;

NorrisBot.prototype._getChannelById = function (channelId) {
  
  //console.log('\n ------ finding channel ID ------ ', channelId);
    return this.channels.filter(function (item) {
      
        //console.log('what is item? ', item.id);
        return item.id === channelId;
    })[0];
};

NorrisBot.prototype._replyWithRandomJoke = function (originalMessage) {
  
  //console.log('\n ------ gets to the random joke ------ ', originalMessage.channel);
  
  if(originalMessage.text.toLowerCase() == '*cancel') {
    
    self._resetSlackListeners();
    self.postMessageToGroup('slackly-testing', "All righty then...operation canceled.", {as_user: true});
    
  }
  
  else if(listeningForMore) {
    
    self.postMessageToGroup('slackly-testing', "I'm listening for more. Type `*cancel` to cancel." + verb + ' ' + command, {as_user: true});
    
    if(command.toLowerCase() == "task" ) {
      
      console.log(originalMessage.text, ' is listening');
      msg = originalMessage.text;
      
      if(!userChecked) {
        
        self._enterTaskCreation(msg, 'checkUser');
        
      } else if(!titleAdded) {
        
        self._enterTaskCreation(msg,'addTitle');
              
      } else if(detailsAdded == false) {
        
        self._enterTaskCreation(msg, 'addDetails');
        
        //due date's next.
      } else if(dateAdded == false) {
        
        self._enterTaskCreation(msg, 'addDate');
      }
      
    }
    
  }
  
  else if(authed && !listeningForMore) {
    
    self.postMessageToGroup('slackly-testing', "Standby - phoning home.", {as_user:true});
    self._callInsightly(originalMessage);
    
  } else if(!authed) {
    
    self.postMessageToGroup('slackly-testing', "I'm sorry. Authentication to Insightly has failed, and I can't phone home. Give me a sec and try again.", {as_user: true});
    self.authenticate();
    
  }
  
  //don't delete this; you'll need it later.
  var channel = originalMessage.channel; 
  
  
};


/*----------*/


var https = require('https');
var request = require('request');

var password = '';
var url = 'https://' + username + ':' + password + '@api.insight.ly/v2.2/';
var api = 'https://api.insight.ly/v2.2/';

var msg;

var verbs = ['show', 'create', 'get', 'make'];
var commands = ['profile', 'user', 'task', 'event', 'calendar', 'project', 'milestone', 'users', 'tasks', 'events', 'calendars', 'projects', 'profiles'];
var iUsers = [];

var postObject = {
  "TASK_ID": 0,
  "TITLE": "Slackly testing",
  "CATEGORY_ID": 0,
  "DUE_DATE": "2016-03-14T15:37:44.350Z",
  "PUBLICLY_VISIBLE": true,
  "COMPLETED": false,
  "DETAILS": "string",
  "STATUS": "NOT STARTED",
  "START_DATE": "2016-03-14T15:37:44.350Z",
  "RESPONSIBLE_USER_ID": 0
}

var verb = undefined;
var command = undefined;
var callback;
var user;
var userIndex;
 
NorrisBot.prototype.authenticate = function() {
  
  // authenticate to Insightly
  request(
    {
        url : url
    },
    function (error, response, body) {
        
       // console.log('url error', error);
       // console.log('\n url response', response);
       // console.log('\n body', body);
       
       if(error) {
         
         self.postMessageToGroup('slackly-testing', "I'm sorry. Authentication to Insightly has failed, and I can't phone home. Ping @phiden and let her know.", {as_user: true});
         authed = false;
         
       } else {
         
         authed = true;
         self._loadInsightlyUsers();
         self.postMessageToGroup('slackly-testing', "You're connected to Insightly's API!", {as_user: true});
         
         
       }
        
    }
  );

}

//https://api.insight.ly/v2.1/{resource_name}

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
  
  //use pluralize?
  
  ----- */
  
NorrisBot.prototype._callInsightly = function(message) {
  
  msg = message.text;
  var channel = message.channel;
  var commandRaw = this._parseCommand(msg);
  
  console.log('command is: ', command, verb);
  
  if(command == 'nope' || command == undefined) {
    
    return "So sorry; you've asked for something I can't do yet. Try again?";
    //eventually create /bot for a glossary of commands here
    
  } 
}
 
NorrisBot.prototype._enterTaskCreation = function(msg, continuance) {
  
  console.log('\n entering task creation \n');
  
  if(continuance == '') {
    
    listeningForMore = true;
    self.postMessageToGroup('slackly-testing', "Ok. Let's create a task. Who should we assign it to? Type `*cancel` to cancel.", {as_user: true});

  }
   
  if(continuance == 'checkUser'){
    
    console.log('check against your user list; continue if true; prompt if false');
    var options = { method: 'GET',
        url: 'https://api.insight.ly/v2.2/' + 'Users',
        headers: 
        { 
          authorization: 'Basic ' + username
        } 
      };
      
    request(options, function (error, response, data) {
      
      var json = JSON.stringify(eval("(" + data + ")"));
          json = JSON.parse(json);

      if (error) throw new Error(error);
      
      var name = '';
      
      for(var key in json) {
        
        name += json[key].FIRST_NAME + ' ' + json[key].LAST_NAME +  '\n';
        
        //check first names
        if(msg.toLowerCase() == json[key].FIRST_NAME.toLowerCase() || msg.toLowerCase() == json[key].LAST_NAME.toLowerCase() || msg.toLowerCase() == json[key].FIRST_NAME + ' ' + json[key].LAST_NAME) {
          
          console.log("MATCHED, " , json[key].USER_ID);
          
          postObject.RESPONSIBLE_USER_ID = json[key].USER_ID;
          self.postMessageToGroup('slackly-testing', "You're creating a task for " + json[key].FIRST_NAME + ". Enter a title, please.", {as_user:true});
          userChecked = true;
          
          break;
        
        } else {
          
          console.log("NO JOY -- this needs to break as well.");
          //set userChecked flag to false
        }
       
      }
        
      //console.log(msg, name);
  
    })  
  }
  
  else if(continuance == 'addTitle') {
    
    postObject.TITLE = msg;
    titleAdded = true;
    self.postMessageToGroup('slackly-testing', "Ok, the title's been added. Please add a description or some details:", {as_user:true});
    
  }
  
  else if(continuance == 'addDetails') {
    
    postObject.DETAILS = msg;
    detailsAdded = true;
    self.postMessageToGroup('slackly-testing', "Ok, the details have been added to the task, and I'm going to create it now.", {as_user:true});
    
    var options = { 
      method: 'POST',
      url: 'https://api.insight.ly/v2.2/' + 'Tasks',
      body: JSON.stringify(postObject),
      headers: 
      { 
        authorization: 'Basic ' + username
      } 
    };
    
    request(options, function (error, response, data) {
      
      if (error) throw new Error(error);
      //console.log("POST CALL MADE, this is the response: ", response);
      console.log("post call made: \n", options.url, options.apiTask, '\n', response);
      
      if(data != '') {
        
        //you have task ID here -- make this message more useful.
        self.postMessageToGroup('slackly-testing', "Your task has been added! You can edit it directly in Insightly.", {as_user:true});
        self._resetSlackListeners();
      
      } else {
        
        self.postMessageToGroup('slackly-testing', "Rats. Something went wrong. Please try again.", {as_user:true});
        self._resetSlackListeners();
      }
    })
      
    console.log("Details added: ", msg);
  
  } 
  
}

NorrisBot.prototype._callAPI = function(command, verb) {
  
  console.log('call api: ', command, verb)
  
  if(authed) {
    
    //POST
    if(verb != 'GET') {
      
      console.log('LOOK HERE: ', verb, msg, command);
      
      //you have a mess of POST options. use a switch case to determine what's next.
      switch(command.toLowerCase()) {
    
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
        
          //self._postUsersToSlack(json);
          break;
          
        case 'task':
          self._enterTaskCreation(msg, '');
          break;
          
        case 'tasks':
        
          //self._postTasksToSlack(data);
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
          self._postEventsToSlack(data);
          break;
        
      }
    
    } 
    
    //GET 
    else {
      
      if(command == 'Tasks') {
        var options = { 
        
            method: verb,
            url: 'https://api.insight.ly/v2.2/Tasks/Search?brief=true&count_total=true&top=2000&status=NOT STARTED',
            headers: 
            { 
              authorization: 'Basic ' + username
            } 
          } 
        
      } else if (command != 'Users' && command != 'User') {
        
        console.log("NOT TASKS OR USERS");
        
        var options = { 
        
          method: verb,
          url: 'https://api.insight.ly/v2.2/' + command,
          headers: 
          { 
            authorization: 'Basic ' + username
          } 
        }
       
      };/**/
    
    }
    
    if(command != 'Users' && command != 'User') {
      
      request(options, function (error, response, data) {
      
        var json = JSON.stringify(eval("(" + data + ")"));
        
        if (error) throw new Error(error);
        
        else switch(command.toLowerCase()) {
      
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
          
            self._postUsersToSlack(json);
            break;
            
          case 'task':
            return 'nope';
            break;
            
          case 'tasks':
          
            self._postTasksToSlack(data);
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
            self._postEventsToSlack(data);
            break;
          
        }
        
        //console.log(typeof(json));
        
      })  
    
    } else {
    
      self._postUsersToSlack();
    } // close users logic
  }
  
}

NorrisBot.prototype._filterForCommand = function(item, index) {
    
    var nItem = item.replace(/(?:[^a-z])/gi, '')
    var array = commands;
       
    console.log("the index of filter for command: ", index);
    for(var i = 0; i < array.length; i++) {
      
      if(array[i] == nItem.toLowerCase()) {
        
        return [array[i], index];
        break;
      }
    }
    
  }
  
NorrisBot.prototype._filterForVerb = function(item, index) {
    
    var nItem = item.replace(/(?:[^a-z])/gi, '')
    var array = verbs;
    
    console.log("the index of filter for VERB: ", index);

    for(var i = 0; i < array.length; i++) {
      
      if(array[i] == nItem.toLowerCase()) {
        
        console.log('verbs are: ', array[i], nItem);
        return [array[i], index];
        break;
      }
    }
    
  }
  
NorrisBot.prototype._parseCommand = function(msg) {
  
  // get the message
  // split along spaces
  // look for two keywords: show or create
  // look for command
  // look for user ID
  
  var parts = msg.split(' ');
 
    
  if(command == undefined) {
    
    command = parts.filter(this._filterForCommand)[0];
    
  }
  
  if(verb == undefined) {
    
    verb = parts.filter(this._filterForVerb)[0];
  
  }
  
  if(user == undefined) {
    
    user = parts.filter(this._checkAgainstUser)[0]; //.replace(/(?:[^a-z]s)/gi, ''); //kill any apostrophes

  }
  
  console.log("post loop: ", user, hasUser, command, verb);
  
  verb = this._setVerb(verb);
  command = this._setCommand(command);
  
  self._callAPI(command, verb);
  
 /* console.log('message is:', command, verb);
  self.postMessageToGroup('slackly-testing', "You've asked me to: " + verb + " " + command, {as_user: true});

  
  */
  //console.log('this is the command: "', command,'"');
  //console.log('this is the verb: ', verb);
 
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
      return 'Task';
      break;
      
    case 'tasks':
    
      return 'Tasks';
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
      return 'Events';
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

NorrisBot.prototype._loadInsightlyUsers = function() {
  
  var options = { method: 'GET',
      url: 'https://api.insight.ly/v2.2/Users',
      headers: 
      { 
        authorization: 'Basic ' + username
      } 
    };
      
    request(options, function (error, response, data) {
      
      var json = JSON.stringify(eval("(" + data + ")"));
          json = JSON.parse(json);

      if (error) throw new Error(error);

      for(var key in json) {
        
        var person = {};
        person.firstName = json[key].FIRST_NAME
        person.lastName = json[key].LAST_NAME;
        person.userID = json[key].USER_ID;
        
        iUsers.push(person);
      }
      
      console.log('insightly users: ', iUsers);
        
    })
  
}

NorrisBot.prototype._checkAgainstUser = function(usr) {
    
  usr = usr.replace(/(?:[^a-z]s)/gi, '')
  
  //console.log('after regex: ', usr);
  
  for(var i = 0; i < iUsers.length; i++) {
    
    if(usr.toLowerCase() == iUsers[i].firstName.toLowerCase()) {
          
      //console.log('checking against user:', usr.toLowerCase(), iUsers[i].firstName.toLowerCase());
      
      hasUser = true;
      userIndex = i;
      return true;
      break;
    }
  
  }
           
}
  
NorrisBot.prototype._postUsersToSlack = function(data) {
  
  console.log('parsing user data \n');
  
  var name = '*These are all your Insightly users:*\n';
  
  for(var i = 0; i < iUsers.length; i++) {
    
    name += iUsers[i].firstName + ' ' + iUsers[i].lastName +  '\n';
    //console.log(name);
    
  }
  
  self.postMessageToGroup('slackly-testing', name, {as_user: true});
  self._resetSlackListeners();
}

NorrisBot.prototype._postTasksToSlack = function(data) {
  
  data = JSON.parse(data);
  //console.log(typeof(data));
  console.log(data.length + " IS THE NUMBER OF TASKS RETURNED");
  console.log("USRS: ", hasUser, iUsers[userIndex].userID);
  
  var tasks = '';
  
  if(hasUser) {
    
    tasks = "*These are all " + iUsers[userIndex].firstName + "'s open Insightly tasks:*\n";
    
    for(var key in data) {

      if(data[key].OWNER_USER_ID == iUsers[userIndex].userID) {
        
        tasks += '*' + data[key].STATUS + '*: ' + data[key].TITLE  + ' is due on ' + data[key].DUE_DATE + '\n';
        
      }    
      
    }
    
  } else {
    
    tasks = '*These are all open Insightly tasks.*'
    
    for(var key in data) {

      tasks += '*' + data[key].STATUS + '*: ' + data[key].TITLE  + ' is due on ' + data[key].DUE_DATE + '\n';
      
    }
  }
  
  self.postMessageToGroup('slackly-testing', tasks, {as_user: true});
  self._resetSlackListeners();
}

NorrisBot.prototype._postEventsToSlack = function(data) {
  
  data = JSON.parse(data);
  
  var tasks = '*These are all your Insightly Events:*\n';
  
  for(var key in data) {
    
    tasks += '*' + data[key].TITLE + '*: in ' + data[key].LOCATION  + ' at (UTC) ' + data[key].START_DATE_UTC + '\n';
    
  }
  
  self.postMessageToGroup('slackly-testing', tasks, {as_user: true});
  self._resetSlackListeners();
}

NorrisBot.prototype._resetSlackListeners = function() {
  
  console.log('\n reset this sucker.')
  verb = undefined;
  command = undefined;
  listeningForMore = false;
  userChecked = false;
  detailsAdded = false;
  dateAdded = false;
  titleAdded = false;
  hasUser = false;
  user = undefined;
}



