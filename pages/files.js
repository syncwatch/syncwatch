var path = require('path');

module.exports.setup = (server) => {
    return {
        permission: 1,
        navbar: false,
        title: 'Files',
        path: '/file/:path(*)',
        cb: (req, res) => {
            var split_req = req.params.path.split('/');
            var relpath = split_req.join(path.sep);

            server.db.getFile(relpath, (file) => {

                // if file not found
                if (!file) {
                    res.redirect('/file');
                    res.end();
                    return;
                }

                // send file inline
                if (req.query.preview === '') {
                    server.helpers.serveFile(file.filename, path.join(server.settings.FILES_PATH, file.relpath), req, res, '');
                    return;
                }
                // send download file
                if (req.query.download === '') {
                    res.download(path.join(server.settings.FILES_PATH, file.relpath), file.filename);
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
                    res.render('files', server.helpers.getRenderInfo(server.pages, req, { history }));
                    return;
                }

                // show file preview
                res.render('file-preview', server.helpers.getRenderInfo(server.pages, req,
                    {
                        file: file,
                        show_preview: server.settings.PREVIEW_EXTENSIONS.includes(file.extension)
                    })
                );
            });
        }
    };
};
