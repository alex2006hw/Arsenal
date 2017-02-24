var rpc = require('rpc-stream');
var Emitter = require('events').EventEmitter;
var duplexer = require('duplexer');
var manifest = require('level-manifest');
var combine = require('stream-combiner');
var inherits = require('util').inherits;
var inspect = require('util').inspect;
var tmpStream = require('tmp-stream');

module.exports = function (MuxDemux) {

function Db (m) {
  if (!(this instanceof Db)) return new Db(m);
  if (!m) m = manifest({ methods: {} });
  Emitter.call(this);

  this.isClient = true;
  this._isOpen = false;
  this.methods = m.methods;

  this.mdm = null;
  this.client = null;
  this.manifest = manifest(m);
  var self = this;

  this._buildAll(m, this, [], null);
  this.on('pipe', deprecated);
}

inherits(Db, Emitter);

function SubLevel(db, name) {
    Object.assign(this, db);
    this._prefix = db._prefix.concat(name);
}

inherits(SubLevel, Db);

Db.prototype.sublevel = function (name) {
    return new SubLevel(this, name);
};

Db.prototype.prefix = function (key) {
  return this._prefix.slice()
};

Db.prototype.createRpcStream = function () {
  var self = this;
  self._isOpen = true;

  var mdm = self.mdm = MuxDemux({ error: true });
  mdm.on('end', function () {
    self._isOpen = false;
    self.emit('close');
  });

  var client = self.client = rpc(null, { raw: true });
  var rpcStream = mdm.createStream('rpc');
  rpcStream.on('error', function () {});
  client.pipe(rpcStream).pipe(client);

  setTimeout(function () {
    self.emit('open');
  });

  return mdm;
};

Db.prototype.close = function (cb) {
  this._isOpen = false;
  if (this.mdm) this.mdm.end();
  if (cb) process.nextTick(cb);
};

Db.prototype.destroy = function () {
  if (this.mdm) this.mdm.close();
};

Db.prototype.auth = function () {
  var args = [].slice.call(arguments);
  var cb = typeof args[args.length - 1] == 'function'
    ? args.pop()
    : function () {};
  this.client.rpc('auth', args, cb);
};

Db.prototype.deauth = function () {
  var args = [].slice.call(arguments);
  var cb = typeof args[args.length - 1] == 'function'
    ? args.pop()
    : function () {};
  this.client.rpc('deauth', args, cb);
};

// EventEmitter special casing, to prevent
// users from listening to db events
// like "put", although they are not supported

var on = Db.prototype.on;
var allowed = [
  'error',
  'pipe',
  'open',
  'close'
];

Db.prototype.addEventListener =
Db.prototype.on = function(ev, fn){
  if (allowed.indexOf(ev) == -1) throw new Error('not supported');
  return on.call(this, ev, fn);
};

Db.prototype.pipe = deprecated;

function deprecated () {
  throw new Error(
    'The API changed. Use db.createRpcStream().'
  );
}


Db.prototype._buildAll = function (_db, db, path, parent) {
  var self = this;
  var m = manifest(_db);

  for (var k in m.methods) {
    var method = m.methods[k];
    var type = method.type;

    if (type == 'error') throw new Error(method.message || 'not supported');

    if (/async|sync/.test(type)) {
      self._asyncSync(db, k);
    } else if (/readable|writable|duplex/.test(type)) {
      self._stream(db, k, type);
    } else if (type == 'object') {
      db[k] = new Emitter;
      self._buildAll(method, db[k], path.concat('.' + k));
    }
  }

  db._prefix = path;
  db._parent = parent;
};

Db.prototype._asyncSync = function (db, k) {
  var self = this;

  db[k] = function () {
    var args = [].slice.call(arguments);
    var cb = typeof args[args.length - 1] == 'function'
      ? args.pop()
      : null;

    if (/is(Open|Closed)/.test(k) && !cb) {
      if (k == 'isOpen') return self._isOpen;
      else return !self._isOpen;
    }

    if (!cb) cb = function (err) {
      if (err) db.emit('error', err)
    };
    const dbInstance = this;
    self._queue(function () {
      args.push(dbInstance.prefix());
      self.client.rpc(k, args, cb);
    });
  };
};

Db.prototype._stream = function (db, k, type) {
  var self = this;

  db[k] = function () {
    var args = [].slice.call(arguments);
    args.unshift(k);

    var tmp = tmpStream();

    const dbInstance = this;
    self._queue(function () {
      args.push(dbInstance.prefix());
      var mdm = self.mdm;
      var ts = (
          type === 'readable'
        ? mdm.createReadStream(args)
        : type == 'writable'
        ? mdm.createWriteStream(args)
        : type == 'duplex'
        ? mdm.createStream(args)
        : (function () { throw new Error('not supported') })()
      );
      ts.autoDestroy = false;
      tmp.replace(ts);
    });

    return tmp;
  };
};

Db.prototype._queue = function (fn) {
  if (this._isOpen) fn();
  else this.once('open', fn);
};

return Db;

};

