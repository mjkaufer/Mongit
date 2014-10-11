var request  = require('request')
  , argv     = require('yargs').argv
  , modhash
  , cookie;

subredditName = "Mongit";



function login (callback) {
  var options = {
      url     : 'https://ssl.reddit.com/api/login?api_type=json&user=' + argv.user + '&passwd=' + argv.pass + '&rem=True',
      headers : {
        'User-Agent' : 'Mongit/0.0.1 by mjkaufer',
      },
      method  : 'POST'
  };

  request(options, function (err, res, body) {
    if (err) {
      console.log('LOGIN ERROR:');
      console.log(err);
      return;
    } else {
      var parsedBody = JSON.parse(body);
      modhash = parsedBody.json.data.modhash;
      cookie  = parsedBody.json.data.cookie;
      console.log("WE LOGGED IN");
      callback();
    }
  });
}

// function postText (message) {//this won't work bc we need to solve captchas :'(
//   var text     = message
//     , options  = {
//         url      : 'https://en.reddit.com/api/submit?api_type=json&sendreplies=false&title=DB' + new Date().getTime() + '&text=' + encodeURIComponent(text) + '&kind=self&sr=' + subredditName,
//         headers  : {
//             'User-Agent' : 'Mongit/0.0.1 by mjkaufer',
//             'X-Modhash'  : modhash,
//             'Cookie'     : 'reddit_session=' + encodeURIComponent(cookie)
//           },
//         method : 'POST'      
//     };

//   request(options, function (err, res, body) {
//     if (err) {
//       console.log('POST ERROR:');
//       console.log(err.stack);
//       return;
//     } else {
//       console.log('// RETURND //');
//       console.log(body);
//       console.log('// ------- //');
//     }
//   });
// }

function postComment (parentId, message) {
  var text     = message
    , options  = {
        url      : 'https://en.reddit.com/api/comment?api_type=json&text=' + encodeURIComponent(text) + '&thing_id=' + parentId,
        headers  : {
            'User-Agent' : 'Mongit/0.0.1 by mjkaufer',
            'X-Modhash'  : modhash,
            'Cookie'     : 'reddit_session=' + encodeURIComponent(cookie)
          },
        method : 'POST'      
    };

  request(options, function (err, res, body) {
    if (err) {
      console.log('COMMENT POST ERROR:');
      console.log(err.stack);
      return;
    } else {
      console.log('// COMMENT //');
      console.log(body);

      console.log('// ------- //');
    }
  });
}

login(function(){
	postComment("t3_2izhoz","Hurray");
});

