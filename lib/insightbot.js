'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var Bot = require('slackbots');
var self;
var authed = false;
var listeningForMore = false;
var userChecked = false;
var detailsAdded = false;
var dateAdded = false;
var titleAdded = false;
var hasUser = false;
var messageObject; 
var verb = undefined;
var command = undefined;
var callback;
var user;
var userIndex;
var myUser;
var myUserIndex;
var helpText = ''; // messaging that goes public-facing 
var status;
var listeningForStatus = false;
var https = require('https');
var request = require('request');

var password = '';
var url = 'https://' + username + ':' + password + '@api.insight.ly/v2.2/';
var api = 'https://api.insight.ly/v2.2/';

var msg;

var verbs = ['show', 'create', 'get', 'make'];
var commands = ['profile', 'user', 'task', 'event', 'calendar', 'project', 'milestone', 'users', 'tasks', 'events', 'calendars', 'projects', 'profiles'];
var iUsers = [];
var sUsers = [];

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

var username = '';

var InsightBot = function Constructor(settings) {
    this.settings = settings;
    this.settings.name = this.settings.name || 'InsightBot';
    this.user = null;
    
    self = this;
};

// inherits methods and properties from the Bot constructor
util.inherits(InsightBot, Bot);

module.exports = InsightBot;

InsightBot.prototype.run = function () {
  
    InsightBot.super_.call(this, this.settings);
    this.on('start', this._onStart);
    this.on('message', this._onMessage);
    
    username = this.settings.username;
    self.authenticate();

};

InsightBot.prototype._onStart = function () {
  
    this._loadBotUser();
    
};

InsightBot.prototype._loadBotUser = function () {
  
    this.user = this.users.filter(function (user) {
      
      //console.log(user.name, self.name);
      return user.name === self.name;
    })[0];
    
    //console.log('loading bot user', this.user.name );
};

InsightBot.prototype._onMessage = function (message) {
  
  if (this._isChatMessage(message) &&
       /* this._isChannelConversation(message) || */this._isGroupConversation(message) &&
        !this._isFromInsightBot(message) &&
        this._isMentioningChuckNorris(message)
    ) {
        //console.log('\n replying with something: ', message);
        this._replyWithRandomJoke(message);
        
    } 
};

InsightBot.prototype._isChatMessage = function (message) {
  
  //console.log('\n ------ checking is chat message ------ ', message, 'type',  message.type, '\n', message.text);
  return message.type === 'message' && Boolean(message.text);
};

InsightBot.prototype._isChannelConversation = function (message) {
  
  //console.log('\n ------ is channel conversation ------ ', message.channel);
    return typeof message.channel === 'string' &&
        message.channel[0] === 'C';
};

InsightBot.prototype._isGroupConversation = function (message) {
  
  //console.log('\n ------ is group conversation ------ ', message.channel);
    return typeof message.channel === 'string' &&
        message.channel[0] === 'G';
};

InsightBot.prototype._isFromInsightBot = function (message) {
  //console.log('\n ------ is from InsightBot ------ ', message);
    return message.user === this.user.id;
};

InsightBot.prototype._isMentioningChuckNorris = function (message) {
  
  console.log('\n ------ mentions chuck norris ------ \n', message.text);
  
    return message.text.toLowerCase().indexOf('chuck norris') > -1 ||
        message.text.toLowerCase().indexOf(this.name) > -1 ||
        message.text.indexOf(this.self.id) > -1 ||
        listeningForMore;
};


InsightBot.prototype._getChannelById = function (channelId) {
  
  //console.log('\n ------ finding channel ID ------ ', channelId);
    return this.channels.filter(function (item) {
      
        //console.log('what is item? ', item.id);
        return item.id === channelId;
    })[0];
};

InsightBot.prototype._replyWithRandomJoke = function (originalMessage) {
  
  //console.log('\n ------ gets to the random joke ------ ', originalMessage.channel);
  messageObject = originalMessage;
  
  if(originalMessage.text.toLowerCase() == '*cancel') {
    
    self._resetSlackListeners();
    self.postMessageToGroup('slackly-testing', "All righty then...operation canceled.", {as_user: true});
    
  }
  
  else if(listeningForMore) {
    
    self.postMessageToGroup('slackly-testing', "I'm listening for more. Type `*cancel` to cancel. " + verb + ' ' + command, {as_user: true});
    
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
  
  else if(authed && !listeningForMore && !listeningForStatus) {
    
    self.postMessageToGroup('slackly-testing', "Standby - phoning home.", {as_user:true});
    self._callInsightly(originalMessage);
    
  } else if(!authed) {
    
    self.postMessageToGroup('slackly-testing', "I'm sorry. Authentication to Insightly has failed, and I can't phone home. Give me a sec and try again.", {as_user: true});
    self.authenticate();
    
  } else if(listeningForStatus) {
    
    var m = originalMessage.text.split(' ');
    
    for(var i = 0; i < m.length; i++) {
      
      self._checkTaskStatus(m[i]);
          
    }
    
    self._callAPI('Tasks', 'GET');
  }
  
  //don't delete this; you'll need it later.
  var channel = originalMessage.channel; 
  
};

/*----------*/


InsightBot.prototype._checkTaskStatus = function(task) {
  
  switch (task) {
            
    case 'open':
      status = 'in progress';
      helpText = "Looking for something that's not here? Try asking for `not started` tasks."
      break;
      
    case 'closed': 
      status = 'completed';
      break;
      
    case 'completed': 
      status = 'completed';
      break;
      
    case 'started': 
      status = 'not started';
      break;
      
    case 'progress':
      status = 'in progress';
      helpText = "Looking for something that's not here? Try asking for `not started` tasks."
      break;
    
  }
  
}

InsightBot.prototype.authenticate = function() {
  
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
         self.postMessageToGroup('slackly-testing', "You're connected to Insightly's API! Right now, you can ask @insightly to: `show <person>'s tasks`, `show my tasks`, `show events`, `create a task`, and `show users`.", {as_user: true});
         
         
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
  
InsightBot.prototype._callInsightly = function(message) {
  
  msg = message.text;
  var channel = message.channel;
  var commandRaw = this._parseCommand(msg);
  
  console.log('command is: ', command, verb);
  
  if(command == 'nope' || command == undefined) {
    
    return "So sorry; you've asked for something I can't do yet. Try again?";
    //eventually create /bot for a glossary of commands here
    
  } 
}
 
InsightBot.prototype._enterTaskCreation = function(msg, continuance) {
  
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
        
        var json = JSON.stringify(eval("(" + data + ")"));
            json = JSON.parse(json);
       
       console.log(json);
       
        //you have task ID here -- make this message more useful.
        self.postMessageToGroup('slackly-testing', "Your task has been added! You can edit it directly in Insightly: " + "https://govex.insight.ly/Tasks/TaskDetails/" + json.TASK_ID, {as_user:true});
        self._resetSlackListeners();
      
      } else {
        
        self.postMessageToGroup('slackly-testing', "Rats. Something went wrong. Please try again.", {as_user:true});
        self._resetSlackListeners();
      }
    })
      
    console.log("Details added: ", msg);
  
  } 
  
}

InsightBot.prototype._callAPI = function(command, verb) {
  
  console.log('call api: ', command, verb, status, listeningForStatus)
  
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
        
        console.log('we need status: ', msg, status);
        
        if(status == undefined || status == '') {
          
          var m = msg.split(' ');
          for(var i = 0; i < m.length; i++) {
          
            //look for open, closed, completed, not started, in progress
            self._checkTaskStatus(m[i]);
            
            console.log('m[i]', m[i]);
            console.log('post status switch: ', status, m.length);
          
          }
 
          if(status == undefined && listeningForStatus == false) {
          
            listeningForStatus = true;
            self.postMessageToGroup('slackly-testing', 'Did you want `completed`, `in progress`, or `not started` tasks?', {as_user: true});
          }
        
        } else if(status != undefined && status != '') {
          
          console.log('getting ready to call: ', 'https://api.insight.ly/v2.2/Tasks/Search?brief=true&top=2000&status=' + status.toUpperCase());
          
          var options = { 
            // IN PROGRESS / NOT STARTED / COMPLETED
  
            method: verb,
            url: 'https://api.insight.ly/v2.2/Tasks/Search?brief=true&top=2000&status=' + status.toUpperCase(),
            headers: 
            { 
              authorization: 'Basic ' + username
            } 
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

InsightBot.prototype._filterForCommand = function(item, index) {
    
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
  
InsightBot.prototype._filterForVerb = function(item, index) {
    
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
  
InsightBot.prototype._parseCommand = function(msg) {
  
  // get the message
  // split along spaces
  // look for two keywords: show or create
  // look for command
  // look for user ID
  // look for 'my' and parse to user ID
  
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

InsightBot.prototype._setCommand = function(command) {
  
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

InsightBot.prototype._setVerb = function(verb) {
  
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

InsightBot.prototype._loadInsightlyUsers = function() {
  
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
    
  //get slack users
  var temp = self.getUsers()._value.members;
  
  //transform to match Insightly format
  for(var i = 0; i < temp.length; i++) {
    
    var obj = {};
        obj.firstName = temp[i].profile.first_name;
        obj.lastName = temp[i].profile.last_name;
        obj.userID = temp[i].id; 
        obj.slackName = temp[i].name;
        
        sUsers.push(obj);
  }
  
  console.log(sUsers);
}

InsightBot.prototype._checkAgainstUser = function(usr) {
    
  usr = usr.replace(/(?:[^a-z]s)/gi, '')
  
  console.log('after regex: ', usr);
  
  for(var i = 0; i < iUsers.length; i++) {
    
    if(usr.toLowerCase() == iUsers[i].firstName.toLowerCase()) {
          
      //console.log('checking against user:', usr.toLowerCase(), iUsers[i].firstName.toLowerCase());
      
      hasUser = true;
      userIndex = i;
      return true;
      break;
    
    } else if(usr.toLowerCase() == 'my') {
      
      console.log(messageObject);
      usr = messageObject.user;
      
      for(var i = 0; i < sUsers.length; i++) {
        
        if(usr == sUsers[i].userID) {
          
          myUser = sUsers[i].firstName;
          for(var a = 0; a < iUsers.length; a++) {
            
            if(myUser.toLowerCase() == iUsers[a].firstName.toLowerCase()) {
              
              userIndex = a;
            }
          }
        }
      }
      
      console.log("MY user is: ", myUser, user);
      hasUser = true;
      return true;
      break; 
    }
  
  }
           
}

InsightBot.prototype._postUsersToSlack = function(data) {
  
  console.log('parsing user data \n');
  
  var name = '*These are all your Insightly users:*\n';
  
  for(var i = 0; i < iUsers.length; i++) {
    
    name += iUsers[i].firstName + ' ' + iUsers[i].lastName +  '\n';
    //console.log(name);
    
  }
  
  self.postMessageToGroup('slackly-testing', name, {as_user: true});
  self._resetSlackListeners();
}

InsightBot.prototype._postTasksToSlack = function(data) {
  
  data = JSON.parse(data);
  //console.log(typeof(data));
  //console.log(data.length + " IS THE NUMBER OF TASKS RETURNED");
  //console.log("USRS: ", hasUser, user, myUser, userIndex);
  
  //console.log(data);
  

  var tasks = '';
  
  if(hasUser && user != 'my') {
    
    tasks = "*These are all " + iUsers[userIndex].firstName + "'s " + status + " Insightly tasks:*\n";
    
    for(var key in data) {
      
      //console.log('key in data', data.length, data[key].OWNER_USER_ID, iUsers[userIndex].userID);

      console.log(data[key].RESPONSIBLE_USER_ID, iUsers[userIndex].userID, data[key].COMPLETED, data[key].STATUS);
      if(data[key].RESPONSIBLE_USER_ID == iUsers[userIndex].userID ) {
        
        tasks += '*' + data[key].STATUS + '*: ' + data[key].TITLE  + ' | Task ID: ' + data[key].TASK_ID + '\n';
        
      }    
      
    }
    
    tasks += helpText;
    
  } else if(hasUser && user == 'my') {
    
    console.log('key in data; my user', data.length);
    
    tasks = "*These are all " + myUser + "'s" + status + " Insightly tasks:*\n";
    for(var key in data) {

      if(data[key].OWNER_USER_ID == iUsers[userIndex].userID /*&& data[key].COMPLETED == false*/) {
        
        tasks += '*' + data[key].STATUS + '*: ' + data[key].TITLE + ' | Task ID: ' + data[key].TASK_ID + '\n';
        
      }    
      
    }
    
    tasks += helpText;
  
  } else {
    
    tasks = '*These are all open Insightly tasks.*\n'
    
    for(var key in data) {

      tasks += '*' + data[key].STATUS + '*: ' + data[key].TITLE  + ' is due on ' + data[key].DUE_DATE + '\n';
      
    }
    
    tasks += helpText;
  }
  
  self.postMessageToGroup('slackly-testing', tasks, {as_user: true});
  self._resetSlackListeners();
}

InsightBot.prototype._postEventsToSlack = function(data) {
  
  data = JSON.parse(data);
  
  var tasks = '*These are all your Insightly Events:*\n';
  
  for(var key in data) {
    
    tasks += '*' + data[key].TITLE + '*: in ' + data[key].LOCATION  + ' at (UTC) ' + data[key].START_DATE_UTC + '\n';
    
  }
  
  self.postMessageToGroup('slackly-testing', tasks, {as_user: true});
  self._resetSlackListeners();
}

InsightBot.prototype._resetSlackListeners = function() {
  
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
  myUser = undefined;
  myUserIndex = undefined;
  status = undefined;
}



