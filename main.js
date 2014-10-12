var request	= require('request')
	, argv	= require('yargs').argv
	, repl = require('repl')
	, modhash
	, cookie;

subredditName = "Mongit";
parentName = "t3_2izkvt";//should be dynamic later, but this for now
var loggedIn = false;


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

function insert(message, parentId, callback){//callback takes one arg, returns true or false whether or not it all worked out
//we're going to have a static parentId right now - we'll make code to get a list of all parent id's later, but a parentId at the moment is like a table
	try {
		message = JSON.parse(JSON.stringify(message));//have to stringify to parse it - weird shtuff
	} catch (exception) {
		console.log("Error: " + message + " is not a valid JSON!");
		console.log(message);
		return;//we don't want to add to DB
	}

	parentId = parentId || parentName;
	callback = callback || function(){
		console.log("Message " + message + " posted successfully");
	}
	postComment(parentId, message, callback);
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





