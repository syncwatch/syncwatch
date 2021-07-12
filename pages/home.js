module.exports.setup = (server) => {
    return {
        permission: 0,
        navbar: true,
        title: 'Home',
        path: '/home',
        cb: (req, res) => {
            res.render('home', server.helpers.getRenderInfo(server.pages, req, {}));
        },
        scb: (socket) => {
            function sendRooms() {
                var rooms = [];
                server.rooms_map.forEach((value, roomId) => {
                    var room = server.io.of('/player').adapter.rooms.get(roomId);
                    if (room) {
                        var usernames = [];
                        room.forEach(cid => {
                            var user = server.io.of('/player').sockets.get(cid);
                            if (user.request.session.online) {
                                usernames.push(user.request.session.username);
                            }
                        });
                        rooms.push({ id: roomId, status: value.watching_name, users: usernames });
                    }
                });
                socket.emit("update", rooms);
            }
            socket.on("update", sendRooms);
        }
    };
};
