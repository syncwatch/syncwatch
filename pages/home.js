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
                var rooms = server.room_manager.getRooms(server.io);
                
                socket.emit("update", rooms);
            }
            socket.on("update", sendRooms);
        }
    };
};
