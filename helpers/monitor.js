module.exports.createMonitor = async (io) => {

    var ifstat = new (require('../node-ifstat/ifstat')).Stats();


    while (ifstat.getDevices() === null) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    var customCharts = [];

    customCharts.push({
        id: 'connectedSockets',
        title: 'Connected Sockets',
        decimalFixed: 0,
        callback: () => {
            return [...io._nsps.values()].reduce((pv, cv) => pv + cv.sockets.size, 0);
        }
    });

    ifstat.getDevices().forEach((device_name, i) => {
        customCharts.push({
            id: device_name + 'UpId',
            title: 'Upload ' + device_name,
            defaultValue: '0.0',
            decimalFixed: 1,
            suffix: 'MB/s',
            callback: () => {
                return ifstat.getDeviceSpeeds()[i].out / 1000;
            }
        });
        customCharts.push({
            id: device_name + 'DownId',
            title: 'Download ' + device_name,
            defaultValue: '0.0',
            decimalFixed: 1,
            suffix: 'MB/s',
            callback: () => {
                return ifstat.getDeviceSpeeds()[i].in / 1000;
            }
        });
    });

    var statusMonitor = require('express-status-monitor')({
        title: 'Status',  // Default title
        path: '',
        websocket: io,
        spans: [{
            interval: 1,            // Every second
            retention: 60           // Keep 60 datapoints in memory
        }, {
            interval: 5,            // Every 5 seconds
            retention: 60
        }, {
            interval: 15,           // Every 15 seconds
            retention: 60
        }],
        customCharts: customCharts,
        chartVisibility: {
            cpu: true,
            mem: true,
            load: true,
            eventLoop: true,
            heap: true,
            responseTime: true,
            rps: true,
            statusCodes: true
        },
        healthChecks: [],
        ignoreStartsWith: null
    });

    return statusMonitor;
}
