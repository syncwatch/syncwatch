module.exports.setup = (server) => {
    return {
        permission: 0,
        navbar: true,
        nav_align: 'left',
        title: 'Recent',
        path: '/recent',
        cb: (req, res) => {
            server.db.getMoviesByAddedTime(-1, (movies) => {
                res.render('recent', server.helpers.getRenderInfo(server.pages, req, {
                    movies
                }));
            });
        }
    };
}