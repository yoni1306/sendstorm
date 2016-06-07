var connection = require('../connection');
var errors = require("../errors");
var async = require("async");

function Contacts() {

    var $this = this;

    function def(value) {
        if (typeof value == "undefined")
            return "";
        return value.toString();
    }

    this.attach = function(campaigns, callback) {
        connection.acquire(function(err, con) {
            async.map(campaigns, function(campaign, cb) {
                con.query("SELECT contacts.* FROM contacts INNER JOIN operational_contacts ON operational_contacts.campaign_id = ? AND contacts.contact_id = operational_contacts.contact_id", [campaign.campaign_id], function(err, result) {
                    var tmp = campaign;
                    if (result && result.length > 0)
                        tmp.contacts = result;
                    cb(null, tmp);
                });
            }, function(err, results) {
                con.release();
                callback(campaigns);
            });
        });
    };

    this.findBy = function(field, value, res, callback) {
        connection.acquire(function(err, con) {
            con.query('SELECT * FROM contacts WHERE `'+field+'` = ?', [def(value)], function(err, result) {
                con.release();
                if (result && (result.length > 0))
                    callback(err, result[0]);
                else
                    callback(err, null);
            })
        });

    };

    this.findByPhone = function(phone, res, callback) {
        this.findBy("phone_number", def(phone).replace(/[^\d]/g, ""), res, callback);
    };

    this.create = function(data, res, callback) {

        var create = function(data) {

            errors.clean();
            errors.isEmpty("name", data.name, "Invalid name");
            errors.isEmpty("phoneNumber", data.phoneNumber, "Invalid phone number");

            if (errors.has()) {
                if (callback)
                    callback(errors.get(), null);
                else
                    res.send({errors: errors.get()}, 400);
                return;
            }

            connection.acquire(function(err, con) {
                con.query('INSERT INTO contacts SET ?', {
                    name: data.name,
                    phone_number: def(data.phoneNumber).replace(/[^\d]/g, ""),
                    phone_code: def(data.phoneNumber).replace(/[^\d]/g, "").substr(0,3)
                }, function(err, result) {
                    con.release();
                    if (!err) {
                        $this.getOne(result.insertId, res, function(err, result) {
                            if (typeof callback != "undefined")
                                callback(err, result);
                            else
                                res.send(result);
                        });
                    }
                });
            });
        };

        var ecb = function(err, contact) {
            if (contact) {
                if (callback)
                    callback(err, contact)
                else
                    res.send(contact);
                return;
            }
            create(data);
        };

        if (typeof data.id != "undefined") {
            this.getOne(data.id, res, ecb);
            return;
        }
        if (typeof data.phoneNumber != "undefined") {
            this.findByPhone(data.phoneNumber, res, ecb);
            return;
        }

        create(data);
    };

    this.getOne = function(id, res, callback) {
        this.findBy("contact_id", id, res, function(err, result) {
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
        connection.acquire(function(err, con) {
            con.query('SELECT * FROM contacts', function(err, result) {
                con.release();
                if (typeof callback != "undefined")
                    callback(err, result);
                else if (err)
                    res.send("Cannot fetch contacts from DB", 500);
                else
                    res.send(result);
            });
        });
    };
}

module.exports = new Contacts();
