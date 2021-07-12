module.exports.Stats = function () {

    var _this = this;
    _this.initialized = false;

    var path = require('path');
    var { spawn } = require('child_process');
    var os = require('os');
    
    var exec_path = 'ifstat';
    if (os.platform() == 'win32') {
        exec_path = path.join(__dirname, 'ifstat');
    }
    
    function lineSplit(line) {
        return line.split(/(\t|  )/g).filter((r) => { return r.match(/\S/); }).map(r => r.trim());
    }
    
    var ifstat = spawn(exec_path, ['-n', '-z']);
    
    ifstat.on('error', (err) => {
        console.log("ifstat not working, please install it correctly");
    });
    
    ifstat.on('close', (code) => {
        // console.log(`child process exited with code ${code}`);
    });
    
    var text = [];
    _this.devices = null;
    _this.device_speeds = null;
    _this.getDevices = () => {
        return _this.devices;
    };
    _this.getDeviceSpeeds = () => {
        return _this.device_speeds;
    };
    ifstat.stdout.on('data', (chunk) => {
        var lines = chunk.toString("utf-8").split(/\r\n|\r|\n/);
        lines.forEach(line => {
            if (line) {
                text.push(line);
                if (_this.devices === null) {
                    _this.devices = lineSplit(line);
                } else if (text.length > 2) {
                    var speeds = lineSplit(line);
                    _this.device_speeds = _this.devices.map((device, index) => {
                        return { id: index, name: device, in: +speeds[index * 2], out: +speeds[index * 2 + 1] };
                    });
                    _this.initialized = true;
                }
            }
        });
    });
};
