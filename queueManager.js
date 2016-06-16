var connection = require('./connection');
var contacts = require('./models/contacts');
var operationalContacts = require('./models/operationalContacts');
var channels = require('./models/channels');
var amqp = require('amqplib/callback_api');
var config = require('./config');
var errors = require('./errors');
var _ = require('underscore');

connection.init();

function QueueManager() {
    this.dataChangeHandler = function(isBackgroundTask, callback) {
        operationalContacts.findContactsForOperation(config.OPERATION_TYPE.RESOLVING, function(err, contactIDs) {
            if (err) {
                errors.add('findContactsForResolving - Error', err);
                return;
            }

            if (contactIDs && contactIDs.length) {
                contactIDs = _.pluck(contactIDs, 'contact_id');

                channels.findAvailableChannelsForOperation(config.OPERATION_TYPE.RESOLVING, function(err, availableChannels) {
                    if (err) {
                        errors.add('findAvailableChannelsForResolving - Error', err);
                        return;
                    }

                    if (availableChannels && availableChannels.length) {
                        assignContactsToChannelsForOperation(availableChannels, contactIDs, config.OPERATION_TYPE.RESOLVING);
                    } else {
                        channels.assignNewChannelForOperation(config.OPERATION_TYPE.RESOLVING, function(err, channel) {
                            if (err) {
                                errors.add('assignNewChannelForResolving - Error', err);
                                return;
                            }

                            if (channel) {
                                assignContactsToChannelsForOperation(channel, contactIDs, config.OPERATION_TYPE.RESOLVING);
                            }
                        });
                    }
                });
            }
        });

        if (errors.has) {
            errors.dump();
            return;
        }

        // if (!isBackgroundTask) {
        //     operationalContacts.findContactsForOperation(config.OPERATION_TYPE.TRACKING, function(err, contactIDs) {
        //         if (err) {
        //             errors.add('findContactsForResolving - Error', err);
        //             return;
        //         }

        //         if (contactIDs && contactIDs.length) {
        //             channels.findAvailableChannelsForOperation(config.OPERATION_TYPE.TRACKING, function(err, availableChannels) {
        //                 if (err) {
        //                     errors.add('findAvailableChannelsForResolving - Error', err);
        //                     return;
        //                 }

        //                 if (availableChannels && availableChannels.length) {
        //                     assignContactsToChannelsForOperation(availableChannels, contactIDs, config.OPERATION_TYPE.TRACKING);
        //                 } else {
        //                     channels.assignNewChannelForOperation(config.OPERATION_TYPE.TRACKING, function(err, channel) {
        //                         if (err) {
        //                             errors.add('assignNewChannelForResolving - Error', err);
        //                             return;
        //                         }

        //                         if (channel) {
        //                             assignContactsToChannelsForOperation(channel, contactIDs, config.OPERATION_TYPE.TRACKING);
        //                         }
        //                     });
        //                 }
        //             });
        //         }
        //     });

        //     if (errors.has) {
        //         errors.dump();
        //         return;
        //     }
        // }
    };

    function queueTask(channelID, contactIDs, operationType) {
        amqp.connect(config.mq, function(err, conn) {
            conn.createChannel(function(err, ch) {

                var queueName;

                if (operationType === config.OPERATION_TYPE.TRACKING) {
                    queueName = "trackContact";
                } else {
                    queueName = "resolveContact";
                }

                var msg = JSON.stringify({ "backgroundTask": false, "contactIDs": contactIDs, "channelID": channelID });

                console.log("Sending", msg);

                ch.assertQueue(queueName, { durable: true });
                ch.sendToQueue(queueName, new Buffer(msg), { persistent: true });

                setTimeout(function() { conn.close(); }, 5000);
            });
        });
    }

    function assignContactsToChannelsForOperation(channels, contactIDs, operationType) {
        if (!channels || !contactIDs || !operationType) {
            errors.add('assignContactsToChannelsForOperation - params', 'Missing params - channels,contactIDs,operationType');
            return;
        }

        channels = Array.isArray(channels) ? channels : [channels];

        var channelsIndex = 0,
            channelID, currentChannelContactsAmount, gap, assignedContacts;

        channels = _.sortBy(channels, 'used_contacts_amount');

        while (!errors.has() && contactIDs.length && channelsIndex < channels.length) {
            channelID = channels[channelsIndex].channel_id;
            currentChannelContactsAmount = channels[channelsIndex].used_contacts_amount;
            gap = config.OPERATION_MAX_LIMIT[operationType] - currentChannelContactsAmount;
            assignedContacts = contactIDs.slice(0, gap);

            operationalContacts.assignContactsToChannel(channelID, assignedContacts, function(err) {
                if (err) {
                    errors.add('assignContactsToChannelsForOperation - during run', err);
                    return;
                }

                queueTask(channelID, assignedContacts, operationType);

                contactIDs = contactIDs.splice(0, gap);
            });

            channelsIndex++;
        }

        if (contactIDs.length) {
            errors.add('assignContactsToChannelsForOperation - after run', 'contacts left without being assigned to a channel');
        }
    }
};

module.exports = new QueueManager();
