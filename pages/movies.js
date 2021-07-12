var path = require('path');

module.exports.setup = (server) => {
    return {
        permission: 0,
        navbar: false,
        title: 'Movies',
        path: '/movies/:path(*)',
        cb: (req, res) => {

            var split_req = req.params.path.split('/');
            var relpath = split_req.join(path.sep);

            server.db.getMovieFile(relpath, (file) => {
                // if file not found
                if (!file) {
                    res.redirect('/movies');
                    res.end();
                    return;
                }

                // send video player
                if (file.extension == server.settings.EPISODE_EXTENSION
                    || server.settings.MOVIE_FORMAT_EXTENSIONS.includes(file.extension)) {
                    req.session.watching_id = relpath;
                    res.redirect('/player/');
                    res.end();
                    res.render('player', server.helpers.getRenderInfo(server.pages, req, { parent: file.parent }));
                    return;
                }

                server.checkRefreshFiles();

                // show folder
                if (file.directory === 1) {
                    var history = split_req.map((v, i) => {
                        return {
                            name: v,
                            path: split_req.slice(0, i + 1).join(path.sep)
                        };
                    });
                    res.render('movies', server.helpers.getRenderInfo(server.pages, req, { history }));
                    return;
                }

                res.redirect('/movies');
                res.end();
                return;

            });


        }
    };
};
