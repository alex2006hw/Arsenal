'use strict'; // eslint-disable-line

const net = require('net');
const assert = require('assert');

const level = require('level');
const multilevel = require('../../../multilevel');
const sublevel = require('level-sublevel');

const ROOT_DB = 'rootDB';

class MetadataFileServer {

    constructor(params) {
        assert.notStrictEqual(params.metadataPath, undefined);
        assert.notStrictEqual(params.metadataPort, undefined);
        assert.notStrictEqual(params.manifestJson, undefined);
        assert.notStrictEqual(params.logger, undefined);
        this.metadataPath = params.metadataPath;
        this.metadataPort = params.metadataPort;
        this.manifestJson = params.manifestJson;
        this.logger = params.logger;
    }

    /**
     * Start the server
     * @return {undefined}
     */
    startServer() {
        const rootDB = level(this.metadataPath + ROOT_DB);
        this.db = sublevel(rootDB);
        this.db.methods = this.db.methods || {};
        this.db.methods.createSub = { type: 'async' };
        this.db.createSub = (subName, cb) => {
            try {
                this.db.sublevel(subName);
                cb(null);
            } catch (err) {
                cb(err);
            }
        };
        multilevel.writeManifest(this.db,
                                 this.metadataPath + this.manifestJson);

        this.logger.info('starting metadata file backend server');
        /* We start a server that will serve the sublevel
           capable rootDB to clients */
        net.createServer(con => {
            con.pipe(multilevel.server(this.db)).pipe(con);
        }).listen(this.metadataPort);
    }

    createSub(subName, cb) {
        this.db.createSub(subName, cb);
    }

    openSub(subName) {
        return this.db.sublevel(subName);
    }
}

module.exports = MetadataFileServer;
