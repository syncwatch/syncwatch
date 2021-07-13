var fs = require('fs');
var path = require('path');

module.exports.setup = (server) => {
    var ads = [];

    var lastRefresh = 0;

    function refreshFiles() {
        try {
            ads = [];
            var adpath = path.join('styles', server.settings.ADS_FOLDER)
            fs.readdirSync(adpath).forEach(file => {
                ads.push(path.join('/', adpath, file))
            });
        } catch {
        }
    }

    function checkRefreshFiles() {
        if (lastRefresh < Date.now() - 1000 * server.settings.FILES_REFRESH_SECONDS) {
            refreshFiles();
        }
    }

    checkRefreshFiles();

    return {
        permission: -1,
        navbar: false,
        title: 'Ad',
        path: '/ad',
        cb: (req, res) => {
            checkRefreshFiles();
            res.json(ads);
        }
    };
};
