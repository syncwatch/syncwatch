var formidable = require('formidable');
var youtubedl = require('youtube-dl-exec');
var fs = require('fs');

module.exports.setup = (server) => {
    return {
        permission: server.settings.UPLOAD_PERMISSIONS,
        navbar: true,
        nav_align: 'left',
        title: 'Upload',
        path: '/upload',
        cb: (req, res) => {
            res.render('upload', server.helpers.getRenderInfo(server.pages, req, {}));
        },
        pcb: (req, res) => {

            var info = null;

            function onFinish() {
                server.helpers.log('IP: "' + server.helpers.getIp(req)
                    + '" user: "' + req.session.username + '" uploaded, info: "' + info + '"');
                if (req.query.ajax == "") {
                    res.send(info);
                    res.end();
                    return;
                }
                server.helpers.setInfo(req, info);
                res.redirect('/upload');
                res.end();
            };

            var form = new formidable.IncomingForm();
            form.maxFileSize = server.settings.MAX_FILE_SIZE * 1024 * 1024;

            form.parse(req, (err, fields, files) => {
                if (err) {
                    info = "" + err;
                    onFinish();
                    return;
                }
                if (fields.filepicker_upload != "") {
                    onFinish();
                    return;
                }

                var oldpath = files.file.path;

                var newpath = server.helpers.createIncPath(server.settings.FILES_PATH,
                    server.helpers.makeSaveFileName(files.file.name));

                try {
                    fs.copyFileSync(oldpath, newpath.full_path);
                    fs.unlinkSync(oldpath);
                    server.refreshFiles();
                    info = 'Successfully uploaded "' + newpath.file_name + '" to "' + newpath.path + '"';
                    onFinish();
                } catch (err) {
                    info = 'Upload failed: ' + err;
                    onFinish();
                }
            });
        },
        scb: (socket) => {
            socket.on("upload", data => {
                function einfo(info) {
                    socket.emit('info', info);
                }

                function eprogress(percent) {
                    socket.emit('progress', percent);
                }

                if (data.upload_link === "" && data.file_link) {
                    einfo("trying to find video...");

                    eprogress(5);

                    // TODO Donwload Subtitle

                    youtubedl(data.file_link, {
                        getFilename: true,
                        noOverwrites: true,
                        noWarnings: true,
                        noCallHome: true,
                        noCheckCertificate: true,
                        preferFreeFormats: true,
                        youtubeSkipDashManifest: true,
                        restrictFilenames: true,
                        format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=webm]+bestaudio[ext=webm]/best',
                        output: '%(title)s.%(ext)s'
                    }).then(fname => {
                        einfo('found video: "' + fname + '"... starting download...');

                        eprogress(10);
                        var newpath = server.helpers.createIncPath(server.settings.FILES_PATH,
                            server.helpers.makeSaveFileName(fname));

                        var dl_process = youtubedl.raw(data.file_link, {
                            noOverwrites: true,
                            noWarnings: true,
                            noCallHome: true,
                            noCheckCertificate: true,
                            preferFreeFormats: true,
                            youtubeSkipDashManifest: true,
                            restrictFilenames: true,
                            format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=webm]+bestaudio[ext=webm]/best',
                            output: newpath.full_path
                        });

                        dl_process.stdout.on('data', (chunk) => {
                            var lines = chunk.toString("utf-8").split(/\r\n|\r|\n/);
                            lines.forEach(line => {
                                if (line) {
                                    // parse youtube-dl string !! VOLATILE
                                    if (line.substr(0, 10) == '[download]' && line.substr(11, 6).includes('%')) {
                                        try {
                                            var percent = +line.substr(11, 6).split('%')[0];
                                            einfo(line.substr(11));
                                            eprogress(10 + ((percent - 1) * 0.9));
                                        } catch {
                                        }
                                    }
                                }
                            });
                        });

                        dl_process.stdout.on('end', () => {
                            einfo('Successfully uploaded "' + newpath.file_name + '" to "' + newpath.path + '"');
                            eprogress(100);
                            server.refreshFiles();

                            server.log('IP: "' + server.helpers.getIp(socket) + '" user: "' + socket.request.session.username + '" downloaded link: "' + data.file_link + '"');
                        });

                        setTimeout(dl_process.cancel, Math.round(1000 * 60 * 60 * server.settings.CANCEL_DOWNLOAD_HOURS));
                    }).catch(err => {
                        server.log('IP: "' + server.helpers.getIp(socket) + '" user: "' + socket.request.session.username + '" while downloading: "' + err + '"');
                        einfo("Error: cannot find video");
                    });
                }
            });
        },
    };
};
