var path = require('path');

module.exports.setup = (server) => {
    return {
        permission: 0,
        navbar: false,
        path: '/player',
        scb: (socket) => {
            function emitUsersToRoom() {
                var roomId = socket.request.session.room_id;
                var usernames = [];
                var room = server.io.of('/player').adapter.rooms.get(roomId);
                if (room) {
                    room.forEach(cid => {
                        var user = server.io.of('/player').sockets.get(cid);
                        usernames.push(user.request.session.username);
                    });
                    server.io.of('/player').to(roomId).emit('users', usernames);
                }
            }

            function prepareMovie(vid, cb) {
                server.db.getMovieFile(vid, (doc) => {
                    if (!doc) {
                        cb(null);
                        return;
                    }
                    if (doc.extension == server.settings.EPISODE_EXTENSION) {
                        server.db.getFiles(doc.relpath, (docs) => {
                            var video_id = "";
                            var sub_id = "";
                            var alternatives = [];

                            docs.forEach((d) => {
                                var docname = path.basename(d.filename, d.extension);

                                if (docname === server.settings.MOVIE_VIDEO_NAME && server.settings.MOVIE_FORMAT_EXTENSIONS.includes(d.extension)) {
                                    video_id = d.relpath.split(path.sep).join('/');
                                } else if (docname === server.settings.MOVIE_SUBTITLE_NAME && d.extension === server.settings.SUBTITLE_EXTENSION) {
                                    sub_id = d.relpath.split(path.sep).join('/');
                                } else if (server.settings.MOVIE_FORMAT_EXTENSIONS.includes(d.extension)) {
                                    alternatives.push({ title: docname, src: { type: 'video', sources: [{ src: '/file/' + d.relpath.split(path.sep).join('/') + '?preview=', type: 'video/mp4' }] } });
                                }
                            });

                            var episodeName = [doc.series, doc.season, doc.episode].filter((v) => v).join(', ');

                            server.db.getMovieSiblings(doc, (siblings) => {
                                cb({
                                    name: episodeName,
                                    relpath: doc.relpath,
                                    parent: doc.parent,
                                    prevEpisode: (
                                        siblings.prev.length > 0
                                            ? server.helpers.removeExtension(siblings.prev.reverse()[0])
                                            : null
                                    ),
                                    nextEpisode: (
                                        siblings.next.length > 0
                                            ? server.helpers.removeExtension(siblings.next[0])
                                            : null
                                    ),
                                    player: {
                                        type: 'video',
                                        sources: [{ src: '/file/' + video_id + '?preview=', type: 'video/mp4' }],
                                        tracks: [{ default: "", kind: "subtitles", label: "English", src: '/file/' + sub_id + '?preview=', srclang: "en" }]
                                    },
                                    alternatives: alternatives
                                });
                            });
                        });
                    } else if (server.settings.MOVIE_FORMAT_EXTENSIONS.includes(doc.extension)) {
                        var episodeName = [
                            doc.series,
                            doc.season,
                            doc.episode,
                            path.basename(doc.filename, doc.extension)
                        ].filter((v) => v).join(', ');

                        server.db.getMovieSiblings(doc, (siblings) => {
                            cb({
                                name: episodeName,
                                relpath: doc.relpath,
                                parent: doc.parent,
                                prevEpisode: (
                                    siblings.prev.length > 0
                                        ? server.helpers.removeExtension(siblings.prev.reverse()[0])
                                        : null
                                ),
                                nextEpisode: (
                                    siblings.next.length > 0
                                        ? server.helpers.removeExtension(siblings.next[0])
                                        : null
                                ),
                                player: { type: 'video', sources: [{ src: '/file/' + vid + '?preview=', type: 'video/mp4' }] },
                            });
                        });
                    } else {
                        cb(null);
                    }
                });
            }

            function getWatchingPercentage(roomId) {
                var room = server.room_manager.getRoom(roomId);

                var rtime = room.time;
                if (room.playing) {
                    rtime = room.time + ((Date.now() - room.time_written) / 1000);
                }
                if (rtime > 10 && room.duration && room.duration > 0) {
                    return Math.min(100, rtime * 100 / room.duration);
                }
                return -1;
            }

            function switchMovie(s, newMovie) {
                server.db.getWatchedPercentage(s.request.session.username, newMovie.relpath, (row) => {
                    if (row) {
                        newMovie.percentage = row.percentage;
                    }
                    s.emit('switch', newMovie);
                });
            }

            function switchRoomMovie(newMovie, newDoc) {
                var roomId = socket.request.session.room_id;

                var room = server.room_manager.getRoom(roomId);

                var socketroom = server.io.of('/player').adapter.rooms.get(roomId);

                if (!room || !socketroom) {
                    return;
                }

                var socketroom = server.io.of('/player').adapter.rooms.get(roomId);


                var percentage = getWatchingPercentage(roomId);
                if (percentage > 0) {
                    socketroom.forEach(cid => {
                        var user = server.io.of('/player').sockets.get(cid);
                        server.db.updateWatchedPercentage(user.request.session.username, room.watching_id, percentage);
                    });
                }

                server.room_manager.switchRoom(roomId, newDoc.relpath, socket.request.session.username);
                server.room_manager.setWatchingName(roomId, newMovie.name);

                socketroom.forEach(cid => {
                    var user = server.io.of('/player').sockets.get(cid);
                    switchMovie(user, newMovie);
                });
            }

            socket.on('ready', (robj) => {
                if (robj.room_id) {
                    var rid = robj.room_id;
                    if (!server.room_manager.roomExists(rid)) {
                        if (rid && robj.movie_id) {
                            server.room_manager.createRoom(rid, decodeURI(robj.movie_id), socket.request.session.username);

                        } else {
                            socket.emit('roomJoined', ['SORRY!', 'There is no room with the ID: ' + rid]);
                            socket.disconnect(true);
                            return;
                        }
                    }

                } else {
                    socket.disconnect(true);
                    return;
                }

                socket.emit('roomJoined', ['You joined a room!', 'You joined the room with the ID: ' + rid]);

                var room = server.room_manager.getRoom(rid);

                socket.emit('public', room.public);

                var vid = room.watching_id;

                prepareMovie(vid, (movie) => {
                    if (movie) {
                        socket.request.session.room_id = rid;
                        switchMovie(socket, movie);
                        server.room_manager.setWatchingName(rid, movie.name);
                        socket.join(rid);
                        server.room_manager.sendWholeChat(socket, rid);
                        emitUsersToRoom();
                        return;
                    }
                    socket.emit('roomJoined', ['SORRY!', 'There is no movie with the ID: ' + vid]);
                    socket.disconnect(true);
                });

            });
            socket.on('chatMsg', (msg) => {
                server.room_manager.pushChat(server.io, socket.request.session.room_id, socket.request.session.username + ': ' + msg);
            });
            socket.on('swepisode', (val) => {
                var rid = socket.request.session.room_id;
                if (!server.room_manager.roomExists(rid)) {
                    return;
                }

                var vid = server.room_manager.getRoom(rid).watching_id;


                server.db.getMovieFile(vid, (doc) => {
                    server.db.getMovieSiblings(doc, (siblings) => {
                        if (siblings.next.length > 0 && val === 1) {
                            var newDoc = siblings.next[0];
                            prepareMovie(newDoc.relpath, (newMovie) => {
                                if (newMovie) {
                                    switchRoomMovie(newMovie, newDoc);
                                }
                            });
                        } else if (siblings.prev.length > 0 && val === -1) {
                            var newDoc = siblings.prev.reverse()[0];
                            prepareMovie(newDoc.relpath, (newMovie) => {
                                if (newMovie) {
                                    switchRoomMovie(newMovie, newDoc);
                                }
                            });
                        }
                    });
                });
            });
            socket.on('update', () => {
                var rid = socket.request.session.room_id;
                if (!server.room_manager.roomExists(rid)) {
                    return;
                }
                var room = server.room_manager.getRoom(rid);
                if (!room) {
                    return;
                }
                if (room.playing) {
                    socket.emit('go', room.time + ((Date.now() - room.time_written) / 1000));
                } else {
                    socket.emit('goto', room.time);
                    socket.emit('pause');
                }
            });
            socket.on('go', (data) => {
                var rid = socket.request.session.room_id;
                if (!server.room_manager.roomExists(rid)) {
                    return;
                }
                if (data.time) {
                    server.io.of('/player').to(rid).emit('go', data.time);
                    server.room_manager.setPlaying(rid, true);
                    server.room_manager.setTime(rid, data.time);
                    server.room_manager.setTimeWritten(rid, Date.now());
                }
                if (data.duration) {
                    server.room_manager.setDuration(rid, data.duration);
                }
            });
            socket.on('goto', (data) => {
                var rid = socket.request.session.room_id;
                if (!server.room_manager.roomExists(rid)) {
                    return;
                }
                if (data.time) {
                    server.io.of('/player').to(rid).emit('goto', data.time);
                    server.room_manager.setTime(rid, data.time);
                    server.room_manager.setTimeWritten(rid, Date.now());
                }
                if (data.duration) {
                    server.room_manager.setDuration(rid, data.duration);
                }
            });
            socket.on('pause', () => {
                var rid = socket.request.session.room_id;
                if (!server.room_manager.roomExists(rid)) {
                    return;
                }
                server.io.of('/player').to(rid).emit('pause');
                server.room_manager.setPlaying(rid, false);
            });
            socket.on('public', (public) => {
                var rid = socket.request.session.room_id;
                server.room_manager.setPublic(rid, public);
                server.io.of('/player').to(rid).emit('public', public);
            });
            socket.on('disconnect', () => {
                emitUsersToRoom();
                var rid = socket.request.session.room_id;
                var room = server.room_manager.getRoom(rid);
                if (!room) {
                    delete socket.request.session.room_id;
                    return;
                }

                var percentage = getWatchingPercentage(rid);
                if (percentage > 0) {
                    server.db.updateWatchedPercentage(socket.request.session.username, room.watching_id, percentage);
                }

                if (server.io.of('/player').adapter.rooms.get(rid) == undefined || server.io.of('/player').adapter.rooms.get(rid).length === 0) {
                    server.room_manager.deleteRoom(rid);
                }
                delete socket.request.session.room_id;
            });
        }
    };
};
