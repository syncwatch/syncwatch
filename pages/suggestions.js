var imdb = require('imdb-api');

module.exports.setup = (server) => {
    return {
        permission: 0,
        navbar: true,
        nav_align: 'left',
        title: 'Suggestions',
        path: '/suggestions',
        cb: (req, res) => {
            server.db.getSuggestions(req.session.username, (movies) => {
                res.render('suggestions', server.helpers.getRenderInfo(server.pages, req, { movies: movies }));
            });
        },
        pcb: (req, res) => {
            function onFinish() {
                res.redirect('/suggestions');
                res.end();
            }

            if (req.body && req.body.search) {
                try {
                    var search_url = new URL(req.body.search);
                    if (search_url.hostname === 'www.imdb.com') {
                        var search_split = search_url.pathname.split('/').filter((x) => x);
                        if (search_split.length >= 2 && search_split[0] === 'title') {
                            imdb.get(
                                { id: search_split[1] },
                                { apiKey: server.settings.OMDB_APIKEY }
                            ).then((movie) => {
                                server.db.addSuggestion(movie.imdbid, movie.title, movie.imdburl, movie.rating, movie.poster);
    
                                server.helpers.setInfo(req, 'Successfully added "' + movie.title + '" as suggestions', 'success');
                                onFinish();
                            }).catch((err) => {
                                server.log(err);
                                server.helpers.setInfo(req, "Error while searching IMDB");
                                onFinish();
                            });
                            return;
                        }
                    }
                } catch (e) {
                }
                server.helpers.setInfo(req, "Your search was not in the correct format");
                onFinish();
                return;
            }

            if (req.body && req.body.upvote === "" && req.body.id) {
                server.db.voteSuggestion(req.session.username, req.body.id);
                onFinish();
                return;
            }
        },
    };
};
