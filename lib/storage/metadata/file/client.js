'use strict'; // eslint-disable-line

const net = require('net');
const assert = require('assert');

const multilevel = require('../../../multilevel');

class MetadataFileClient {

    constructor(params) {
        assert.notStrictEqual(params.metadataPath, undefined);
        assert.notStrictEqual(params.metadataPort, undefined);
        assert.notStrictEqual(params.manifestJson, undefined);
        assert.notStrictEqual(params.logger, undefined);
        this.metadataPath = params.metadataPath;
        this.metadataPort = params.metadataPort;
        this.manifestJson = params.manifestJson;
        this.logger = params.logger;
        this.connectDb();
    }

    /**
     * Setup the leveldb server
     * @return {undefined}
     */
    connectDb() {
        if (this.client !== undefined) {
            this.client.close();
        }
        const manifest = require(this.metadataPath + this.manifestJson);
        this.client = multilevel.client(manifest);
        const con = net.connect(this.metadataPort);
        con.pipe(this.client.createRpcStream()).pipe(con);
    }

    createSub(subName, log, cb) {
        this.client.createSub(subName, err => {
            if (err) {
                log.error(`error creating new sublevel ${subName}`,
                          { error: err });
                return cb(err);
            }
            try {
                const subDb = this.client.sublevel(subName);
                return cb(null, subDb);
            } catch (err) {
                return cb(err);
            }
        });
    }

    openSub(subName) {
        return this.client.sublevel(subName);
    }
}

module.exports = MetadataFileClient;
