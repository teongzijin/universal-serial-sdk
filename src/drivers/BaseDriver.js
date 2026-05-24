/**
 * Abstract Base Class representing a Hardware Protocol Driver.
 * All custom hardware drivers must extend this class.
 */
export class BaseDriver {
    /**
     * Define the structural layout of a valid packet frame
     * @returns {Object} { header: number[], trailer: number[], minLen: number }
     */
    getFrameConstraints() {
        throw new Error("DriverError: getFrameConstraints() must be implemented.");
    }

    /**
     * Run checksum integrity check validation against extracted bytes
     * @param {number[]} bytes Pure sliced packet array bytes
     * @returns {boolean} True if checksum matches perfectly
     */
    verifyChecksum(bytes) {
        throw new Error("DriverError: verifyChecksum() must be implemented.");
    }

    /**
     * Compile a business semantic action into exact hardware Hex protocol bytes
     * @param {string} action Action identifier (e.g., 'unlock', 'query')
     * @param {Object} params Target action parameters
     * @returns {number[]} Compiled output array bytes ready to transmit
     */
    compileCommand(action, params) {
        throw new Error("DriverError: compileCommand() must be implemented.");
    }
}