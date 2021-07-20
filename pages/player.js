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
                        if (user.request.session.online) {
                            usernames.push(user.request.session.username);
                        }
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

            function switchMovie(newMovie) {
                socket.emit('switch', newMovie);
                server.room_manager.setWatchingName(socket.request.session.room_id, newMovie.name);
            }

            function switchRoomMovie(newMovie, newDoc) {
                var roomId = socket.request.session.room_id;

                server.room_manager.switchRoom(roomId, newDoc.relpath, socket.request.session.username);
                server.room_manager.setWatchingName(roomId, newMovie.name);

                server.io.of('/player').to(roomId).emit('switch', newMovie);
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
                    socket.emit('roomJoined', ['You joined a room!', 'You joined the room with the ID: ' + rid]);

                    var vid = server.room_manager.getRoom(rid).watching_id;

                } else {
                    socket.disconnect(true);
                    return;
                }
                if (!vid) {
                    return;
                }

                prepareMovie(vid, (movie) => {
                    if (movie) {
                        socket.request.session.room_id = rid;
                        switchMovie(movie);
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
                if (room.playing) {
                    socket.emit('go', room.time + ((Date.now() - room.time_written) / 1000));
                } else {
                    socket.emit('pause');
                    socket.emit('goto', room.time);
                }
            });
            socket.on('go', (time) => {
                var rid = socket.request.session.room_id;
                if (!server.room_manager.roomExists(rid)) {
                    return;
                }
                server.io.of('/player').to(rid).emit('go', time);
                server.room_manager.setPlaying(rid, true);
                server.room_manager.setTime(rid, time);
                server.room_manager.setTimeWritten(rid, Date.now());
            });
            socket.on('goto', (time) => {
                var rid = socket.request.session.room_id;
                if (!server.room_manager.roomExists(rid)) {
                    return;
                }
                server.io.of('/player').to(rid).emit('goto', time);
                server.room_manager.setTime(rid, time);
                server.room_manager.setTimeWritten(rid, Date.now());
            });
            socket.on('pause', () => {
                var rid = socket.request.session.room_id;
                if (!server.room_manager.roomExists(rid)) {
                    return;
                }
                server.io.of('/player').to(rid).emit('pause');
                server.room_manager.setPlaying(rid, false);
            });
            socket.on('online', () => {
                socket.request.session.online = true;
                emitUsersToRoom();
            });
            socket.on('offline', () => {
                socket.request.session.online = false;
                emitUsersToRoom();
            });
            socket.on('disconnect', () => {
                emitUsersToRoom();
                var rid = socket.request.session.room_id;
                if (server.io.of('/player').adapter.rooms.get(rid) == undefined || server.io.of('/player').adapter.rooms.get(rid).length === 0) {
                    server.room_manager.deleteRoom(rid);
                }
                delete socket.request.session.room_id;
            });
        }
    };
};
