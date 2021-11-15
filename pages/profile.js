module.exports.setup = (server) => {
    return {
        permission: 0,
        navbar: true,
        nav_align: 'right',
        title: 'Profile',
        path: '/profile',
        cb: (req, res) => {
            res.render('profile', server.helpers.getRenderInfo(server.pages, req, { username: req.session.username }));
        },
        pcb: (req, res) => {
            function onFinish() {
                res.redirect('/profile');
                res.end();
            }

            if (req.body.changePassword == '') {
                server.db.getUser(req.session.username, req.body.oldPassword, (row) => {
                    if (!row) {
                        server.helpers.setInfo(req, "Password is incorrect!");
                        onFinish();
                        return;
                    }
                    if (req.body.newPassword !== req.body.newPassword2) {
                        server.helpers.setInfo(req, "New Passwords do not match!");
                        onFinish();
                        return;
                    }
                    if (!server.helpers.passwordCompliance(req.body.newPassword)) {
                        server.helpers.setInfo(req, "New Password does not comply to our rules!");
                        onFinish();
                        return;
                    }
                    server.db.changeUserPassword(req.session.username, req.body.oldPassword, req.body.newPassword, (x, y) => {
                        server.helpers.setInfo(req, "Password changed successfully!", 'success');
                        onFinish();
                    });
                });
                return;
            }
            if (req.body.changePremium == '') {
                if (req.session.premium) {
                    server.helpers.setInfo(req, "Your Premium Plan was cancelled successfully!", 'success');
                    server.db.setUserPremium(req.session.username, 0);
                    req.session.premium = 0;
                } else {
                    server.helpers.setInfo(req, "You bougth yourself Premium, congratulations!", 'success');
                    server.db.setUserPremium(req.session.username, 1);
                    req.session.premium = 1;
                }
                onFinish();
                return;
            }
            onFinish();
        }
    };
};
