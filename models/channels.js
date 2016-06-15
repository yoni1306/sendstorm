var connection = require('../connection');
var errors = require("../errors");
var async = require("async");
var config = require('../config');

function Channels() {
    var $this = this;

    function def(value) {
        if (typeof value == "undefined")
            return "";
        return value.toString();
    }

    $this.findByIds = function(ids, callback) {
        var $this = this;

        connection.acquire(function(err, con) {
            var tmp = ids.map(function(id) {
                return parseInt(id);
            }).join(",");
            con.query('SELECT * FROM channels WHERE channel_id IN (' + tmp + ')', function(err, result) {
                con.release();
                callback(result);
            });
        });
    };

    $this.findBy = function(field, value, res, callback) {
        var $this = this;

        connection.acquire(function(err, con) {
            con.query('SELECT * FROM channels WHERE `' + field + '` = ?', [def(value)], function(err, result) {
                con.release();
                if (result && (result.length > 0))
                    callback(err, result[0]);
                else
                    callback(err, null);
            })
        });

    };

    $this.getOne = function(id, res, callback) {
        var $this = this;

        $this.findBy("channel_id", id, res, function(err, result) {
            if (typeof callback != "undefined")
                callback(err, result);
            else if (err)
                res.send("Cannot fetch contact from DB", 500);
            else if (result)
                res.send(result);
            else
                res.send("Contact not found", 404);
        });
    };

    $this.get = function(res, callback) {
        var $this = this;

        connection.acquire(function(err, con) {
            con.query('SELECT * FROM channels', function(err, result) {
                con.release();
                if (typeof callback != "undefined")
                    callback(err, result);
                else if (err)
                    res.send("Cannot fetch channels from DB", 500);
                else
                    res.send(result);
            });
        });
    };

    $this.findAvailableChannelsForOperation = function(operationType, callback) {
        var $this = this;

        if (!operationType) {
            callback('Operation type is missing', null);
            return;
        }

        connection.acquire(function(err, con) {
            con.query('SELECT channel_id, used_contacts_amount FROM channels WHERE valid = TRUE AND operation_type = ? AND used_contacts_amount < ?', [operationType, config.OPERATION_MAX_LIMIT[operationType]], function(err, result) {
                con.release();

                callback(err, result);
            });
        });
    };

    $this.updateUsedContactsAmount = function(channelID, addedAmount) {
        var $this = this;

        connection.acquire(function(err, con) {
            $this.getOne(channelID, null, function(channel) {
                con.query('UPDATE channels SET used_contacts_amount = ? WHERE channel_id = ?', [channel.used_contacts_amount + addedAmount, channelID]);
                con.release();
            });
        });
    };

    $this.assignNewChannelForOperation = function(operationType, callback) {
        var $this = this;

        if (!operationType) {
            callback('Operation type is missing', null);
            return;
        }

        connection.acquire(function(err, con) {
            con.query('SELECT * FROM channels WHERE valid = TRUE AND operation_type IS NULL LIMIT 1', function(err, result) {
                if (err) {
                    con.release();

                    callback(err, result);
                    return;
                }

                con.query('UPDATE channels set operation_type = ? WHERE channel_id = ?', [operationType, result.channel_id]);

                con.release();

                callback(err, result);
            });
        });
    }
}

module.exports = new Channels();
