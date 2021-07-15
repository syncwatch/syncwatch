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
                var roomId = socket.request.session.room_id;
                if (server.rooms_map.has(roomId)) {
                    server.rooms_map.get(roomId).watching_name = newMovie.name;
                }
            }

            function switchRoomMovie(newMovie, newDoc) {
                var roomId = socket.request.session.room_id;
                server.rooms_map.set(roomId, {
                    watching_id: newDoc.relpath,
                    watching_name: newMovie.name,
                    playing: false,
                    time: 0,
                    time_written: 0
                });
                server.io.of('/player').to(roomId).emit('switch', newMovie);
            }

            socket.on('ready', (robj) => {
                if (robj.room_id) {
                    var rid = robj.room_id;
                    if (!server.rooms_map.has(rid)) {
                        if (rid && robj.movie_id) {
                            server.rooms_map.set(rid, { watching_id: decodeURI(robj.movie_id), playing: false, time: 0, time_written: 0 });
                        } else {
                            socket.emit('roomJoined', ['SORRY!', 'There is no room with the ID: ' + rid]);
                            socket.disconnect(true);
                            return;
                        }
                    }
                    socket.emit('roomJoined', ['You joined a room!', 'You joined the room with the ID: ' + rid]);

                    var vid = server.rooms_map.get(rid).watching_id;

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
                        emitUsersToRoom();
                        return;
                    }
                    socket.emit('roomJoined', ['SORRY!', 'There is no movie with the ID: ' + vid]);
                    socket.disconnect(true);
                });

            });
            socket.on('swepisode', (val) => {
                var rid = socket.request.session.room_id;
                var vid = server.rooms_map.get(rid).watching_id;


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
                if (!server.rooms_map.has(socket.request.session.room_id)) {
                    return;
                }
                if (server.rooms_map.get(socket.request.session.room_id).playing) {
                    socket.emit('go', server.rooms_map.get(socket.request.session.room_id).time + ((Date.now() - server.rooms_map.get(socket.request.session.room_id).time_written) / 1000));
                } else {
                    socket.emit('pause');
                    socket.emit('goto', server.rooms_map.get(socket.request.session.room_id).time);
                }
            });
            socket.on('go', (time) => {
                if (!server.rooms_map.has(socket.request.session.room_id)) {
                    return;
                }
                server.io.of('/player').to(socket.request.session.room_id).emit('go', time);
                server.rooms_map.get(socket.request.session.room_id).playing = true;
                server.rooms_map.get(socket.request.session.room_id).time = time;
                server.rooms_map.get(socket.request.session.room_id).time_written = Date.now();
            });
            socket.on('goto', (time) => {
                if (!server.rooms_map.has(socket.request.session.room_id)) {
                    return;
                }
                server.io.of('/player').to(socket.request.session.room_id).emit('goto', time);
                server.rooms_map.get(socket.request.session.room_id).time = time;
                server.rooms_map.get(socket.request.session.room_id).time_written = Date.now();
            });
            socket.on('pause', () => {
                if (!server.rooms_map.has(socket.request.session.room_id)) {
                    return;
                }
                server.io.of('/player').to(socket.request.session.room_id).emit('pause');
                server.rooms_map.get(socket.request.session.room_id).playing = false;
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
                if (server.io.of('/player').adapter.rooms.get(socket.request.session.room_id) == undefined || server.io.of('/player').adapter.rooms.get(socket.request.session.room_id).length === 0) {
                    server.rooms_map.delete(socket.request.session.room_id);
                }
                delete socket.request.session.room_id;
            });
        }
    };
};
