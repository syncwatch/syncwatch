module.exports.setup = (server) => {
    return {
        permission: 0,
        navbar: true,
        nav_align: 'left',
        title: 'Watched',
        path: '/watched',
        cb: (req, res) => {
            server.db.getWatchedPercentages(req.session.username, (watched) => {
                res.render('watched', server.helpers.getRenderInfo(server.pages, req, {
                    watched
                }));
            });
        }
    };
}