'use strict'; // eslint-disable-line strict

const Delimiter = require('./delimiter').Delimiter;
const Version = require('../../versioning/utils').Version;
const VSConst = require('../../versioning/constants').VersioningConstants;

const VID_SEP = VSConst.VersionId.Separator;

/**
 * Find the next delimiter in the path
 *
 * @param {string} key             - path of the object
 * @param {string} delimiter       - string to find
 * @param {number} index           - index to start at
 * @return {number} delimiterIndex - returns -1 in case no delimiter is found
 */
function nextDelimiter(key, delimiter, index) {
    return key.indexOf(delimiter, index);
}

/**
 * Handle object listing with parameters
 *
 * @prop {String[]} CommonPrefixes     - 'folders' defined by the delimiter
 * @prop {String[]} Contents           - 'files' to list
 * @prop {Boolean} IsTruncated         - truncated listing flag
 * @prop {String|undefined} NextMarker - marker per amazon format
 * @prop {Number} keys                 - count of listed keys
 * @prop {String|undefined} delimiter  - separator per amazon format
 * @prop {String|undefined} prefix     - prefix per amazon format
 * @prop {Number} maxKeys              - number of keys to list
 */
class DelimiterVersions extends Delimiter {
    constructor(parameters) {
        super(parameters);
        this.masterVersion = undefined;
        this.NextVersionIdMarker = undefined;
    }
    /**
     *  Add a (key, value) tuple to the listing
     *  Set the NextMarker to the current key
     *  Increment the keys counter
     *  @param {String} key   - The key to add
     *  @param {String} versionId - versionId
     *  @param {String} value - The value of the key
     *  @return {Boolean}     - indicates if iteration should continue
     */
    addContents(key, versionId, value) {
        if (this._reachedMaxKeys()) {
            return false;
        }
        this.Contents.push({ key, versionId, value });
        this.NextMarker = key;
        this.NextVersionIdMarker = versionId;
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
        let versionId = undefined;
        const value = obj.value;
        const versionIdIndex = key.indexOf(VID_SEP);
        if (versionIdIndex >= 0) {
            key = obj.key.slice(0, versionIdIndex);
            versionId = obj.key.slice(versionIdIndex + 1);
            if (this.masterVersion) {
                if (this.masterVersion.key !== key) {
                    this._filter(this.masterVersion);
                }
                this.masterVersion = undefined;
            }
        } else if (Version.isPHD(value)) {
            this.masterVersion = undefined;
            return true;
        } else {
            this.masterVersion = obj;
            return true;
        }
        return this._filter({ key, versionId, value });
    }

    _filter(obj) {
        const key = obj.key;
        const value = obj.value;
        const versionId = obj.versionId;
        if (this.prefix && !key.startsWith(this.prefix)) {
            return true;
        }
        if (this.delimiter) {
            const baseIndex = this.prefix ? this.prefix.length : 0;
            const delimiterIndex = nextDelimiter(key,
                                                 this.delimiter,
                                                 baseIndex);
            if (delimiterIndex === -1) {
                return this.addContents(key, versionId, value);
            }
            return this.addCommonPrefix(key, delimiterIndex);
        }
        return this.addContents(key, versionId, value);
    }

    /**
     *  Return an object containing all mandatory fields to use once the
     *  iteration is done, doesn't show a NextMarker field if the output
     *  isn't truncated
     *  @return {Object} - following amazon format
     */
    result() {
        /* NextMarker is only provided when delimiter is used.
         * specified in v1 listing documentation
         * http://docs.aws.amazon.com/AmazonS3/latest/API/RESTBucketGET.html
         */
        return {
            CommonPrefixes: this.CommonPrefixes,
            Versions: this.Contents,
            IsTruncated: this.IsTruncated,
            NextMarker: (this.IsTruncated && this.delimiter) ?
                this.NextMarker : undefined,
            NextVersionIdMarker: this.IsTruncated ?
                this.NextVersionIdMarker : undefined,
            Delimiter: this.delimiter,
        };
    }
}

module.exports = { DelimiterVersions };
