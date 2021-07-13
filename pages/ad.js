var fs = require('fs');
var path = require('path');

module.exports.setup = (server) => {
    var ads = [];

    try {
        var adpath = path.join('styles', server.settings.ADS_FOLDER)
        fs.readdirSync(adpath).forEach(file => {
            ads.push(path.join('/', adpath, file))
        });
    } catch {
    }

    return {
        permission: -1,
        navbar: false,
        title: 'Ad',
        path: '/ad',
        cb: (req, res) => {
            res.json(ads);
        }
    };
};
