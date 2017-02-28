'use strict'; // eslint-disable-line strict

const PHD_VERSION_LENGTH = 48;

/**
 * Class for manipulating an object version.
 * The format of a version: { isNull, isDeleteMarker, versionId, otherInfo }
 */
class Version {
    /**
     * Create a new version instantiation from its data object.
     * @param {object} version - the data object to instantiate
     * @param {boolean} version.isNull - is a null version
     * @param {boolean} version.isDeleteMarker - is a delete marker
     * @param {string} version.versionId - the version id
     * @constructor
     */
    constructor(version) {
        this.version = version || {};
    }

    /**
     * Parse the version information from a string.
     *
     * @param {string} value - the string to parse
     * @return {Version} - the version deserialized from the input string
     */
    static from(value) {
        return new Version(value ? JSON.parse(value) : undefined);
    }

    /**
     * [MetaData Internal] Check if a version is a place holder for deletion.
     *
     * @param {string} value - version to check
     * @return {boolean} - whether this is a PHD version
     */
    static isPHD(value) {
        // check the length of the value before parsing
        // all PHD versions should have the same length
        if (value.length !== PHD_VERSION_LENGTH) {
            return false;
        }
        // parse the value if it has the length of a PHD version
        try {
            return Version.from(value).isPHDVersion();
        } catch (exception) { // eslint-disable-line strict
            return false; // nice, Vault
        }
    }

    /**
     * [MetaData Internal] Check if a version is a place holder for deletion.
     *
     * @return {boolean} - whether this is a PHD version
     */
    isPHDVersion() {
        return this.version.isPHD || false;
    }

    /**
     * Generic setter to modify an arbitrary field of the version.
     *
     * @param {string} attr - name of the attribute
     * @param {any} value - value of the attribute
     * @return {Version} - the updated version
     */
    setattr(attr, value) {
        this.version[attr] = value;
        return this;
    }

    /**
     * Generic getter to read an arbitrary field of the version.
     *
     * @param {string} attr - name of the attribute
     * @return {any} - the value of the attribute
     */
    getattr(attr) {
        return this.version[attr];
    }

    /**
     * Check if a version is a null version.
     *
     * @return {boolean} - stating if the value is a null version
     */
    isNullVersion() {
        return this.version.isNull;
    }

    /**
     * Check if a version is a delete marker.
     *
     * @return {boolean} - stating if the value is a delete marker
     */
    isDeleteMarker() {
        return this.version.isDeleteMarker;
    }

    /**
     * Get the versionId of the version.
     *
     * @return {string} - the versionId
     */
    getVersionId() {
        return this.version.versionId;
    }

    /**
     * Set the versionId of the version.
     *
     * @param {string} versionId - the versionId
     * @return {Version} - the updated version
     */
    setVersionId(versionId) {
        this.version.versionId = versionId;
        return this;
    }

    /**
     * Mark a version as a delete marker.
     *
     * @return {Version} - the updated version
     */
    setDeleteMarker() {
        this.version.isDeleteMarker = true;
        return this;
    }

    /**
     * Mark a version as a null version.
     *
     * @return {Version} - the updated version
     */
    setNullVersion() {
        this.version.isNull = true;
        return this;
    }

    /**
     * Serialize the version.
     *
     * @return {string} - the serialized version
     */
    toString() {
        return JSON.stringify(this.version);
    }
}

module.exports = { Version };
