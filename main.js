var request	= require('request')
	, argv	= require('yargs').argv
	, repl = require('repl')
	, crypto = require('crypto')
	, config = require('./config/settings')
	, utils = require('./app/utils')
	, modhash
	, cookie
	, dbs = []; // adds dbs var as global array for use later

var loggedIn = false;

function getCommentUrl(pid){//parent id
	pid = pid || config.postId;
	return "http://reddit.com/r/" + config.subredditName + "/comments/" + config.postId + "/db.json";
}

function login (callback) {
	var options = {
			url	: 'https://ssl.reddit.com/api/login?api_type=json&user=' + config.username + '&passwd=' + config.password + '&rem=True',
			headers : {
				'User-Agent' : 'Mongit/1.0.0 by mjkaufer',
			},
			method : 'POST'
	};
	request(options, function (err, res, body) {
		if (err) {
			console.log('Login error:');
			console.log(err);
			return;
		} else {
			var parsedBody = JSON.parse(body);
			modhash = parsedBody.json.data.modhash;
			cookie	= parsedBody.json.data.cookie;
			console.log("Successfully logged in.");
			loggedIn = true;
			return callback();
		}
	});
}

function postComment (parentId, message, callback) {

	callback = callback || function(){};

	if(!loggedIn){//log in and try again
		return login(function(){
			postComment(parentId,message);//basically, we call this function again
		});
	}


	var text = message
		, options = {
			url	: 'https://en.reddit.com/api/comment?api_type=json&text=' + encodeURIComponent(text) + '&thing_id=' + parentId,
			headers	: {
					'User-Agent' : 'Mongit/1.0.0 by mjkaufer',
					'X-Modhash'	: modhash,
					'Cookie' : 'reddit_session=' + encodeURIComponent(cookie)
				},
			method : 'POST'
		};
	console.log("Making request");
	request(options, function (err, res, body) {
		if (err) {
			console.log(err.stack);
			console.log('Error while posting comment above.');
			callback(false);
			return;
		} else {
			callback(true);
		}
	});
}

//the functions using parentId probaby won't use parentId for long, as it'll get deprecated when we dynamically find posts

function insert(message, callback, parentId){//callback takes one arg, returns true or false whether or not it all worked out
//we're going to have a static parentId right now - we'll make code to get a list of all parent id's later, but a parentId at the moment is like a table
	try {
		message = JSON.parse(JSON.stringify(message));//have to stringify to parse it - weird shtuff
	} catch (exception) {
		console.log("Error: " + message + " is not a valid JSON!");
		console.log(message);
		return;//we don't want to add to DB
	}
	var orig = JSON.stringify(message);
	message = utils.encrypt(JSON.stringify(message));

	parentId =  parentId || config.parentName;

	callback = callback || function(){
		console.log("Message " + orig + " posted and encrypted successfully");
	}
	postComment(parentId, message, callback);
}

function find(query, callback, parentId){//find all stuff - callback takes one arg, an array of all the comments
		parentId = parentId || config.parentName;//set it to the default test thing if it doesn't work out
		callback = callback || function(ret){
			console.log(ret);
		};
		query = query || {};

		if(!loggedIn){//log in and try again
			return login(function(){
				find(query, callback, parentId);
			});
		}

		var options = {
			url	: getCommentUrl(),
			headers	: {
					'User-Agent' : 'Mongit/1.0.0 by mjkaufer',
					'X-Modhash'	: modhash,
					'Cookie' : 'reddit_session=' + encodeURIComponent(cookie)
				},
			method : 'GET'
		};
	console.log("Making request");
	request(options, function (err, res, body) {
		if (err) {
			console.log(err.stack);
			console.log('Error while finding comment above.');
			callback(false);
			return;
		} else {//we're going to add all of the stuff into an array
			body = JSON.parse(body);//have to jsonify it to access it
			// console.log(getCommentUrl())
			var ret  = [];

			bigCommentArrayThing = body[1].data.children;//comments - body[0] is post
			console.log("---------");
			for(var i = 0; i < bigCommentArrayThing.length; i++)
				try{
					var decrypted = JSON.parse(utils.decrypt(bigCommentArrayThing[i].data.body));//set decrypted to a parsed json from the encrypted string
					JSON.parse(JSON.stringify(decrypted));//it'll throw an error if it's not a real JSON
					decrypted._id = bigCommentArrayThing[i].data.id;
					// var thing = JSON.parse(bigCommentArrayThing[i].data.body);//no idea why we haad to do this but it didn't work otherwise
					// thing._id = bigCommentArrayThing[i].data.id;
					if(!utils.compare(decrypted, query)){//if the thing popped off doesn't match the query...
						continue;//keep going & don't add to array
					}
					// var arrAdd = bigCommentArrayThing[i].data.body;
					// arrAdd["id"] = bigCommentArrayThing[i].data.id;//mongo-esque id maps
					// console.log(arrAdd);
					// console.log(bigCommentArrayThing[i].data.id);
					ret.push(decrypted);
				} catch (e){}



			callback(ret);
		}
	});

}



function update (query, newval, callback, parentId) {//query = thing to find by, newval = what to set to - because we're lazy, we'll make it require an _id for now

	parentId = parentId || config.postId;
	callback = callback || function(){
		console.log("Updated successfuly!")
	};


	if(!loggedIn){//log in and try again
		return login(function(){
			update(query, newval, parentId, callback);
		});
	}

	try {
		query = JSON.parse(JSON.stringify(query));//have to stringify to parse it - weird shtuff
	} catch (exception) {
		return console.log("Error: " + query + " is not a valid JSON!");
	}

	try {
		newval = JSON.parse(JSON.stringify(newval));//have to stringify to parse it - weird shtuff
	} catch (exception) {
		return console.log("Error: " + newval + " is not a valid JSON!");
	}

	if(!query){
		return console.log("You need a query!");
	}
	// else if(!query._id){//no _id is defined - we're going to require the _id for now to make life easier and do less requests
	// 	return console.log("Please specify the _id to update!");
	// }
	else if(!newval){
		return console.log("You need something to update to!");
	}

	var completed = 0;
	var failed = 0;
	find(query, function(data){//because it's find(query), only the data conforming to the query is returned and edited

		for(var i = 0; i < data.length; i++){
			var edit = data[i];//row thing we're editing
			var id = edit._id;

			for(var key in newval){//each of the keys we're updating
				edit[key] = newval[key];//we'll add fancy mongo methods later
			}
			delete edit._id;//we don't want the id when we put it back in
			updateById(id, edit, function(success){
				completed++;
				if(!success)//there was some problem
					failed++;
				if(completed==data.length){
					console.log("Done - " + failed + " failed.");
				}
			})
			//now edit's keys are updated and we can update
		}
	});

}


function updateById (id, newval, callback, parentId) {//query = thing to find by, newval = what to set to - because we're lazy, we'll make it require an _id for now

	parentId = parentId || config.postId;
	callback = callback || function(){

	};


	if(!loggedIn){//log in and try again
		return login(function(){
			updateById(query, newval, parentId, callback);
		});
	}

	try {
		newval = JSON.parse(JSON.stringify(newval));//have to stringify to parse it - weird shtuff
	} catch (exception) {
		return console.log("Error: " + newval + " is not a valid JSON!");
	}

	if(!id){//no _id is defined - we're going to require the _id for now to make life easier and do less requests
		return console.log("Please specify the _id to update!");
	}
	else if(!newval){
		return console.log("You need something to update to!");
	}

	delete newval._id;//make sure _id's aren't injected...

	newval = JSON.stringify(newval);//so it can go in the post
	var options = {
		url	: 'https://en.reddit.com/api/editusertext?api_type=json&text=' + encodeURIComponent(utils.encrypt(newval)) + '&thing_id=t1_' + id,
		headers	: {
				'User-Agent' : 'Mongit/1.0.0 by mjkaufer',
				'X-Modhash'	: modhash,
				'Cookie' : 'reddit_session=' + encodeURIComponent(cookie)
			},
		method : 'POST'
	};
	console.log("Making request");
	request(options, function (err, res, body) {
		if (err) {
			console.log(err.stack);
			console.log('Error while updating comment above.');
			callback(false);
			return;
		} else {
			callback(true);
		}
	});
}

function remove(query, callback){//only id based removing for now, so you'd need to pass something like {_id:123}
	callback = callback || function(){};

	if(!loggedIn){//log in and try again
		return login(function(){
			remove(query, callback);
		});
	}

	if(!query){
		return console.log("You need a query!");
	}

	try {
		query = JSON.parse(JSON.stringify(query));//have to stringify to parse it - weird shtuff
	} catch (exception) {
		return console.log("Error: " + query + " is not a valid JSON!");
	}
	var completed = 0;
	var failed = 0;
	find(query, function(data){//because it's find(query), only the data conforming to the query is returned and edited
		for(var i = 0; i < data.length; i++){
			var del = data[i];//row thing we're editing
			removeById(del._id, function(success){
				completed++;
				if(!success)//there was some problem
					failed++;
				if(completed==data.length){
					console.log("Done - " + failed + " failed.");
				}
			})
		}
	});
}

function removeById(id, callback){//only id based removing for now, so you'd need to pass something like {_id:123}
	callback = callback || function(){};

	if(!loggedIn){//log in and try again
		return login(function(){
			removeById(query, callback);
		});
	}

	if(!id){
		return console.log("You need an id!");
	}

	var options = {
		url	: 'https://en.reddit.com/api/del?id=t1_' + id,
		headers	: {
				'User-Agent' : 'Mongit/1.0.0 by mjkaufer',
				'X-Modhash'	: modhash,
				'Cookie' : 'reddit_session=' + encodeURIComponent(cookie)
			},
		method : 'POST'
	};

	request(options, function (err, res, body) {
		if (err) {
			console.log(err.stack);
			console.log('Error while removing comment above.');
			callback(false);
			return;
		} else {
			callback(true);
		}
	});
}

/**
* Displays DBs the user is an approved contributor to (private subreddits)
*/
function showdbs(){

	if(!loggedIn){//log in and try again
		return login(function(){
			showdbs();
		});
	}
	var options = {
		url	: "https://en.reddit.com/subreddits/mine/moderator.json",
		headers	: {
			'User-Agent' : 'Mongit/1.0.0 by mjkaufer',
			'X-Modhash'	: modhash,
			'Cookie' : 'reddit_session=' + encodeURIComponent(cookie)
		},
		method : 'GET'
	};
	request(options, function(err, res, body){
		if(err){
			console.log(err.stack);
			console.log("Couldn't find dbs you are a contributor to");
			return;
		}else{
			body = JSON.parse(body); // the json isn't manuverable without this :(
			dbs=[]; // sets to empty string
			for(var i=0; i<body.data.children.length;i++){
				dbs.push(body.data.children[i].data.display_name) // recreates array
			}
			console.log("Databases:",dbs);
			return;
		}
	})

}

function changeDb(db){

	config.subredditName = db.trim();
	console.log("Changed to",config.subredditName);
	return;
}

function changeCollection(collection){
	(collection? config.postId = collection : console.log("Invalid input"));
	config.parentName = "t3_" + config.postId;
	return;
}

function showCollections(){
	if(!loggedIn){//log in and try again
		return login(function(){
			showCollections();
		});
	}
	var options = {
		url	: "https://api.reddit.com/r/" + config.subredditName + ".json",
		headers	: {
			'User-Agent' : 'Mongit/1.0.0 by mjkaufer',
			'X-Modhash'	: modhash,
			'Cookie' : 'reddit_session=' + encodeURIComponent(cookie)
		},
		method : 'GET'
	};
	request(options, function(err, res, body){
		if(err){
			console.log(err.stack);
			console.log("Couldn't find any collections in /r/" + config.subredditName);
			return;
		}else{
			body = JSON.parse(body);
			collections=[];
			for(var i=0; i<body.data.children.length;i++){
				collections.push(body.data.children[i].data.id);
			}
			console.log("Collections:",collections);
			return;
		}
	})
}
//2izkvt

login(function(){
	console.log("Starting mongit console");
	// for(var i = 0; i < twitterInsert.length; i++){
	// 	insert(twitterInsert[i]);
	// }
	repl.start({
		prompt: "Mongit> ",
		input: process.stdin,
		output: process.stdout,
		eval: function(cmd, context, filename, callback){
			cmd = cmd.substring(1,cmd.length - 2);

			try{
				if(cmd=="exit"){//quit repl if it's "exit"
					process.exit();
					console.log("Exited");
				}else if(cmd == "show dbs"){//trying to get database management as close to MongoDB as possible - http://docs.mongodb.org/manual/reference/mongo-shell/
					showdbs();
				}else if(cmd == "show collections"){
					showCollections();
				}else if(cmd.indexOf("use") == 0 && cmd.indexOf(" ") > -1){//if there's two arguments
					changeDb(cmd.substring(cmd.indexOf(" ")));
				}else{
					eval(cmd);
				}
			} catch(e){
				console.log(e);
			}

			

		}
	});
});
