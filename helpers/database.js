module.exports.createDatabase = async (settings) => {
    var sqlite3 = require('sqlite3');
    var crypto = require('crypto');
    var path = require('path');
    var db = new sqlite3.Database(path.join(__dirname, '../server.db'));

    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
            username TEXT NOT NULL PRIMARY KEY,
            password TEXT NOT NULL,
            permission INTEGER NOT NULL,
            premium INTEGER NOT NULL
            );
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS log (
            time INTEGER NOT NULL,
            msg TEXT NOT NULL
            );
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS files (
            relpath TEXT NOT NULL PRIMARY KEY,
            parent TEXT NOT NULL,
            series TEXT,
            season TEXT,
            episode TEXT,
            filename TEXT NOT NULL,
            directory INTEGER NOT NULL,
            extension TEXT NOT NULL,
            addedtime INTEGER NOT NULL
            );
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS watched (
            username TEXT NOT NULL,
            relpath2 TEXT NOT NULL,
            percentage INTEGER NOT NULL,
            time INTEGER NOT NULL,
            PRIMARY KEY (username, relpath2)
            );
        `);
    });

    var functions = {};

    functions.log = (time, msg) => {
        db.run(`INSERT INTO log(time, msg) VALUES(?, ?);`, [time, msg]);
    }

    functions.getLog = (cb) => {
        db.all(`SELECT * FROM log ORDER BY time DESC`, [], (err, rows) => {
            cb(rows);
        });
    }

    functions.getUser = (username, password, cb) => {
        db.get(`SELECT username, password, permission, premium FROM users WHERE username = ?`, [username], (err, row) => {
            if (!row) {
                cb(false);
                return;
            }

            var [salt, hash] = row.password.split(":");

            var newHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
            if (newHash === hash) {
                cb(row);
                return;
            }
            cb(false);
        });
    }

    functions.getUserByColumn = (column_name, column_value, cb) => {
        db.get(`SELECT username, password, permission, premium FROM users WHERE ${column_name} = ?`, [column_value], (err, row) => {
            if (!row) {
                cb(false);
                return;
            }
            cb(row);
        });
    }

    functions.getUsers = (permission, cb) => {
        db.all(`SELECT username, permission, premium FROM users WHERE permission < ?`, [permission], (err, rows) => {
            cb(rows);
        });
    }

    functions.createUser = (username, password, permission, premium, cb) => {
        var salt = crypto.randomBytes(16).toString('hex');
        var hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

        db.run(`INSERT INTO users(username, password, permission, premium) VALUES(?, ?, ?, ?);`, [username, salt + ':' + hash, permission, (premium ? true : false)], [], cb);
    }

    functions.deleteUser = (username, permission, cb) => {
        db.run(`DELETE FROM users WHERE username = ? AND permission < ?`, [username, permission], cb);
    }

    functions.setNewPassword = (username, password, permission, cb) => {
        var salt = crypto.randomBytes(16).toString('hex');
        var hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

        db.run(`UPDATE users SET password = ? WHERE username = ? AND permission < ?;`, [salt + ':' + hash, username, permission], cb);
    }

    functions.changeUserPassword = (username, oldpassword, newpassword, cb) => {
        functions.getUser(username, oldpassword, (row) => {
            if (row) {

                var salt = crypto.randomBytes(16).toString('hex');
                var hash = crypto.pbkdf2Sync(newpassword, salt, 1000, 64, 'sha512').toString('hex');

                db.run(`UPDATE users SET password = ? WHERE username = ?;`, [salt + ':' + hash, username], cb);
            } else {
                cb(false);
            }
        });
    }

    functions.setUserPremium = (username, premium, cb) => {
        db.run(`UPDATE users SET premium = ? WHERE username = ?;`, [premium, username], cb);
    }

    functions.updateWatchedPercentage = (username, relpath, percentage) => {
        db.run(`INSERT OR REPLACE INTO watched(username, relpath2, percentage, time) VALUES(?, ?, ?, ?);`, [username, relpath, percentage, Date.now()]);
    }

    functions.getWatchedPercentage = (username, relpath, cb) => {
        db.get(`SELECT * FROM watched WHERE username = ? AND relpath2 = ?`, [username, relpath], (err, row) => {
            cb(row);
        });
    }

    functions.getLatestWatchedPercentage = (username, cb) => {
        db.get(`SELECT * FROM watched WHERE username = ? ORDER BY time DESC LIMIT 1`, [username], (err, row) => {
            cb(row);
        });
    }

    functions.getWatchedPercentages = (username, cb) => {
        db.all(`SELECT * FROM watched WHERE username = ? ORDER BY time DESC, relpath2 ASC`, [username], (err, rows) => {
            cb(rows);
        });
    }

    functions.getFiles = (parent, cb) => {
        db.all(`SELECT * FROM files WHERE parent = ? ORDER BY relpath ASC`, [parent], (err, rows) => {
            cb(rows);
        });
    }

    functions.getFile = (relpath, cb) => {
        db.get(`SELECT * FROM files WHERE relpath = ?`, [relpath], (err, row) => {
            cb(row);
        });
    }

    functions.getDirectories = (cb) => {
        db.all(`SELECT * FROM files WHERE directory = 1`, [], (err, rows) => {
            cb(rows);
        });
    }

    functions.getMovieFiles = (username, parent, cb) => {
        var extor = settings.MOVIE_EXTENSIONS.map(() => 'extension = ?').join(' OR ');
        db.all(`SELECT * FROM files LEFT JOIN watched ON files.relpath = watched.relpath2 AND username = ? WHERE parent = ? AND (` + extor + `) ORDER BY relpath ASC`,
            [username, parent, ...settings.MOVIE_EXTENSIONS], (err, rows) => {
                cb(rows);
            });
    }

    functions.getMovieFile = (relpath, cb) => {
        var extor = settings.MOVIE_EXTENSIONS.map(() => 'extension = ?').join(' OR ');
        db.get(`SELECT * FROM files WHERE relpath = ? AND (` + extor + `)`,
            [relpath, ...settings.MOVIE_EXTENSIONS], (err, row) => {
                cb(row);
            });
    }

    functions.getMovieSiblings = (moviefile, cb) => {
        var exts = [settings.EPISODE_EXTENSION].concat(settings.MOVIE_FORMAT_EXTENSIONS);
        var extor = exts.map(() => 'extension = ?').join(' OR ');
        db.all(`SELECT * FROM files WHERE parent = ? AND (` + extor + `) ORDER BY relpath ASC`,
            [moviefile.parent, ...exts], (err, siblings) => {
                var prevs = [];
                var nexts = [];
                var reached = false;
                siblings.forEach((sibling) => {
                    if (moviefile.relpath === sibling.relpath) {
                        reached = true;
                    } else if (reached) {
                        nexts.push(sibling);
                    } else {
                        prevs.push(sibling);
                    }
                });
                cb({ prev: prevs, next: nexts });
            });
    }

    functions.getMoviesByAddedTime = (amount, cb) => {
        var exts = settings.MOVIE_FORMAT_EXTENSIONS;
        var extor = exts.map(() => 'extension = ?').join(' OR ');
        if (amount > 0) {
            db.all(`SELECT * FROM files WHERE ((` + extor + `) AND episode IS NULL) OR extension = ? ORDER BY addedtime DESC, relpath ASC LIMIT ?`,
                [...exts, settings.EPISODE_EXTENSION, amount], (err, rows) => {
                    cb(rows);
                });
        } else {
            db.all(`SELECT * FROM files WHERE ((` + extor + `) AND episode IS NULL) OR extension = ? ORDER BY addedtime DESC, relpath ASC`,
                [...exts, settings.EPISODE_EXTENSION], (err, rows) => {
                    cb(rows);
                });
        }

    }

    functions.updateFiles = (files) => {
        var relpaths = files.map((file) => file.relpath);

        db.serialize(() => {

            var foundfiles = [];


            db.all(`SELECT relpath FROM files`, [], (err, rows) => {
                rows.map((row) => row.relpath).forEach((relpath) => {
                    if (!relpaths.includes(relpath)) {
                        db.run(`DELETE FROM files WHERE relpath = ?`, [relpath]);
                    } else {
                        foundfiles.push(relpath);
                    }
                });

                var sql = `INSERT OR REPLACE INTO files(relpath, parent, series, season, episode, filename, directory, extension, addedtime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                var stmt = db.prepare(sql);
                var curtime = Date.now();
                for (var i = 0; i < files.length; i++) {
                    var f = files[i];
                    if (!foundfiles.includes(f.relpath)) {
                        stmt.run([
                            f.relpath,
                            f.parent,
                            f.series,
                            f.season,
                            f.episode,
                            f.filename,
                            f.directory,
                            f.extension,
                            curtime,
                        ]);
                    }
                }
                stmt.finalize();

            });
        });
    }

    return functions;
}
