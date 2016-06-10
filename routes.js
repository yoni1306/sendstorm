var campaigns = require('./models/campaigns');
var contacts = require('./models/contacts');

module.exports = {
    configure: function(app) {
        app.get('/campaigns/', function(req, res) {
            campaigns.get(res);
        });

        app.get('/campaigns/:id/', function(req, res) {
            campaigns.getOne(req.params.id, res);
        });
        app.post('/campaigns/', function(req, res) {
            campaigns.create(req.body, res);
        });

        app.put('/campaigns/', function(req, res) {
            campaigns.update(req.body, res);
        });

        app.delete('/campaigns/:id/', function(req, res) {
            campaigns.delete(req.params.id, res);
        });

        app.get('/contacts/', function(req, res) {
            contacts.get(res);
        });

        app.get('/contacts/:id/', function(req, res) {
            contacts.getOne(req.params.id, res);
        });
        app.post('/contacts/', function(req, res) {
            contacts.create(req.body, res);
        });
    }
};
