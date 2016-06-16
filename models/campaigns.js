var connection = require('../connection');
var queueManager = require("./../queueManager");
var errors = require("../errors");
var async = require("async");
var contacts = require("./contacts");

function Campaigns() {

    var self = this;

    this.get = function(res) {
        var self = this;

        connection.acquire(function(err, con) {
            con.query('SELECT * FROM campaigns', function(err, result) {
                con.release();

                if (typeof result == "undefined") {
                    res.send("Cannot fetch campaigns from DB", 500);
                    return;
                }

                contacts.attach(result, function(data) {
                    res.send(result);
                });
            });
        });
    };

    this.getOne = function(id, res, callback) {
        var self = this;

        connection.acquire(function(err, con) {
            con.query('SELECT * FROM campaigns WHERE campaign_id = ?', [id], function(err, result) {
                con.release();

                if (typeof result == "undefined") {
                    res.send("Cannot fetch campaigns from DB", 500);
                    return;
                }

                contacts.attach(result, function(data) {
                    if (typeof callback != 'undefined')
                        callback(result[0]);
                    else
                        res.send(result[0]);
                });
            });
        });
    };

    this.delete = function(id, res, callback) {
        var self = this;

        connection.acquire(function(err, con) {
            con.query('DELETE FROM operational_contacts WHERE campaign_id = ?', [id], function(err, result) {
                con.query('DELETE FROM campaigns WHERE campaign_id = ?', [id], function(err, result) {
                    con.release();
                    if (typeof result == "undefined" || result.affectedRows == 0) {
                        res.send("No such campaign found", 500);
                        return;
                    } else {
                        res.send('{"status":"ok"}');
                    }
                });
            });
        });
    };

    this.create = function(data, res) {
        var self = this;

        errors
            .clean()
            .isEmpty("name", data.name, "Invalid name");
        //.isURL("launchUrl", data.launchUrl, "Invalid launch URL");

        if (!Array.isArray(data.contacts))
            data.contacts = [];

        if (Array.isArray(data.contactIDs))
            data.contactIDs.forEach(function(id) {
                data.contacts.push({ "contact_id": id });
            });
        delete data.contactIDs;

        if (errors.has()) {
            res.send({ errors: errors.get() }, 400);
            return;
        }

        connection.acquire(function(err, con) {
            con.query('INSERT INTO campaigns set ?', { "name": data.name, "account_id": 1 }, function(err, result) {
                if (err) {
                    res.send({ message: 'Campaign creation failed' }, 400);
                    con.release();
                    return;
                }

                var campaignId = result.insertId;

                async.map(data.contacts, function(contact, cb) {
                    contacts.create(contact, null, function(err, newcontact) {
                        if (!newcontact)
                            cb(null, null);
                        else
                            con.query("INSERT INTO operational_contacts SET ?", {
                                "campaign_id": campaignId,
                                "contact_id": newcontact.contact_id,
                            }, function(err, r) {
                                cb(null, result);
                            });
                    });
                }, function(err, result) {
                    con.release();
                    self.getOne(campaignId, res, function(data) {
                        res.send(data);
                        if (typeof data.contacts == 'undefined')
                            return;

                        queueManager.dataChangeHandler();
                    });
                });
            });
        });
    };
};

module.exports = new Campaigns();
