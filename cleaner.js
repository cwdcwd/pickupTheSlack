var _ = require('lodash');
var request = require('request');
var kue = require('kue'),
  queue = kue.createQueue();

var token = process.env.SLACK_TOKEN;
var username = 'lazybaer';
var searchURL = 'https://slack.com/api/search.all?token=' + token + '&query=from%3A' + username + '&pretty=1&count=500';
var blnLoop = true;
var blnRunDelete = true;
var msDelay = 5000;

var loop = function() {

  request(searchURL, function(error, response, body) {
    if (error) {
      console.log(error);
      blnLoop = false;
      return;
    } else {
      var results = JSON.parse(body);
      blnLoop = (results.total > 0);
      console.log(results.messages);
      var messages = results.messages.matches;

      _.forEach(messages, function(val) {
        console.log(val.ts, val.channel.id, val.channel.name, val.text);
        var job = queue.create('msg', val).delay(msDelay).save(function(err) {
          if (err) {
            console.log(err);
          } else {
            console.log(job.id);
          }
        });

        job.attempts(5).backoff({
          type: 'exponential'
        })
      });
      //
    }
  });


  console.log('done processing');
};

queue.process('msg', function(job, done) {
  var val = job.data;

  if (blnRunDelete) {
    var deleteURL = 'https://slack.com/api/chat.delete?token=' + token + '&ts=' + val.ts +
      '&channel=' + val.channel.id + '&pretty=1 ';

    request(deleteURL, function(e, r, b) {
      if (e) {
        console.log(r, e);
        return done(new Error(e));
      } else {
        console.log(b);

        if (r.statusCode == 429) {
          console.log('Retry-After: ', r.headers["Retry-After"]);
          return done(new Error('needs to retry'));
        }

        return done(null, JSON.parse(b));
      }
    });
  } else {
    return done(null, JSON.parse(b));
  }
});

//loop();
process.nextTick(loop);
