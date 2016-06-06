var express = require('express');
var app = express();

app.get('/ping', function (req, res) {
  res.send('pong');
});

app.listen(3000, function () {
  console.log('app listening on port 3000!');
});

