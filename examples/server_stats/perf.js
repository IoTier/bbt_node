var fs = require('fs');
var os = require('os');
var bbt = require('../../lib/bbt-node');

var bclient = new bbt.Connector(
  {
    keyId: process.env.key,
    secretKey: process.env.skey,
    hostname: 'x.beebotte.com',
    port: 8080
});

var cpus = null;
var avg_cpu = {user: 0, nice: 0, sys: 0, idle: 0, irq: 0};

function getAvgCpu(r1, r2) {
  var avg_cpu = {user: 0, nice: 0, sys: 0, idle: 0, irq: 0};
  var tot_time = 0;
  for(var c in r2) {
    avg_cpu.user += r2[c].times.user;
    avg_cpu.nice += r2[c].times.nice;
    avg_cpu.sys  += r2[c].times.sys;
    avg_cpu.idle += r2[c].times.idle;
    avg_cpu.irq  += r2[c].times.irq;
  }
  for(var c in r1) {
    avg_cpu.user -= r1[c].times.user;
    avg_cpu.nice -= r1[c].times.nice;
    avg_cpu.sys  -= r1[c].times.sys;
    avg_cpu.idle -= r1[c].times.idle;
    avg_cpu.irq  -= r1[c].times.irq;
  }

  tot_time += avg_cpu.user + avg_cpu.nice + avg_cpu.sys + avg_cpu.idle + avg_cpu.irq;

  avg_cpu.user = (avg_cpu.user / tot_time) * 100;
  avg_cpu.nice = (avg_cpu.nice / tot_time) * 100;
  avg_cpu.sys  = (avg_cpu.sys  / tot_time) * 100;
  avg_cpu.idle = (avg_cpu.idle / tot_time) * 100;
  avg_cpu.irq  = (avg_cpu.irq  / tot_time) * 100;

  return avg_cpu;
}

function meminfo(callback, elems) {
  fs.readFile('/proc/meminfo', 'utf8', function (err, minfo) {
    if (err) {
      return callback(err);
    }
    var minfo = minfo.split('\n')
    var data = {};
    minfo.forEach(function (line) {
      var line = line.replace(/\s+/, '');
      line = line.replace(/\skB/, '');
      var record = line.split(/\:/);
      if (record[0] !== '') {
        data[record[0].toLowerCase()] = parseInt(record[1]);
      }
    });
    if(elems) {
      var retval = {};
      for( e in elems) {
        retval[elems[e].toLowerCase()] = data[elems[e].toLowerCase()];
      }
      return callback(null, retval);
    }
    return callback(data);
  });
}

setInterval(function()
  {
    if(!cpus) cpus = os.cpus();
    else {
      var new_cpus = os.cpus();
      var avg_cpu = getAvgCpu(cpus, new_cpus);
      //Send an array of records (Bulk Write), improved performance
      bclient.writeResource({
        device: 'sandbox',
        service: 'performance',
        resource: 'CPU',
        value: avg_cpu 
      }, function(err, res) {
        if(err) console.log(err);
      });

      meminfo(function (err, data) {
        console.log(data);
        if(err) return console.log(err);
        bclient.writeResource({
          device: 'sandbox',
          service: 'performance',
          resource: 'memory',
          value: data
        }, function(err, res) {
          if(err) console.log(err);
        });
      }, ['MemTotal', 'memfree', 'cached', 'dirty']);
      console.log(avg_cpu);
      cpus = new_cpus;
    }
  }, 60 * 1000
);

