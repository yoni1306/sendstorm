module.exports = {
    mq: "amqp://sendstorm:Yia1ujai@localhost:5672",
    db: {
        connectionLimit: 10,
        host: 'localhost',
        user: 'root',
        password: 'mysqlroot',
        database: 'sendstorm'
    },
    OPERATION_TYPE: {
    	RESOLVING: "RESOLVING",
    	TRACKING: "TRACKING"
    },
    OPERATION_MAX_LIMIT: {
    	RESOLVING: 1000,
    	TRACKING: 150
    }
};
