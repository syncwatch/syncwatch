var path = require('path');
var fs = require('fs');
var Fuse = require('fuse.js');

module.exports.setup = (server) => {
    return {
        permission: 0,
        navbar: false,
        title: 'Api',
        path: '/api',
        cb: (req, res) => {
            function makeCard(doc, link, card) {
                return server.engine.renderFileSync(card, {
                    title: doc.relpath.substring(0, doc.relpath.length - doc.filename.length - 1),
                    link: link,
                    doc: doc
                });
            }

            if (!req.query.req_url) {
                res.status(400).send('Bad Request');
                return;
            }

            var split_req = req.query.req_url.split('/').filter((e) => e != '');
            // for files
            var parent = decodeURI(split_req.length > 1 ? split_req.slice(1).join(path.sep) : '');
            if (split_req[0] == 'file') {
                if (req.query.search && req.query.search.value) {
                    server.db.getFiles(parent, (docs) => {
                        var fuse = new Fuse(docs.map((d) => {
                            d.search = d.relpath.replace(/\\\//g, ' ').replace(/\./g, ' ');
                            return d;
                        }), { keys: ['search'] });
                        var result = fuse.search(req.query.search.value);
                        res.json({
                            data: result.map((d) => {
                                return {
                                    card: makeCard(d.item, 'file', 'table-card')
                                };
                            })
                        });
                    });

                } else {
                    server.db.getFiles(parent, (docs) => {
                        res.json({
                            data: docs.map((doc) => {
                                return {
                                    card: makeCard(doc, 'file', 'table-card')
                                };
                            })
                        });
                    });
                }

                // for movies
            } else if (split_req[0] == 'movies') {

                if (req.query.search && req.query.search.value) {
                    server.db.getMovieFiles(req.session.username, parent, (docs) => {
                        var fuse = new Fuse(docs.map((d) => {
                            d.search = d.relpath.replace(/\\\//g, ' ').replace(/\./g, ' ');
                            return d;
                        }), { keys: ['search'] });
                        var result = fuse.search(req.query.search.value);
                        res.json({
                            data: result.map((d) => {
                                return {
                                    card: makeCard(d.item, 'movies', 'table-movie-card')
                                };
                            })
                        });
                    });

                } else {
                    server.db.getMovieFiles(req.session.username, parent, (docs) => {
                        res.json({
                            data: docs.map((doc) => {
                                return {
                                    card: makeCard(doc, 'movies', 'table-movie-card')
                                };
                            })
                        });
                    });
                }

            } else {
                return;
            }
        },
        pcb: (req, res) => {
            if (!server.helpers.hasPermission(req.session.permission, server.settings.FILE_ACTION_PERMISSIONS)) {
                res.json({ modal: server.engine.renderFileSync('modals/info', { title: 'Permission Denied', body: 'You are ' + req.session.username + ', you have no rights!' }) });
                return;
            }

            if (req.body.action === "check-delete") {
                server.db.getFile(req.body.id, (doc) => {
                    if (!doc) {
                        res.status(400).send('Bad Request');
                        return;
                    }
                    res.json({ modal: server.engine.renderFileSync('modals/delete', { doc: doc }) });
                });
                return;
            }
            if (req.body.action === "delete") {
                server.db.getFile(req.body.id, (doc) => {
                    if (!doc) {
                        res.status(400).send('Bad Request');
                        return;
                    }

                    var errorMsg = null;
                    try {
                        if (doc.directory === 1) {
                            fs.rmdirSync(path.join(server.settings.FILES_PATH, doc.relpath), { recursive: true });
                        } else {
                            fs.unlinkSync(path.join(server.settings.FILES_PATH, doc.relpath));
                        }
                        server.refreshFiles();
                    } catch (err) {
                        errorMsg = err;
                    }

                    if (errorMsg != null) {
                        res.status(400).send('Bad Request');
                        server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + req.session.username + '" while deleting: "' + errorMsg + '"');
                    } else {
                        res.json({ modal: server.engine.renderFileSync('modals/info', { title: 'Successfully Deleted', body: '"' + doc.filename + '" was deleted!' }) });
                        server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + req.session.username + '" deleted: "' + doc.relpath + '"');
                    }
                });
                return;
            }
            if (req.body.action === "check-rename") {
                server.db.getFile(req.body.id, (doc) => {
                    if (!doc) {
                        res.status(400).send('Bad Request');
                        return;
                    }
                    res.json({ modal: server.engine.renderFileSync('modals/rename', { doc: doc }) });
                });
                return;
            }
            if (req.body.action === "rename" && req.body.newname) {
                server.db.getFile(req.body.id, (doc) => {
                    if (!doc) {
                        res.status(400).send('Bad Request');
                        return;
                    }
                    try {
                        var new_name = server.helpers.makeSaveFileName(req.body.newname);
                        var old_path = path.join(server.settings.FILES_PATH, doc.relpath);
                        var new_path = server.helpers.createIncPath(old_path.substring(0, old_path.length - doc.filename.length), new_name);
                        fs.renameSync(old_path, new_path.full_path);
                        
                        res.json({ modal: server.engine.renderFileSync('modals/info', { title: 'Successfully Renamed', body: '"' + doc.filename + '" was renamed to "' + new_path.file_name + '"!' }) });
                        server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + req.session.username + '" renamed: "' + old_path + '" to "' + new_path.full_path + '"');
                    } catch (err) {
                        res.status(400).send('Bad Request');
                        server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + req.session.username + '" while renaming: "' + err + '"');
                    }
                });
                return;
            }
            if (req.body.action === "check-move") {
                server.db.getFile(req.body.id, (doc) => {
                    if (!doc) {
                        res.status(400).send('Bad Request');
                        return;
                    }
                    server.db.getDirectories((docs2) => {
                        res.json({ modal: server.engine.renderFileSync('modals/move', { doc: doc, docs: docs2 }) });

                    });
                });
                return;
            }
            if (req.body.action === "check-move2") {
                server.db.getFile(req.body.id1, (doc) => {
                    if (!doc) {
                        res.status(400).send('Bad Request');
                        return;
                    }
                    server.db.getFile(req.body.id2, (doc2) => {
                        if (!doc2) {
                            res.status(400).send('Bad Request');
                            return;
                        }
                        res.json({ modal: server.engine.renderFileSync('modals/move2', { doc: doc, doc2: doc2 }) });
                    });
                });
                return;
            }
            if (req.body.action === "move") {
                server.db.getFile(req.body.id1, (doc) => {
                    if (!doc) {
                        res.status(400).send('Bad Request');
                        return;
                    }
                    server.db.getFile(req.body.id2, (doc2) => {
                        if (!doc2) {
                            res.status(400).send('Bad Request');
                            return;
                        }
                        try {
                            var newpath = server.helpers.createIncPath(path.join(server.settings.FILES_PATH, doc2.relpath), doc.filename);
                            fs.renameSync(path.join(server.settings.FILES_PATH, doc.relpath), newpath.full_path);
                            res.json({ modal: server.engine.renderFileSync('modals/info', { title: 'Successfully Moved', body: '"' + doc.relpath + '" was moved to "' + doc2.relpath + '"!' }) });
                            server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + req.session.username + '" moved: "' + doc.relpath + '" to "' + newpath.full_path + '"');
                        } catch (err) {
                            res.status(400).send('Bad Request');
                            server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + req.session.username + '" while moving: "' + err + '"');
                        }
                    });
                });
                return;
            }
            if (req.body.action === "check-newfolder") {
                res.json({ modal: server.engine.renderFileSync('modals/newfolder', { id: req.body.id }) });
                return;
            }
            if (req.body.action === "newfolder") {
                var new_name = server.helpers.makeSaveFileName(req.body.newname);
                if (!new_name) {
                    res.status(400).send('Bad Request');
                    return;
                }
                server.db.getFile(req.body.id, (doc) => {
                    if (!doc) {
                        res.status(400).send('Bad Request');
                        return;
                    }

                    function createNewDir(dirpath) {
                        var newpath = server.helpers.createIncPath(dirpath, new_name);
                        try {
                            fs.mkdirSync(newpath.full_path);
                            res.json({ modal: server.engine.renderFileSync('modals/info', { title: 'Successfully Created Folder', body: '"' + newpath.file_name + '" was successfully created!' }) });
                            server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + req.session.username + '" created folder: "' + newpath.full_path + '"');
                        } catch (err) {
                            res.status(400).send('Bad Request');
                            server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + req.session.username + '" while creating folder: "' + err + '"');
                        }
                    }

                    if (doc.parent) {
                        createNewDir(path.join(server.settings.FILES_PATH, doc.parent));
                    } else {
                        createNewDir(server.settings.FILES_PATH);
                    }
                });
                return;
            }
            res.status(400).send('Bad Request');
        }
    };
};
