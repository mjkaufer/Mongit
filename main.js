var request	= require('request')
	, argv	= require('yargs').argv
	, repl = require('repl')
	, crypto = require('crypto')
	, modhash
	, cookie;

subredditName = "Mongit";
postId = "2izkvt";
parentName = "t3_" + postId;//should be dynamic later, but this for now
algo = "aes256";
key = "RazzeFrazzle";//this shouldn't change after you first run it for obvious reasons

var loggedIn = false;

function getCommentUrl(pid){//parent id
	pid = pid || postId;
	return "http://reddit.com/r/" + subredditName + "/comments/" + postId + "/db.json";
}

function login (callback) {
	var options = {
			url	: 'https://ssl.reddit.com/api/login?api_type=json&user=' + argv.user + '&passwd=' + argv.pass + '&rem=True',
			headers : {
				'User-Agent' : 'Mongit/1.0.0 by mjkaufer',
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
			console.log('COMMENT POST ERROR ABOVE!');
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
	message = encrypt(JSON.stringify(message));

	parentId = parentId || parentName;

	callback = callback || function(){
		console.log("Message " + orig + " posted and encrypted successfully");
	}
	postComment(parentId, message, callback);
}
//we have to declare decipher and cipher here because the .final thing means we can't use it or some shit
function decrypt(encrypted){
	var decipher = crypto.createDecipher(algo, key);
	return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
function encrypt(text){
	if(typeof text == "object")
		text = JSON.stringify(text);//has to be a string

	cipher = crypto.createCipher(algo, key);
	return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');	
}



function find(query, callback, parentId){//find all stuff - callback takes one arg, an array of all the comments
		parentId = parentId || parentName;//set it to the default test thing if it doesn't work out
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
			console.log('COMMENT FIND ERROR ABOVE!');
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
			for(var i = 0; i < bigCommentArrayThing.length; i++)
				try{
					var decrypted = JSON.parse(decrypt(bigCommentArrayThing[i].data.body));//set decrypted to a parsed json from the encrypted string
					JSON.parse(JSON.stringify(decrypted));//it'll throw an error if it's not a real JSON
					decrypted._id = bigCommentArrayThing[i].data.id;
					// var thing = JSON.parse(bigCommentArrayThing[i].data.body);//no idea why we haad to do this but it didn't work otherwise
					// thing._id = bigCommentArrayThing[i].data.id;
					if(!compare(decrypted, query)){//if the thing popped off doesn't match the query...
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
	
	parentId = parentId || postId;
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
	else if(!query._id){//no _id is defined - we're going to require the _id for now to make life easier and do less requests
		return console.log("Please specify the _id to update!");
	}
	else if(!newval){
		return console.log("You need something to update to!");
	}
	var id = query._id;
	newval = JSON.stringify(newval);//so it can go in the post
	var options = {
		url	: 'https://en.reddit.com/api/editusertext?api_type=json&text=' + encodeURIComponent(encrypt(newval)) + '&thing_id=t1_' + id,
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
			console.log('COMMENT POST ERROR ABOVE!');
			callback(false);
			return;
		} else {
			console.log("Update completed!")
			callback(true);
		}
	});
}

function del(query, callback){//only id based removing for now, so you'd need to pass something like {_id:123}
	callback = callback || function(){};

	if(!loggedIn){//log in and try again
		return login(function(){
			del(query, callback);
		});
	}

	if(!query){
		return console.log("You need a query!");
	}
	else if(!query._id){
		return console.log("Please specify the _id to delete!");
	}

	try {
		query = JSON.parse(JSON.stringify(query));//have to stringify to parse it - weird shtuff
	} catch (exception) {
		return console.log("Error: " + query + " is not a valid JSON!");
	}

	var id = query._id;

	var options = {
		url	: 'https://en.reddit.com/api/del?id=t1_' + id,
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
			console.log('COMMENT DELETE ERROR ABOVE!');
			callback(false);
			return;
		} else {
			console.log("Delete completed!")
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
	// for(var i = 0; i < twitterInsert.length; i++){
	// 	insert(twitterInsert[i]);
	// }
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

		}
	});
});



twitterInsert = [//random hackru twitter query to store
  {
    "created_at": "Sun Oct 12 12:22:51 +0000 2014",
    "id": 521274800766222340,
    "id_str": "521274800766222336",
    "text": "Breakfast is being served!",
    "source": "<a href=\"http://twitter.com/download/iphone\" rel=\"nofollow\">Twitter for iPhone</a>",
    "truncated": false,
    "in_reply_to_status_id": null,
    "in_reply_to_status_id_str": null,
    "in_reply_to_user_id": null,
    "in_reply_to_user_id_str": null,
    "in_reply_to_screen_name": null,
    "user": {
      "id": 244296954,
      "id_str": "244296954",
      "name": "HackRU",
      "screen_name": "theHackRU",
      "location": "Rutgers University",
      "description": "An incredible experience for learning and creation! · October 11-12th 2014 · #RUready?",
      "url": "http://t.co/k6jHNYlJaT",
      "entities": {
        "url": {
          "urls": [
            {
              "url": "http://t.co/k6jHNYlJaT",
              "expanded_url": "http://hackru.org",
              "display_url": "hackru.org",
              "indices": [
                0,
                22
              ]
            }
          ]
        },
        "description": {
          "urls": []
        }
      },
      "protected": false,
      "followers_count": 1103,
      "friends_count": 121,
      "listed_count": 26,
      "created_at": "Sat Jan 29 00:27:12 +0000 2011",
      "favourites_count": 567,
      "utc_offset": -18000,
      "time_zone": "Quito",
      "geo_enabled": true,
      "verified": false,
      "statuses_count": 766,
      "lang": "en",
      "contributors_enabled": false,
      "is_translator": false,
      "is_translation_enabled": false,
      "profile_background_color": "131516",
      "profile_background_image_url": "http://pbs.twimg.com/profile_background_images/378800000182792718/ncF6BahY.png",
      "profile_background_image_url_https": "https://pbs.twimg.com/profile_background_images/378800000182792718/ncF6BahY.png",
      "profile_background_tile": true,
      "profile_image_url": "http://pbs.twimg.com/profile_images/509142658716286976/5h1CGBZk_normal.jpeg",
      "profile_image_url_https": "https://pbs.twimg.com/profile_images/509142658716286976/5h1CGBZk_normal.jpeg",
      "profile_banner_url": "https://pbs.twimg.com/profile_banners/244296954/1410224044",
      "profile_link_color": "D21033",
      "profile_sidebar_border_color": "000000",
      "profile_sidebar_fill_color": "FFFFFF",
      "profile_text_color": "666666",
      "profile_use_background_image": true,
      "default_profile": false,
      "default_profile_image": false,
      "following": true,
      "follow_request_sent": false,
      "notifications": false
    },
    "geo": null,
    "coordinates": null,
    "place": null,
    "contributors": null,
    "retweet_count": 0,
    "favorite_count": 0,
    "entities": {
      "hashtags": [],
      "symbols": [],
      "urls": [],
      "user_mentions": []
    },
    "favorited": false,
    "retweeted": false,
    "lang": "en"
  },
  {
    "created_at": "Sun Oct 12 11:50:57 +0000 2014",
    "id": 521266770200776700,
    "id_str": "521266770200776704",
    "text": "Breakfast will be happening around 8:30, hang in there! We'll make announcements by table when it's ready.",
    "source": "<a href=\"http://twitter.com/download/iphone\" rel=\"nofollow\">Twitter for iPhone</a>",
    "truncated": false,
    "in_reply_to_status_id": null,
    "in_reply_to_status_id_str": null,
    "in_reply_to_user_id": null,
    "in_reply_to_user_id_str": null,
    "in_reply_to_screen_name": null,
    "user": {
      "id": 244296954,
      "id_str": "244296954",
      "name": "HackRU",
      "screen_name": "theHackRU",
      "location": "Rutgers University",
      "description": "An incredible experience for learning and creation! · October 11-12th 2014 · #RUready?",
      "url": "http://t.co/k6jHNYlJaT",
      "entities": {
        "url": {
          "urls": [
            {
              "url": "http://t.co/k6jHNYlJaT",
              "expanded_url": "http://hackru.org",
              "display_url": "hackru.org",
              "indices": [
                0,
                22
              ]
            }
          ]
        },
        "description": {
          "urls": []
        }
      },
      "protected": false,
      "followers_count": 1103,
      "friends_count": 121,
      "listed_count": 26,
      "created_at": "Sat Jan 29 00:27:12 +0000 2011",
      "favourites_count": 567,
      "utc_offset": -18000,
      "time_zone": "Quito",
      "geo_enabled": true,
      "verified": false,
      "statuses_count": 766,
      "lang": "en",
      "contributors_enabled": false,
      "is_translator": false,
      "is_translation_enabled": false,
      "profile_background_color": "131516",
      "profile_background_image_url": "http://pbs.twimg.com/profile_background_images/378800000182792718/ncF6BahY.png",
      "profile_background_image_url_https": "https://pbs.twimg.com/profile_background_images/378800000182792718/ncF6BahY.png",
      "profile_background_tile": true,
      "profile_image_url": "http://pbs.twimg.com/profile_images/509142658716286976/5h1CGBZk_normal.jpeg",
      "profile_image_url_https": "https://pbs.twimg.com/profile_images/509142658716286976/5h1CGBZk_normal.jpeg",
      "profile_banner_url": "https://pbs.twimg.com/profile_banners/244296954/1410224044",
      "profile_link_color": "D21033",
      "profile_sidebar_border_color": "000000",
      "profile_sidebar_fill_color": "FFFFFF",
      "profile_text_color": "666666",
      "profile_use_background_image": true,
      "default_profile": false,
      "default_profile_image": false,
      "following": true,
      "follow_request_sent": false,
      "notifications": false
    },
    "geo": null,
    "coordinates": null,
    "place": null,
    "contributors": null,
    "retweet_count": 1,
    "favorite_count": 0,
    "entities": {
      "hashtags": [],
      "symbols": [],
      "urls": [],
      "user_mentions": []
    },
    "favorited": false,
    "retweeted": false,
    "lang": "en"
  },
  {
    "created_at": "Sun Oct 12 11:46:51 +0000 2014",
    "id": 521265737218793500,
    "id_str": "521265737218793473",
    "text": "Correction: hacking ends at 12PM! KEEP GOING!!",
    "source": "<a href=\"http://twitter.com/download/iphone\" rel=\"nofollow\">Twitter for iPhone</a>",
    "truncated": false,
    "in_reply_to_status_id": null,
    "in_reply_to_status_id_str": null,
    "in_reply_to_user_id": null,
    "in_reply_to_user_id_str": null,
    "in_reply_to_screen_name": null,
    "user": {
      "id": 244296954,
      "id_str": "244296954",
      "name": "HackRU",
      "screen_name": "theHackRU",
      "location": "Rutgers University",
      "description": "An incredible experience for learning and creation! · October 11-12th 2014 · #RUready?",
      "url": "http://t.co/k6jHNYlJaT",
      "entities": {
        "url": {
          "urls": [
            {
              "url": "http://t.co/k6jHNYlJaT",
              "expanded_url": "http://hackru.org",
              "display_url": "hackru.org",
              "indices": [
                0,
                22
              ]
            }
          ]
        },
        "description": {
          "urls": []
        }
      },
      "protected": false,
      "followers_count": 1103,
      "friends_count": 121,
      "listed_count": 26,
      "created_at": "Sat Jan 29 00:27:12 +0000 2011",
      "favourites_count": 567,
      "utc_offset": -18000,
      "time_zone": "Quito",
      "geo_enabled": true,
      "verified": false,
      "statuses_count": 766,
      "lang": "en",
      "contributors_enabled": false,
      "is_translator": false,
      "is_translation_enabled": false,
      "profile_background_color": "131516",
      "profile_background_image_url": "http://pbs.twimg.com/profile_background_images/378800000182792718/ncF6BahY.png",
      "profile_background_image_url_https": "https://pbs.twimg.com/profile_background_images/378800000182792718/ncF6BahY.png",
      "profile_background_tile": true,
      "profile_image_url": "http://pbs.twimg.com/profile_images/509142658716286976/5h1CGBZk_normal.jpeg",
      "profile_image_url_https": "https://pbs.twimg.com/profile_images/509142658716286976/5h1CGBZk_normal.jpeg",
      "profile_banner_url": "https://pbs.twimg.com/profile_banners/244296954/1410224044",
      "profile_link_color": "D21033",
      "profile_sidebar_border_color": "000000",
      "profile_sidebar_fill_color": "FFFFFF",
      "profile_text_color": "666666",
      "profile_use_background_image": true,
      "default_profile": false,
      "default_profile_image": false,
      "following": true,
      "follow_request_sent": false,
      "notifications": false
    },
    "geo": null,
    "coordinates": null,
    "place": null,
    "contributors": null,
    "retweet_count": 0,
    "favorite_count": 1,
    "entities": {
      "hashtags": [],
      "symbols": [],
      "urls": [],
      "user_mentions": []
    },
    "favorited": false,
    "retweeted": false,
    "lang": "en"
  }
];

