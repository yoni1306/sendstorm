var mysql = require('mysql');
var config = require('./config');

function Connection() {
    this.pool = null;

    this.init = function() {
        this.pool = mysql.createPool(config.db);
    };

    this.acquire = function(callback) {
        this.pool.getConnection(function(err, connection) {
            callback(err, connection);
        });
    };
}

module.exports = new Connection();