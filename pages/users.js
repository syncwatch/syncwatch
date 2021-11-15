module.exports.setup = (server) => {
    return {
        permission: 2,
        navbar: true,
        nav_align: 'left',
        title: 'Users',
        path: '/users',
        cb: (req, res) => {
            server.db.getUsers(req.session.permission, (users) => {
                res.render('users', server.helpers.getRenderInfo(server.pages, req, {
                    users: users.map((d) => {
                        d.permissionName = server.helpers.permissionName(d.permission);
                        return d;
                    }),
                    permissions: server.settings.PERMISSIONS.filter((_, index) => server.helpers.hasPermission(req.session.permission - 1, index)).map((permission, index) => {
                        return { name: permission, _id: index };
                    })
                }));
            });
        },
        pcb: (req, res) => {
            function onFinish() {
                res.redirect('/users');
                res.end();
            }

            if (req.body.create == "") {
                if (!server.helpers.hasPermission(req.session.permission - 1, req.body.permission_id)) {
                    server.helpers.setInfo(req, "You do not have enough permissions!");
                    onFinish();
                    return;
                }
                if (!req.body.username) {
                    server.helpers.setInfo(req, "Please provide a username!");
                    onFinish();
                    return;
                }
                if (!req.body.password) {
                    server.helpers.setInfo(req, "Please provide a password!");
                    onFinish();
                    return;
                }
                server.db.createUser(req.body.username, req.body.password, req.body.permission_id, req.body.premium, (err, _) => {
                    if (err) {
                        server.helpers.setInfo(req, err);
                        onFinish();
                        return;
                    }
                    server.helpers.setInfo(req, 'Successfully added User: "' + req.body.username + '"', 'success');
                    onFinish();
                    return;
                });
            } else if (req.body.changepw == "") {
                if (!req.body.username) {
                    server.helpers.setInfo(req, "Please provide a username!");
                    onFinish();
                    return;
                }
                if (!req.body.password) {
                    server.helpers.setInfo(req, "Please provide a password!");
                    onFinish();
                    return;
                }
                if (req.body.password.length < 4) {
                    server.helpers.setInfo(req, "Password needs to be at least 4 characters long!");
                    onFinish();
                    return;
                }

                server.db.setNewPassword(req.body.username, req.body.password, req.session.permission, (err, _) => {
                    if (err) {
                        server.helpers.setInfo(req, err);
                        onFinish();
                        return;
                    }
                    server.helpers.setInfo(req, 'Password was set successfully!', 'success');
                    onFinish();
                    return;
                });
            } else if (req.body.delete == "") {
                server.db.deleteUser(req.body.username, req.session.permission, (err, _) => {
                    if (err) {
                        server.helpers.setInfo(req, err);
                        onFinish();
                        return;
                    }
                    server.helpers.setInfo(req, 'Successfully removed User: "' + req.body.username + '"', 'success');
                    onFinish();
                    return;
                });
            } else {
                onFinish();
                return;
            }
        }
    }
};
