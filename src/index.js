import { StreamParser } from './core/StreamParser.js';
import { CapacitorAndroidBridge } from './bridges/CapacitorAndroidBridge.js';

/**
 * Universal Serial Client Gateway Interface.
 *
 * @example
 * import { UniversalSerialClient, CapacitorAndroidBridge, SampleLockerDriver } from 'universal-serial-sdk';
 *
 * const client = new UniversalSerialClient({
 *     path: '/dev/ttyS4',
 *     baudrate: 9600,
 *     bridge: new CapacitorAndroidBridge(),
 *     driver: new SampleLockerDriver()
 * });
 *
 * client.onPacket((packet) => console.log(packet.hex));
 * await client.open();
 * await client.executeAction('query', { boardNo: 1, lockNo: null });
 */
export class UniversalSerialClient {
    /**
     * @param {Object} config
     * @param {string} config.path          Serial device path e.g. "/dev/ttyS4"
     * @param {number} config.baudrate      Baud rate e.g. 9600
     * @param {BaseBridge} config.bridge    Bridge instance (CapacitorAndroidBridge, WebSerialBridge, etc.)
     * @param {BaseDriver} config.driver    Driver instance (SampleLockerDriver or your custom driver)
     */
    constructor(config = {}) {
        this.path     = config.path     || '/dev/ttyS4';
        this.baudrate = config.baudrate || 9600;

        // Default to CapacitorAndroidBridge if none provided
        this.bridge = config.bridge || new CapacitorAndroidBridge();

        if (!config.driver) {
            throw new Error(
                'SerialSDK_Error: A driver must be provided via config.driver. ' +
                'Use SampleLockerDriver or extend BaseDriver to create your own.'
            );
        }
        this.driver = config.driver;

        this.parser = new StreamParser();
        this.parser.setDriver(this.driver);

        // Pipe raw incoming bytes directly into the sliding window parser
        this.bridge.onRawData((hex) => {
            this.parser.pushHexStream(hex);
        });
    }

    /**
     * Open the serial connection
     * @returns {Promise<Object>}
     */
    async open() {
        return await this.bridge.open({ path: this.path, baudrate: this.baudrate });
    }

    /**
     * Listen for fully parsed and checksum-verified packet frames
     * @param {Function} onPacket  Called with { rawBytes, hex } on valid frames
     * @param {Function} onError   Called with { type, bytes } on checksum failures
     */
    onPacket(onPacket, onError) {
        this.parser.bindEvents(onPacket, onError);
    }

    /**
     * Compile and send a named action via the injected driver
     * @param {string} actionName   e.g. 'query', 'unlock'
     * @param {Object} params       e.g. { boardNo: 1, lockNo: 2 }
     * @returns {Promise<Object>}
     */
    async executeAction(actionName, params = {}) {
        const rawBytes = this.driver.compileCommand(actionName, params);
        if (!rawBytes || rawBytes.length === 0) {
            throw new Error(`SerialSDK_Error: Unknown action '${actionName}'. Check your driver's compileCommand().`);
        }
        const hex = rawBytes.map(b => ('0' + b.toString(16).toUpperCase()).slice(-2)).join('');
        return await this.bridge.write(hex);
    }

    /**
     * Close the connection and reset the parser buffer
     */
    async close() {
        await this.bridge.close();
        this.parser.reset();
    }
}

// ── Export all public contracts ───────────────────────────────────────────────
export { BaseBridge }             from './bridges/BaseBridge.js';
export { CapacitorAndroidBridge } from './bridges/CapacitorAndroidBridge.js';
export { CordovaAndroidBridge }   from './bridges/CordovaAndroidBridge.js';
export { NodeSerialBridge }       from './bridges/NodeSerialBridge.js';
export { ElectronSerialBridge }   from './bridges/ElectronSerialBridge.js';
export { WebSerialBridge }        from './bridges/WebSerialBridge.js';
export { BaseDriver }             from './drivers/BaseDriver.js';
export { SampleLockerDriver }     from './drivers/SampleLockerDriver.js';
