var config = {}

config.subredditName = "Mongoit";
config.postId = "2izkvt";
config.parentName = "t3_" + config.postId; // should be dynamic later
config.algo = "aes256;"
config.key = "RazzeFrazzle"; // this shouldn't change after you first run it for obv reasons

module.exports = config;
