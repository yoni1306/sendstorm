var connection = require('./connection');
var contacts = require('./models/contacts');
var operationalContacts = require('./models/operationalContacts');
var channels = require('./models/channels');
var amqp = require('amqplib/callback_api');
var config = require('./config');
var errors = require('./errors');
var _ = require('underscore');
var Promise = require('bluebird');

connection.init();

var promiseWhile = function(condition, action) {
    var resolver = Promise.defer();

    var loop = function() {
        if (!condition()) return resolver.resolve();
        return Promise.cast(action())
            .then(loop)
            .catch(resolver.reject);
    };

    process.nextTick(loop);

    return resolver.promise;
};

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
                    if (err || !availableChannels) {
                        errors.add('findAvailableChannelsForResolving - Error', err);
                        return;
                    }

                    var availableChannelsCapacity = 0;

                    availableChannels.forEach(function(channel) {
                        availableChannelsCapacity += config.OPERATION_MAX_LIMIT[config.OPERATION_TYPE.RESOLVING] - channel.used_contacts_amount;
                    });

                    // If the current channels capacity is not enough, we surely know that we need to allocate more channels for this operation
                    if (availableChannelsCapacity < contactIDs.length) {
                        channels.allocateNewChannelsForOperation(config.OPERATION_TYPE.RESOLVING, contactIDs.length, function(err, newChannels) {
                            if (err || !newChannels) {
                                errors.add('assignNewChannelsForResolving - Error', err);
                                return;
                            }

                            assignContactsToChannelsForOperation(availableChannels.concat(newChannels), contactIDs, config.OPERATION_TYPE.RESOLVING);
                        });
                    } else {
                        assignContactsToChannelsForOperation(availableChannels, contactIDs, config.OPERATION_TYPE.RESOLVING);
                    }
                });
            }
        });

        if (errors.has()) {
            errors.dump();
            return;
        }

        if (!isBackgroundTask) {
            operationalContacts.findContactsForOperation(config.OPERATION_TYPE.TRACKING, function(err, contactIDs) {
                if (err) {
                    errors.add('findContactsForResolving - Error', err);
                    return;
                }

                if (contactIDs && contactIDs.length) {
                    contactIDs = _.pluck(contactIDs, 'contact_id');

                    channels.findAvailableChannelsForOperation(config.OPERATION_TYPE.TRACKING, function(err, availableChannels) {
                        if (err || !availableChannels) {
                            errors.add('findAvailableChannelsForTracking - Error', err);
                            return;
                        }

                        var availableChannelsCapacity = 0;

                        availableChannels.forEach(function(channel) {
                            availableChannelsCapacity += config.OPERATION_MAX_LIMIT[config.OPERATION_TYPE.TRACKING] - channel.used_contacts_amount;
                        });

                        // If the current channels capacity is not enough, we surely know that we need to allocate more channels for this operation
                        if (availableChannelsCapacity < contactIDs.length) {
                            channels.allocateNewChannelsForOperation(config.OPERATION_TYPE.TRACKING, contactIDs.length, function(err, newChannels) {
                                if (err || !newChannels) {
                                    errors.add('assignNewChannelsForResolving - Error', err);
                                    return;
                                }

                                assignContactsToChannelsForOperation(availableChannels.concat(newChannels), contactIDs, config.OPERATION_TYPE.TRACKING);
                            });
                        } else {
                            assignContactsToChannelsForOperation(availableChannels, contactIDs, config.OPERATION_TYPE.TRACKING);
                        }
                    });
                }
            });

            if (errors.has()) {
                errors.dump();
                return;
            }
        }
    };

    function queueTask(channelID, contactIDs, operationType, callback) {
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

                if (callback) {
                    callback();
                }

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

        return promiseWhile(function() {
            // Condition for stopping
            return !errors.has() && contactIDs.length && channelsIndex < channels.length;
        }, function() {
            // Action to run, should return a promise
            return new Promise(function(resolve, reject) {
                channelID = channels[channelsIndex].channel_id;
                currentChannelContactsAmount = channels[channelsIndex].used_contacts_amount;
                gap = config.OPERATION_MAX_LIMIT[operationType] - currentChannelContactsAmount;
                assignedContacts = contactIDs.slice(0, gap);
                contactIDs = contactIDs.splice(gap);
                channelsIndex++;

                operationalContacts.assignContactsToChannel(channelID, assignedContacts, function(err) {
                    if (err) {
                        errors.add('assignContactsToChannelsForOperation - during run', err);
                        reject();
                        return;
                    }

                    queueTask(channelID, assignedContacts, operationType, function() {
                        resolve();
                    });
                });
            });
        }).then(function() {
            // Notice we can chain it because it's a Promise, 
            // this will run after completion of the promiseWhile Promise!
            if (errors.has()) {
                errors.dump();
            }
        });
    }
};

module.exports = new QueueManager();
