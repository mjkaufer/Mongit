var crypto = require('crypto');
var config = require('../config/settings');
exports.decrypt = function(encrypted){
  var decipher = crypto.createDecipher(config.algo, config.key);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
exports.encrypt = function(text){
  if(typeof text == "object")
    text = JSON.stringify(text);//has to be a string

  cipher = crypto.createCipher(config.algo, config.key);
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

exports.compare = function(object, query){//basically, identify whether or not a query matches the object to decide whether to return it

  for(var i in query){
    if(object[i] != query[i])
      return false;
    }
    return true;

}
