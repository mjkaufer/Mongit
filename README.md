# Mongit

Mongo-esque Reddit-based Database!

## WTF?

Mongit gives users a way to store data in the cloud without needing to purchase and setup a database. Just use Reddit!

All entries are encrypted with `AES256` encryption!

**Note, unless you are legitimately insane, you should not use this in large, enterprise, production environments. It's more of a proof of concept.**

## Installation & Running

Install using `npm install`. You'll need a subreddit and a post in that subreddit. Substitute the subreddit name into the variable `subredditName` and the id of the post into `postId`. Then, to run the console, type in `node main.js --user $redditUsername --pass $redditPassword`. You might want to make it so that your subreddit only allows moderators to post, so nobody can 'inject' data into your server.

## Usage

Currently, all usage is done in the REPL, but you can easily see the methods being called and call them instead of using the REPL.

`find([query],[callback])` - Similar to MongoDB, you can pass search criteria. `find()` will find all entries whereas `find({"test":1})` would return all entries where the field `test` exists and has a value of `1`. The callback is a function which receives one argument, the array of everything found in the 'database'.

`insert(json[, callback])` - Again, like Mongo, you need to pass a JSON to actually be inserted into the database. The callback takes an argument of a boolean lets you know whether or not the insert when through successfully - `true` means it worked.

`del(query[, callback])` - Deletes a query, like Mongo. Criteria is what criteria you want deleted. Currently only works with `_id` right now. Example: `del({_id:"abc123"})` would delete the entry with an id of abc123. The callback takes an argument of a boolean lets you know whether or not the insert when through successfully - `true` means it worked.

`update(query, newvalue[, callback])` - Updates a query - only based on `_id` right now. `newvalue` is what it'll be set to. The callback takes an argument of a boolean lets you know whether or not the insert when through successfully - `true` means it worked.

## How it works

Each entry in the database is actually a comment on a subreddit post. The database is just a post in a subreddit. Using Reddit's API, you grab the comments, parse them as a JSON, and return them!

## Todo

* Support to easily make multiple 'databases', which are basically just posts in the subreddit
* Mongo selectors & delimeters & stuff in the `find` method
* Dynamic 'database' generation - find all posts and treat them as different DBs
* Support for updates & deletes independent of `_id`s

This was all made at a hackathon, so naturally it's not the most refined thing. It's also a proof of concept. 