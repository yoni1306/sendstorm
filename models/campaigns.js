var connection = require('../connection');
var validator = require("validator");

function Campaigns() {

    var $this = this;

    function attachContacts(con, campaigns, callback) {
        pending = campaigns.length;
        campaigns.forEach(function(campaign, k) {
            con.query("SELECT contacts.* FROM contacts INNER JOIN operational_contacts ON operational_contacts.campaign_id = ? AND contacts.contact_id = operational_contacts.contact_id", [campaign.campaign_id], function(err, result) {
                campaigns[k].contacts = result;
                if (--pending == 0)
                    callback(campaigns);
            });
        });
    }

    this.get = function(res) {
        connection.acquire(function(err, con) {
            con.query('SELECT * FROM campaigns', function(err, result) {
                if (typeof result == "undefined") {
                    res.send("Cannot fetch campaigns from DB", 500);
                    return;
                }

                attachContacts(con, result, function(data) {
                    res.send(result);
                    con.release();
                });
            });
        });
    };

    this.getOne = function(id, res) {
        connection.acquire(function(err, con) {
            con.query('SELECT * FROM campaigns WHERE campaign_id = ?', [id], function(err, result) {
                if (typeof result == "undefined") {
                    res.send("Cannot fetch campaigns from DB", 500);
                    return;
                }

                attachContacts(con, result, function(data) {
                    res.send(result[0]);
                    con.release();
                });
            });
        });
    };

    this.create = function(data, res) {

        var errors = {};
        if (!validator.isLength(data.name, {min:1})) errors.name = "Invalid name";
        if (!validator.isURL(data.launchUrl)) errors.launchUrl = "Invalid launch URL";

        if (Array.isArray(data.contacts)) {
            data.contacts.forEach(function(contact, k) {
                if (!validator.isLength(contact.name, {min:1})) errors["contact #" + k + " name"] = "Invalid Name";
                if (!validator.isLength(contact.phoneNumber, {min:1})) errors["contact #" + k + " phoneNumber"] = "Invalid Phone Number";
            });
        }

        if (Object.keys(errors).length) {
            res.send({errors: errors}, 400);
            return;
        }

        connection.acquire(function(err, con) {
            con.query('INSERT INTO campaigns set ?', {"name": data.name, "launch_url": data.launchUrl} , function(err, result) {
                var campaignId = result.insertId;
                if (err) {
                    res.send({message: 'Campaign creation failed'}, 400);
                    con.release();
                    return;
                }

                var pending = 0;
                if (Array.isArray(data.contactIDs)) pending += data.contactIDs.length;
                if (Array.isArray(data.contacts)) pending += data.contacts.length;

                var callback = function() {
                    $this.getOne(campaignId, res);
                    con.release();
                };

                if (Array.isArray(data.contactIDs)) {
                    data.contactIDs.forEach(function(id) {
                        con.query("INSERT INTO operational_contacts SET ?", {
                            "campaign_id": result.insertId,
                            "contact_id": id,
                        }, function(err, result) {
                            if (--pending == 0)
                                callback();
                        });
                    });
                }

                if (Array.isArray(data.contacts)) {
                    data.contacts.forEach(function(contact) {
                        var contactData = {
                            "name": contact.name,
                            "phone_number": contact.phoneNumber,
                            "phone_code": contact.phoneNumber.toString().replace(/[^\d]/, "").substr(0,3),
                        };

                        if (validator.isInt(contact.id))
                            contactData.id = contact.id;

                        con.query("INSERT INTO contacts SET ?", contactData, function(err, result) {
                            var contactId = (typeof result != "undefined") ? result.insertId : contact.id;
                            con.query("INSERT INTO operational_contacts SET ?", {
                                "campaign_id": campaignId,
                                "contact_id": contactId,
                            }, function(err, result) {
                                if (--pending == 0)
                                    callback();
                            });
                        });
                    });
                }
            });
        });
    };
}

module.exports = new Campaigns();
