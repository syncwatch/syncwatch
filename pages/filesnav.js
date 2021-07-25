module.exports.setup = (server) => {
    return {
        permission: 0,
        navbar: true,
        nav_align: 'left',
        title: 'Files',
        path: '/file/',
        cb: (req, res) => {
            server.checkRefreshFiles();
            res.render('files', server.helpers.getRenderInfo(server.pages, req, {}));
        }
    };
};
