module.exports.setup = (server) => {
    return {
        permission: -1,
        navbar: false,
        title: 'Logout',
        path: '/logout',
        cb: (req, res) => {
            delete req.session.loggedin;
            delete req.session.permission;
            delete req.session.username;
            res.redirect('/');
            res.end();
        }
    };
};
