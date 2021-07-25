var path = require('path');

module.exports.setup = (server) => {
    return {
        permission: 0,
        navbar: true,
        nav_align: 'left',
        title: 'Home',
        path: '/home',
        cb: (req, res) => {
            server.db.getMoviesByAddedTime(5, (movies) => {
                res.render('home', server.helpers.getRenderInfo(server.pages, req,
                    {movies: movies.map((movie) => {
                        movie.name = [
                            movie.series,
                            movie.season,
                            movie.episode,
                            movie.episode ? null : path.basename(movie.filename, movie.extension),
                        ].filter((v) => v).join(', ');
                        return movie;
                    })}
                ));
            });
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
