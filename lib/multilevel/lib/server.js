'use strict'; // eslint-disable-line

var rpc = require('rpc-stream');
var manifest = require('level-manifest');
var util = require('util');

module.exports = function (MuxDemux) {

return function (db, opts) {
  if (typeof db == 'string') throw new Error('database instance required');

  if('function' === typeof db.sublevel) {
    if(!(db.version >= '6'))
      throw new Error('expected a level-sublevel@6 or greater')
  }

  var mdm = MuxDemux({ error: true });

  opts = opts || {};

  var deauth = opts.deauth || function () {};
  var auth = opts.auth || function () {
    var cb = [].pop.call(arguments);
    cb(null, true);
  };
  var access = opts.access || function () { return true };

  var server = rpc(null, { raw: true, flattenError: flatten });
  var handlers = {};

  (function buildAll (db) {
    var m = manifest(db);
    for (var k in m.methods) (function (k) {
      var name = k;
      var method = m.methods[k];

      if (method.type == 'async') {
        server.createLocalCall(name, function (args, cb) {
          const prefix = args.pop();
          access(server.sessionData, db, k, args);
          args.push(cb);
          const subDb = lookupSubDb(db, prefix);
          subDb[k].apply(subDb, args);
        });
      } else if (method.type == 'sync') {
        server.createLocalCall(name, function (args, cb) {
          const prefix = args.pop();
          access(server.sessionData, db, k, args);
          var r;
          try {
              const subDb = lookupSubDb(db, prefix);
              r = subDb[k].apply(subDb, args);
          }
          catch (err) { return cb(err) }
          cb(null, r);
        });
      } else if (method.type == 'object') {
        db[k].methods = method.methods;
        buildAll(db[k], path.concat('.' + k));
      } else {
        handlers[name] = function (args) {
          const prefix = args.pop();
          access(server.sessionData, db, k, args);
          const subDb = lookupSubDb(db, prefix);
          return subDb[k].apply(subDb, args);
        };
      }
    })(k);
  })(db);

    function lookupSubDb(db, prefix) {
        let subDb = db;
        prefix.forEach(sub => {
            if (!subDb.sublevels || !subDb.sublevels[sub]) {
                throw Error('no such sublevel: ' + sub);
            }
            subDb = subDb.sublevels[sub];
        });
        return subDb;
    }

  server.createLocalCall('auth', function (args, cb) {
    auth.apply(null, args.concat(function authCb (err, data) {
      if (err) return cb(err);
      server.sessionData = data;
      cb(null, data);
    }));
  });

  server.createLocalCall('deauth', function (args, cb) {
    server.sessionData = null;
    if (opts.deauth) opts.deauth.apply(null, args);
    else cb();
  });

  mdm.on('connection', function (con) {
    con.on('error', function () {});

    if (con.meta == 'rpc') return con.pipe(server).pipe(con);

    try {
      var stream = handlers[con.meta[0]](con.meta.slice(1));
      // prevent iterators from staying open when connection fails
      con.once('error', function () {
        var method = stream[stream.readable ? 'destroy' : 'end']
        if(method) method.call(stream)
      });
      if (stream.readable) stream.pipe(con);
      if (stream.writable) con.pipe(stream);
      stream.on('error', function (err) {
        con.error(flatten(err));
      });
    } catch (err) {
      con.error(flatten(err));
    }
  });

  return mdm;
};

};

function flatten(err){
  if(!(err instanceof Error)) return err;
  var err2 = {
    message: err.message,
    stack: err.stack,
    type: err.type,
    notFound: err.notFound,
    status: err.status
  };
  for (var k in err) err2[k] = err[k];
  return err2;
}
