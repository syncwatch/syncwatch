async function main() {
    var path = require('path');
    var sqlite3 = require('sqlite3');
    var crypto = require('crypto');
    var db = new sqlite3.Database(path.join(__dirname, '../server.db'));

    db.all(`SELECT username, password FROM users`, [], (err, rows) => {
        rows.forEach(row => {
            var salt = crypto.randomBytes(16).toString('hex');
            var hash = crypto.pbkdf2Sync(row.password, salt, 1000, 64, 'sha512').toString('hex');
    
            db.run(`UPDATE users SET password = ? WHERE username = ?;`, [salt + ':' + hash, row.username]);
        });
    });
}
main();
