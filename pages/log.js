module.exports.setup = (server) => {
    return {
        permission: 2,
        navbar: true,
        nav_align: 'left',
        title: 'Log',
        path: '/log',
        cb: (req, res) => {
            server.db.getLog((rows) => {
                res.render('log', server.helpers.getRenderInfo(server.pages, req, { logs: rows }));
            })
        }
    };
};
