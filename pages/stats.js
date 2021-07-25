module.exports.setup = (server) => {
    return {
        permission: server.settings.STATUS_PERMISSIONS,
        navbar: true,
        nav_align: 'left',
        title: 'Stats',
        path: '/stats',
        cb: (req, res) => {
            res.render('stats', server.helpers.getRenderInfo(server.pages, req, {}));
        }
    };
};
