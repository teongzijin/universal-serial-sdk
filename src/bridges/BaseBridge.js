/**
 * Interface standard defining the connection hardware pipeline.
 */
export class BaseBridge {
    async open(options) { throw new Error("BridgeError: open() required."); }
    async write(hex) { throw new Error("BridgeError: write() required."); }
    async close() { throw new Error("BridgeError: close() required."); }
    onRawData(callback) { throw new Error("BridgeError: onRawData() required."); }
}