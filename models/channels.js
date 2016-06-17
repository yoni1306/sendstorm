var connection = require('../connection');
var errors = require("../errors");
var async = require("async");
var config = require('../config');

function Channels() {
    var self = this;

    function def(value) {
        if (typeof value == "undefined")
            return "";
        return value.toString();
    }

    self.findByIds = function(ids, callback) {
        var self = this;

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

    self.findBy = function(field, value, res, callback) {
        var self = this;

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

    self.getOne = function(id, res, callback) {
        var self = this;

        self.findBy("channel_id", id, res, function(err, result) {
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

    self.get = function(res, callback) {
        var self = this;

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

    self.findAvailableChannelsForOperation = function(operationType, callback) {
        var self = this;

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

    self.updateUsedContactsAmount = function(channelID, addedAmount, callback) {
        var self = this;

        connection.acquire(function(err, con) {
            self.getOne(channelID, null, function(err, channel) {
                if (err) {
                    con.release();
                    callback(err);
                    return;
                }

                con.query('UPDATE channels SET used_contacts_amount = ? WHERE channel_id = ?', [channel.used_contacts_amount + addedAmount, channelID]);
                con.release();
                callback();
            });
        });
    };

    self.allocateNewChannelsForOperation = function(operationType, contactsAmountToAllocate, callback) {
        var self = this;

        if (!operationType || !contactsAmountToAllocate) {
            callback('Operation type or contactsAmountToAllocate is missing', null);
            return;
        }

        var howManyChannelsAreNeeded = Math.ceil(contactsAmountToAllocate / config.OPERATION_MAX_LIMIT[operationType]);

        connection.acquire(function(err, con) {
            con.query('SELECT * FROM channels WHERE valid = TRUE AND operation_type IS NULL LIMIT ?', [howManyChannelsAreNeeded], function(err, newChannels) {
                if (err) {
                    con.release();

                    callback(err, newChannels);
                    return;
                }

                var channelIDs = newChannels.map(function(channel) {
                    return parseInt(channel.channel_id);
                }).join(",");

                con.query('UPDATE channels set operation_type = ? WHERE channel_id IN (' + channelIDs + ')', [operationType]);

                con.release();

                newChannels.forEach(function(channel){
                    channel.operation_type = operationType;
                });

                callback(err, newChannels);
            });
        });
    }
}

module.exports = new Channels();
