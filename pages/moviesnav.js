module.exports.setup = (server) => {
    return {
        permission: 0,
        navbar: true,
        nav_align: 'left',
        title: 'Movies',
        path: '/movies/',
        cb: (req, res) => {
            server.checkRefreshFiles();
            res.render('movies', server.helpers.getRenderInfo(server.pages, req, {}));
        }
    };
};
