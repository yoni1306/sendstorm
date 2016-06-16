var connection = require('../connection');
var errors = require("../errors");
var async = require("async");
var channels = require("./channels");
var config = require("../config");

function OperationalContacts() {
    var self = this;

    function def(value) {
        if (typeof value == "undefined")
            return "";
        return value.toString();
    }

    this.findByIds = function(ids, campaign_id, callback) {
        var self = this;

        connection.acquire(function(err, con) {
            var tmp = ids.map(function(id) {
                return parseInt(id);
            }).join(",");
            con.query('SELECT * FROM operational_contacts WHERE campaign_id = ' + campaign_id + ' AND contact_id IN (' + tmp + ')', function(err, result) {
                con.release();
                callback(result);
            });
        });
    };

    this.findBy = function(field, value, res, callback) {
        var self = this;

        connection.acquire(function(err, con) {
            con.query('SELECT * FROM operational_contacts WHERE `' + field + '` = ?', [def(value)], function(err, result) {
                con.release();
                if (result && (result.length > 0))
                    callback(err, result[0]);
                else
                    callback(err, null);
            })
        });

    };

    this.findByPhone = function(phone, res, callback) {
        var self = this;

        self.findBy("phone_number", def(phone).replace(/[^\d]/g, ""), res, callback);
    };

    this.getOne = function(id, res, callback) {
        var self = this;

        self.findBy("contact_id", id, res, function(err, result) {
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

    this.get = function(res, callback) {
        var self = this;

        connection.acquire(function(err, con) {
            con.query('SELECT * FROM operational_contacts', function(err, result) {
                con.release();
                if (typeof callback != "undefined")
                    callback(err, result);
                else if (err)
                    res.send("Cannot fetch operational_contacts from DB", 500);
                else
                    res.send(result);
            });
        });
    };

    this.findContactsForOperation = function(operationType, callback) {
        var self = this;

        if (!operationType) {
            callback('Operation type is missing', null);
            return;
        }

        connection.acquire(function(err, con) {
            if (operationType === config.OPERATION_TYPE.RESOLVING) {
                con.query('SELECT distinct(contacts.contact_id) FROM contacts INNER JOIN operational_contacts ON contacts.status = "UNRESOLVED" AND targeted = FALSE AND ignored = FALSE AND channel_id IS NULL AND contacts.contact_id = operational_contacts.contact_id', function(err, result) {
                    con.release();

                    callback(err, result);
                });
            } else {
                con.query('SELECT distinct(contacts.contact_id) FROM contacts INNER JOIN operational_contacts ON contacts.status = "RESOLVED" AND valid = TRUE AND targeted = FALSE AND ignored = FALSE AND channel_id IS NULL AND contacts.contact_id = operational_contacts.contact_id', function(err, result) {
                    con.release();

                    callback(err, result);
                });
            }
        });
    };

    this.assignContactsToChannel = function(channelID, contactIDs, callback) {
        var self = this;

        connection.acquire(function(err, con) {
            channels.updateUsedContactsAmount(channelID, contactIDs.length, function(err) {
                if (err) {
                    con.release();
                    callback(err);
                    return;
                }

                var tmp = contactIDs.map(function(id) {
                    return parseInt(id);
                }).join(",");

                con.query('UPDATE operational_contacts SET channel_id = ? WHERE contact_id IN (' + tmp + ')', [channelID]);

                con.release();

                callback();
            });
        });
    };
}

module.exports = new OperationalContacts();
