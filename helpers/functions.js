var path = require('path');
var fs = require('fs');
var settings = require('../settings');

Function.prototype.clone = function () {
    return this.bind({ ...this });
};


module.exports.isFile = (pathItem) => {
    var ext = path.extname(pathItem);
    if (ext === settings.SERIES_EXTENSION || ext === settings.SEASON_EXTENSION || ext === settings.EPISODE_EXTENSION) {
        return false;
    }
    return !!ext;
}


module.exports.getIp = (obj) => {
    if (obj.handshake) {
        return obj.handshake.headers['x-forwarded-for'] || obj.conn.remoteAddress.split(":")[3];
    }
    return obj.headers['x-forwarded-for'] || obj.connection.remoteAddress;
}

module.exports.log = (msg, save, db) => {
    var time = Date.now();
    if (save) {
        db.log(time, msg);
    }
    console.log((new Date(time)).toLocaleString() + ' ' + msg);
}

module.exports.hasPermission = (userPermission, requiredPermission) => {
    return +userPermission >= +requiredPermission;
}

module.exports.permissionName = (permission) => {
    return settings.PERMISSIONS[+permission];
}

module.exports.setInfo = (req, text, style = 'danger') => {
    req.session.info = { text: "" + text, style: style };
}

module.exports.valPath = (query_split, path_split) => {
    if (query_split.length != path_split.length) {
        return false;
    }
    for (var j = 0; j < query_split.length; j++) {
        if (path_split[j].charAt(0) != ':' && path_split[j] != query_split[j]) {
            return false;
        }
    }
    return true;
}

module.exports.getAllowedPages = (pages, userPermission) => {
    return pages.filter((p) => module.exports.hasPermission(userPermission, p.permission));
}

module.exports.getRenderInfo = (pages, req, appendix = {}) => {
    var info_text = undefined;
    var info_style = "danger";
    if (req.session.info) {
        info_text = req.session.info.text;
        info_style = req.session.info.style;
        delete req.session.info;
    }
    return {
        info_text: info_text,
        info_style: info_style,
        ...appendix,
        session: req.session,
        pages: module.exports.getAllowedPages(pages, req.session.permission),
        current_path: req.originalUrl
    };
}

module.exports.secureAccess = (page) => {
    if (page.permission == -1) {
        return;
    }
    ['cb', 'pcb'].forEach((cb) => {
        if (page[cb]) {
            var ocb = page[cb].clone();
            page[cb] = (req, res) => {
                if (req.session.loggedin === true) {
                    if (module.exports.hasPermission(req.session.permission, page.permission)) {
                        ocb(req, res);
                    } else {
                        res.redirect('/');
                        res.end();
                    }
                } else {
                    res.redirect('/?r=' + req.originalUrl);
                    res.end();
                }
            };
        }
    });
    if (page.scb) {
        var oscb = page.scb.clone();
        page.scb = (socket) => {
            if (socket.request.session.loggedin === true
                && module.exports.hasPermission(socket.request.session.permission, page.permission)) {
                oscb(socket);
            }
        }
    }
}

module.exports.serveFile = (filename, filepath, req, res, mime) => {
    function onError(err) {
        console.log(err);
        try {
            res.end();
        } catch {

        }
    }
    try {
        var stat = fs.statSync(filepath);
        var total = stat.size;

        if (req.headers.range) {
            var range = req.headers.range;
            var parts = range.replace(/bytes=/, "").split("-");
            var partialstart = parts[0];
            var partialend = parts[1];

            var start = parseInt(partialstart, 10);
            var end = partialend ? parseInt(partialend, 10) : total - 1;
            var chunksize = (end - start) + 1;

            var file = fs.createReadStream(filepath, { start: start, end: end });
            file.on('error', function (err) {
                onError(err);
            });
            res.writeHead(206, { 'Content-Range': 'bytes ' + start + '-' + end + '/' + total, 'Accept-Ranges': 'bytes', 'Content-Length': chunksize, 'Content-Type': mime, 'Content-Disposition': 'inline' });
            file.on('open', () => {
                file.pipe(res);
            });

        } else {
            res.writeHead(200, { 'Content-Length': total, 'Content-Type': mime, 'Content-Disposition': 'inline; filename="' + filename + '"' });
            var file = fs.createReadStream(filepath);
            file.on('error', function (err) {
                onError(err);
            });
            file.on('open', () => {
                file.pipe(res);
            });
        }
    } catch (err) {
        onError(err);
    }
}

module.exports.createIncPath = (fpath, fname, seperator = '_', starting_i = 1) => {
    var extension = path.extname(fname);
    var basename = path.basename(fname, extension);
    var newpath = path.join(fpath, basename + extension);
    var res = { full_path: newpath, path: fpath, file_name: basename + extension, inc: null, basename: basename, extension: extension };
    var runi = starting_i;
    while (true) {
        try {
            if (fs.existsSync(res.full_path) === false) {
                return res;
            }
            res.basename = basename + seperator + runi;
            res.file_name = res.basename + extension;
            res.full_path = path.join(fpath, res.file_name);
            res.inc = runi;
            runi += 1;
        } catch (err) {
        }
    }
}

module.exports.makeSaveFileName = (name) => {
    return name.replace(/[^\w\d\s\.\-]/g, "");
}
