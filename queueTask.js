var connection = require('./connection');
var contacts = require('./models/contacts');
var amqp = require('amqplib/callback_api');
var config = require('./config');

connection.init();

function QueueTask() {
    this.execute = function(contactIDs, callback) {

        if ((typeof contactIDs == "undefined") || (!Array.isArray(contactIDs)))
            return;

        contacts.findByIds(contactIDs, function(data) {

            if (!data) {
                if (callback)
                    callback(false);
                return;
            }

            amqp.connect(config.mqConnectionString, function(err, conn) {
                conn.createChannel(function(err, ch) {
                    var queues = {"resolveContact": [], "trackContact": []};
                    data.forEach(function(contact) {
                        switch (contact.status) {
                        case "UNRESOLVED":
                            queues.resolveContact.push(contact.contact_id);
                            break;
                        case "RESOLVED":
                            queues.trackContact.push(contact.contact_id);
                            break;
                        }
                    });

                    Object.keys(queues).forEach(function(queue) {
                        var ids = queues[queue];
                        if (!ids.length)
                            return;
                        var msg = JSON.stringify({"backgroundTask": true, "contactIDs": ids});
                        console.log("Sending", msg);
                        ch.assertQueue(queue, {durable: true});
                        ch.sendToQueue(queue, new Buffer(msg), {persistent: true});
                    });
                    if (callback)
                        callback(true);
                });
            });
        });
    }
};

module.exports = new QueueTask();