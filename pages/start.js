var path = require('path');
var settings = require(path.join(__dirname, '../settings.js'));
const oidc = require('openid-client')
module.exports.setup = (server) => {
    return {
        permission: -1,
        navbar: false,
        title: 'Start',
        path: '/',
        cb: (req, res) => {
            if (settings.OIDC_LOGIN_ENABLED) {
                if (req.query.oidc_login == 'start') {
                    server.helpers.getOidcClient((client) => {
                        const nonce = oidc.generators.nonce();
                        req.session.oidc_nonce = nonce;
                        const start_url = client.authorizationUrl({
                            scope: 'openid email profile',
                            response_mode: 'form_post',
                            nonce
                        });
                        res.redirect(start_url);
                        res.end();
                        return;
                    });
                    return;
                }
            }
            if (req.session.loggedin === true) {
                if (req.query.r) {
                    for (var i = 0; i < server.pages.length; i++) {
                        if (server.helpers.hasPermission(req.session.permission, server.pages[i].permission)
                            && server.helpers.valPath(req.query.r.split('/'), server.pages[i].path.split('/'))) {
                            res.redirect('//' + req.headers.host + '/' + req.query.r.substring(1));
                            res.end();
                            return;
                        }
                    }
                }
                res.redirect('/home');
                res.end();
            } else {
                res.render('login', server.helpers.getRenderInfo(server.pages, req, { 'oidc_enabled': settings.OIDC_LOGIN_ENABLED, 'oidc_name': settings.OIDC_ISSUER_NAME, 'legacy_enabled': settings.LEGACY_LOGIN_ENABLED }));
            }
        },
        pcb: (req, res) => {
            if (settings.OIDC_LOGIN_ENABLED && req.body.code !== undefined) {
                server.helpers.getOidcClient((client) => {
                    const params = client.callbackParams(req);
                    const oidc_nonce = req.session.oidc_nonce;
                    try {
                        (client.callback(settings.OIDC_REDIRECT_URIS, params, { nonce: oidc_nonce })).then((tokenSet) => {
                            const claims = tokenSet.claims();
                            server.db.getUserByColumn(settings.OIDC_DB_USER_ID_COLUMN, claims[settings.OIDC_CLAIM_FOR_IDENTIFICATION], (user) => {
                                if (user === false) {
                                    server.log('IP: "' + server.helpers.getIp(req) + '" sub: "' + claims.sub + '" tried to login (via OIDC) but user not found');
                                    server.helpers.setInfo(req, 'User not found');
                                    res.redirect('/');
                                    res.end();
                                    return;
                                }
                                server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + user.username + '" successfully logged in (via OIDC)');
                                req.session.loggedin = true;
                                req.session.username = user.username;
                                req.session.permission = user.permission;
                                req.session.premium = user.premium;
                                res.redirect(req.originalUrl);
                                res.end();
                                return;
                            });
                        });
                    } catch (e) {
                        server.log('IP: "' + server.helpers.getIp(req) + '" tried to login (via OIDC) but error validating identity: ' + e.message);
                        server.helpers.setInfo(req, 'Error validating identity');
                        res.redirect('/');
                        res.end();
                        return;
                    }
                });
                return;
            }
            if (settings.LEGACY_LOGIN_ENABLED == false) {
                server.helpers.setInfo(req, 'Legacy login disabled!');
                server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + username + '" tried to log in with a wrong password');
                res.redirect('/');
                res.end();
                return
            }
            var username = req.body.username;
            var password = req.body.password;
            if (username && password) {
                server.db.getUser(username, password, (row) => {
                    if (row) {
                        server.log('IP: "' + server.helpers.getIp(req) + '" user: "' + username + '" successfully logged in');
                        req.session.loggedin = true;
                        req.session.username = row.username;
                        req.session.permission = row.permission;
                        req.session.premium = row.premium;
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
