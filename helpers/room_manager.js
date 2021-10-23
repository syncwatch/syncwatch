module.exports.createRoomManager = () => {
    var rooms_map = new Map();

    var room_manager = {};

    room_manager.createRoom = (room_id, movie_id, username) => {
        rooms_map.set(room_id, {
            watching_id: movie_id,
            public: true,
            playing: false,
            time: 0,
            time_written: 0,
            duration: 0,
            chat: []
        });
    };

    room_manager.roomExists = (room_id) => {
        return rooms_map.has(room_id);
    };

    room_manager.switchRoom = (room_id, movie_id, username) => {
        if (!room_manager.roomExists(room_id)) {
            return room_manager.createRoom(room_id, movie_id, username);
        }
        rooms_map.get(room_id).watching_id = movie_id;
        rooms_map.get(room_id).playing = false;
        rooms_map.get(room_id).time = 0;
        rooms_map.get(room_id).time_written = 0;
    };

    room_manager.getRooms = (io) => {
        var rooms = [];
        rooms_map.forEach((value, roomId) => {
            var room = io.of('/player').adapter.rooms.get(roomId);
            if (room && value.public) {
                var usernames = [];
                room.forEach(cid => {
                    var user = io.of('/player').sockets.get(cid);
                    usernames.push(user.request.session.username);
                });
                rooms.push({ id: roomId, status: value.watching_name, users: usernames });
            }
        });
        return rooms;
    };

    room_manager.getRoom = (room_id) => {
        return rooms_map.get(room_id);
    };

    room_manager.getChat = (room_id) => {
        if (!rooms_map.has(room_id)) {
            return ['No Room with ID: ' + room_id];
        }
        return rooms_map.get(room_id).chat;
    };

    room_manager.sendWholeChat = (socket, room_id) => {
        room_manager.getChat(room_id).forEach((msg) => {
            socket.emit('chatMsg', msg);
        });
    };

    room_manager.pushChat = (io, room_id, msg) => {
        var room = rooms_map.get(room_id);
        if (!room) {
            return;
        }
        room.chat.push(msg);
        io.of('/player').to(room_id).emit('chatMsg', msg);
    };

    room_manager.setPublic = (room_id, public) => {
        if (rooms_map.has(room_id)) {
            rooms_map.get(room_id).public = public;
        }
    };

    room_manager.setWatchingName = (room_id, name) => {
        if (rooms_map.has(room_id)) {
            rooms_map.get(room_id).watching_name = name;
        }
    };

    room_manager.setPlaying = (room_id, playing) => {
        if (rooms_map.has(room_id)) {
            rooms_map.get(room_id).playing = playing;
        }
    };

    room_manager.setTime = (room_id, time) => {
        if (rooms_map.has(room_id)) {
            rooms_map.get(room_id).time = time;
        }
    };

    room_manager.setTimeWritten = (room_id, time_written) => {
        if (rooms_map.has(room_id)) {
            rooms_map.get(room_id).time_written = time_written;
        }
    };

    room_manager.setDuration = (room_id, duration) => {
        if (rooms_map.has(room_id)) {
            rooms_map.get(room_id).duration = duration;
        }
    };

    room_manager.deleteRoom = (room_id) => {
        rooms_map.delete(room_id);
    };

    return room_manager;
}
