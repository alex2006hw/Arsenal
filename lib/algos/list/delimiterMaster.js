'use strict'; // eslint-disable-line strict

const Delimiter = require('./delimiter').Delimiter;
const Version = require('../../versioning/utils').Version;
const VSConst = require('../../versioning/constants').VersioningConstants;

const VID_SEP = VSConst.VersionId.Separator;

/**
 * Handle object listing with parameters. This extends the base class Delimiter
 * to return the raw master versions of existing objects.
 */
class DelimiterMaster extends Delimiter {
    constructor(parameters) {
        super(parameters);
        this.PHD = undefined;
    }

    /**
     *  Add a (key, value) tuple to the listing
     *  Set the NextMarker to the current key
     *  Increment the keys counter
     *  @param {String} key   - The key to add
     *  @param {String} value - The value of the key
     *  @return {Boolean}     - indicates if iteration should continue
     */
    addContents(key, value) {
        if (this._reachedMaxKeys()) {
            return false;
        }
        // <versioning>
        this.Contents.push({ key, value });
        // </versioning>
        this.NextMarker = key + VID_SEP;
        ++this.keys;
        return true;
    }

    /**
     *  Filter to apply on each iteration, based on:
     *  - prefix
     *  - delimiter
     *  - maxKeys
     *  The marker is being handled directly by levelDB
     *  @param {Object} obj       - The key and value of the element
     *  @param {String} obj.key   - The key of the element
     *  @param {String} obj.value - The value of the element
     *  @return {Boolean}         - indicates if iteration should continue
     */
    filter(obj) {
        let key = obj.key;
        const value = obj.value;
        const versionIdIndex = key.indexOf(VID_SEP);
        if (versionIdIndex >= 0) {
            // a non-master version: ignore if its master is not a PHD version
            key = key.slice(0, versionIdIndex);
            if (key !== this.PHD) {
                return true;
            }
        } else if (Version.isPHD(value)) {
            // master version is a PHD version: wait for the next version
            this.PHD = key;
            return true;
        }
        // non-PHD master version or a version whose master is a PHD version
        this.PHD = undefined;
        if (this.delimiter) {
            // check if the key has the delimiter
            const baseIndex = this.prefix ? this.prefix.length : 0;
            const delimiterIndex = key.indexOf(this.delimiter, baseIndex);
            if (delimiterIndex >= 0) {
                // try to add the prefix to the list
                return this.addCommonPrefix(key, delimiterIndex);
            }
        }
        return this.addContents(key, value);
    }
}

module.exports = { DelimiterMaster };
