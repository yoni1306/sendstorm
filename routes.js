var campaigns = require('./models/campaigns');

module.exports = {
    configure: function(app) {
        app.get('/api/campaigns/', function(req, res) {
            campaigns.get(res);
        });

        app.get('/api/campaigns/:id/', function(req, res) {
            campaigns.getOne(req.params.id, res);
        });
        app.post('/api/campaigns/', function(req, res) {
            campaigns.create(req.body, res);
        });

        app.put('/api/campaigns/', function(req, res) {
            campaigns.update(req.body, res);
        });

        app.delete('/api/campaigns/:id/', function(req, res) {
            campaigns.delete(req.params.id, res);
        });
    }
};