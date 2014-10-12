var request	= require('request')
	, argv	= require('yargs').argv
	, repl = require('repl')
	, modhash
	, cookie;

subredditName = "Mongit";
postId = "2izkvt";
parentName = "t3_" + postId;//should be dynamic later, but this for now

var loggedIn = false;

function getCommentUrl(pid){//parent id
	pid = pid || postId;
	return "http://reddit.com/r/" + subredditName + "/comments/" + postId + "/db.json";
}

function login (callback) {
	var options = {
			url	: 'https://ssl.reddit.com/api/login?api_type=json&user=' + argv.user + '&passwd=' + argv.pass + '&rem=True',
			headers : {
				'User-Agent' : 'Mongit/0.0.1 by mjkaufer',
			},
			method : 'POST'
	};

	request(options, function (err, res, body) {
		if (err) {
			console.log('LOGIN ERROR:');
			console.log(err);
			return;
		} else {
			var parsedBody = JSON.parse(body);
			modhash = parsedBody.json.data.modhash;
			cookie	= parsedBody.json.data.cookie;
			console.log("WE LOGGED IN");
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
					'User-Agent' : 'Mongit/0.0.1 by mjkaufer',
					'X-Modhash'	: modhash,
					'Cookie' : 'reddit_session=' + encodeURIComponent(cookie)
				},
			method : 'POST'			
		};

	request(options, function (err, res, body) {
		if (err) {
			console.log(err.stack);
			console.log('COMMENT POST ERROR ABOVE!');
			callback(false);
			return;
		} else {
			// console.log('// COMMENT //');
			// console.log("Your comment was posted successfully!");
			// console.log('// ------- //');
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
	message = JSON.stringify(message);

	parentId = parentId || parentName;
	callback = callback || function(){
		console.log("Message " + JSON.stringify(message) + " posted successfully");
	}
	postComment(parentId, message, callback);
}

function find(query, callback, parentId){//find all stuff - callback takes one arg, an array of all the comments
		parentId = parentId || parentName;//set it to the default test thing if it doesn't work out
		callback = callback || function(data){
			console.log("Got data!");
			console.log(JSON.stringify(data));
		}
		query = query || {};

		if(!loggedIn){//log in and try again
			return login(function(){
				find(query, callback, parentId);
			});
		}

		var options = {
			url	: getCommentUrl(),
			headers	: {
					'User-Agent' : 'Mongit/0.0.1 by mjkaufer',
					'X-Modhash'	: modhash,
					'Cookie' : 'reddit_session=' + encodeURIComponent(cookie)
				},
			method : 'GET'			
		};

	request(options, function (err, res, body) {
		if (err) {
			console.log(err.stack);
			console.log('COMMENT POST ERROR ABOVE!');
			callback(false);
			return;
		} else {//we're going to add all of the stuff into an array
			// console.log(body);
			body = JSON.parse(body);//have to jsonify it to access it
			console.log(getCommentUrl())
			var ret  = [];
			// console.log(body);
			bigCommentArrayThing = body[1].data.children;//comments - body[0] is post
			console.log("---------");
			console.log(bigCommentArrayThing);
			for(var i = 0; i < bigCommentArrayThing.length; i++)
				try{

					JSON.parse(JSON.stringify(bigCommentArrayThing[i].data.body));//it'll throw an error if it's not a real JSON
					bigCommentArrayThing[i].data.body.id = bigCommentArrayThing[i].data.id;
					var thing = JSON.parse(bigCommentArrayThing[i].data.body);//no idea why we haad to do this but it didn't work otherwise
					thing._id = bigCommentArrayThing[i].data.id;

					if(!compare(thing, query)){//if the thing popped off doesn't match the query...
						continue;//keep going & don't add to array
					}
					// var arrAdd = bigCommentArrayThing[i].data.body;
					// arrAdd["id"] = bigCommentArrayThing[i].data.id;//mongo-esque id maps
					// console.log(arrAdd);
					// console.log(bigCommentArrayThing[i].data.id);
					ret.push(thing);
				} catch (e){}
				
			

			callback(ret);
		}
	});

}

function update (query, newval, callback, parentId) {//query = thing to find by, newval = what to set to - because we're lazy, we'll make it require an _id for now
	
	parentId = parentId || postId;
	callback = callback || function(){};


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
	else if(!query._id){//no _id is defined - we're going to require the _id for now to make life easier and do less requests
		return console.log("Please specify the _id to update!");
	}
	else if(!newval){
		return console.log("You need something to update to!");
	}
	newval._id = query._id;
	newval = JSON.stringify(newval);//so it can go in the post
	console.log(newval);
	var text = message
	var options = {
		url	: 'https://en.reddit.com/api/editusertext?api_type=json&text=' + encodeURIComponent(newval) + '&thing_id=t1_' + newval._id,
		headers	: {
				'User-Agent' : 'Mongit/0.0.1 by mjkaufer',
				'X-Modhash'	: modhash,
				'Cookie' : 'reddit_session=' + encodeURIComponent(cookie)
			},
		method : 'POST'			
	};

	request(options, function (err, res, body) {
		if (err) {
			console.log(err.stack);
			console.log('COMMENT POST ERROR ABOVE!');
			callback(false);
			return;
		} else {
			// console.log('// COMMENT //');
			// console.log("Your comment was posted successfully!");
			// console.log('// ------- //');
			callback(true);
		}
	});
}

function compare(object, query){//basically, identify whether or not a query matches the object to decide whether to return it

	for(var i in query){
		if(object[i] != query[i])
			return false;
	}
	return true;

}



//2izkvt

login(function(){
	console.log("Starting mongit console");

	repl.start({
		prompt: "Mongit> ",
		input: process.stdin,
		output: process.stdout,
		eval: function(cmd, context, filename, callback){
			cmd = cmd.substring(1,cmd.length - 2);



			if(cmd=="exit"){//quit repl if it's "exit"
				process.exit();
				console.log("Exited");
			}

		eval(cmd);
		console.log("Working");

		}
	});
});





