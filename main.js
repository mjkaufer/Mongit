var request	= require('request')
	, argv	= require('yargs').argv
	, modhash
	, cookie;

subredditName = "Mongit";

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

function postComment (parentId, message) {

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
			return;
		} else {
			console.log('// COMMENT //');
			console.log("Your comment was posted successfully!");
			console.log('// ------- //');
		}
	});
}

function insert(){

}


login(function(){
	console.log("We logged in");
});



