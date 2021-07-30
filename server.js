async function main() {
    var settings = require('./settings.js');
    var helpers = require('./helpers/functions.js');
    var db = await require('./helpers/database.js').createDatabase(settings);

    var path = require('path');
    var fs = require('fs');

    var http = require('http');
    var express = require('express');
    var app = express();
    var session = require('express-session');
    var http_server = http.Server(app);
    var io = require('socket.io')(http_server, {
        allowEIO3: true // false by default
    });

    var bodyParser = require('body-parser');

    var { Liquid } = require('liquidjs');

    var lastRefresh = 0;

    var room_manager = require('./helpers/room_manager.js').createRoomManager();

    function log(msg, save = true) {
        helpers.log(msg, save, db);
    }

    function walkFileTree(relpath, series = null, season = null, episode = null) {
        var files = [];
        fs.readdirSync(path.join(settings.FILES_PATH, relpath)).map((file) => {
            var ext = path.extname(file);
            var basename = path.basename(file, ext);
            var fobj = {
                relpath: path.join(relpath, file),
                parent: relpath,
                series: series,
                season: season,
                episode: episode,
                filename: file,
                directory: !helpers.isFile(file),
                extension: ext,
            };
            if (ext === settings.EPISODE_EXTENSION) {
                fobj.episode = basename;
            } else if (ext === settings.SEASON_EXTENSION) {
                fobj.season = basename;
            } else if (ext === settings.SERIES_EXTENSION) {
                fobj.series = basename;
            }
            return fobj;
        }).forEach((file) => {
            if (file.directory) {
                files.push(file);
                files = files.concat(walkFileTree(file.relpath, file.series, file.season, file.episode));
            } else {
                files.push(file);
            }
        });
        return files;
    }

    function checkRefreshFiles() {
        if (lastRefresh < Date.now() - 1000 * settings.FILES_REFRESH_SECONDS) {
            refreshFiles();
        }
    }

    function refreshFiles() {
        lastRefresh = Date.now();
        var files = walkFileTree('');
        db.updateFiles(files);
    }

    checkRefreshFiles();

    var port = process.env.PORT || 3000;

    process.argv.forEach((val, index, array) => {
        var split = val.split('=');
        if (split.length == 2 & split[0] == 'port') {
            port = +split[1];
        }
    });

    var sessionMiddleware = session({
        secret: settings.SESSION_SECRET,
        resave: true,
        saveUninitialized: true
    });

    var statusMonitor = await require('./helpers/monitor.js').createMonitor(io);

    app.use(statusMonitor.middleware); // important to run first
    app.use(sessionMiddleware);
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    var engine = new Liquid({
        root: path.resolve(__dirname, 'views/'),
        extname: '.liquid'
    })

    app.engine('liquid', engine.express()) // register liquid engine
    app.set('view engine', 'liquid') // set to default

    // express status monitor
    app.get('/status', (req, res) => {
        if (helpers.hasPermission(req.session.permission, settings.STATUS_PERMISSIONS)) {
            statusMonitor.pageRoute(req, res);
        } else {
            res.status(403).send('No Permission');
        }
    });

    var pages = [
        'home',
        'filesnav',
        'files',
        'moviesnav',
        'movies',
        'upload',
        'recent',
        'watched',
        'users',
        'log',
        'stats',
        'profile',
        'logout',
        'start',
        'api',
        'player',
        'room',
        'ad',
    ];

    var serverObj = {
        io,
        engine,
        pages,
        log,
        db,
        helpers,
        settings,
        refreshFiles,
        checkRefreshFiles,
        room_manager,
    };

    for (var i = 0; i < pages.length; i++) {
        pages[i] = require('./pages/' + pages[i] + '.js').setup(serverObj);
    }

    pages.forEach(page => {
        helpers.secureAccess(page);
    });


    pages.forEach(page => {
        if (page.cb) {
            app.get(page.path, page.cb);
        }
        if (page.pcb) {
            app.post(page.path, page.pcb);
        }
        if (page.scb) {
            io.of(page.path).use((socket, next) => {
                sessionMiddleware(socket.request, socket.request.res || {}, next);
            });
            io.of(page.path).on('connection', socket => {
                page.scb(socket);
            });
        }
    });


    app.use('/styles', express.static('styles'));

    http_server.listen(port, () => {
        log('listening on *:' + port, false);
    });
}

console.log('starting server...');
main();
