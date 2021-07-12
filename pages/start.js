module.exports.setup = (server) => {
    return {
        permission: -1,
        navbar: false,
        title: 'Start',
        path: '/',
        cb: (req, res) => {
            if (req.session.loggedin === true) {
                if (req.query.r) {
                    for (var i = 0; i < server.pages.length; i++) {
                        if (server.helpers.hasPermission(req.session.permission, server.pages[i].permission)
                            && server.helpers.valPath(req.query.r.split('/'), server.pages[i].path.split('/'))) {
                            res.redirect(req.query.r);
                            res.end();
                            return;
                        }
                    }
                }
                res.redirect('/home');
                res.end();
            } else {
                res.render('login', server.helpers.getRenderInfo(server.pages, req, {}));
            }
        },
        pcb: (req, res) => {
            var username = req.body.username;
            var password = req.body.password;
            if (username && password) {
                server.db.getUser(username, password, (row) => {
                    if (row) {
                        server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + username + '" successfully logged in');
                        req.session.loggedin = true;
                        req.session.username = row.username;
                        req.session.permission = row.permission;
                        res.redirect(req.originalUrl);
                        res.end();
                    } else {
                        server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + username + '" tried to log in with a wrong password');
                        server.helpers.setInfo(req, 'Incorrect login data!');
                        res.redirect('/');
                        res.end();
                    }
                });

            } else {
                server.helpers.setInfo(req, 'Please enter Username and Password!');
                res.redirect('/');
                res.end();
            }
        }
    };
};
