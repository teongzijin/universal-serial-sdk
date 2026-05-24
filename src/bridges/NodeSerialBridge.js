import { BaseBridge } from './BaseBridge.js';

/**
 * Node.js Serial Bridge
 * Connects the JS layer to the serial port via the 'serialport' npm package.
 * Use this bridge when running in a Linux or Electron environment.
 *
 * Required: npm install serialport
 *
 * Linux permission setup (one-time):
 *   sudo usermod -a -G dialout $USER
 *   (re-login after running this)
 */
export class NodeSerialBridge extends BaseBridge {
    constructor() {
        super();
        this.port = null;
        this.rawCallback = null;
    }

    async open(options) {
        // Dynamically import serialport so Android/Capacitor users don't need it installed
        let SerialPort;
        try {
            const mod = await import('serialport');
            SerialPort = mod.SerialPort;
        } catch (e) {
            throw new Error(
                'NodeSerialBridge: "serialport" package not found. ' +
                'Please run: npm install serialport'
            );
        }

        return new Promise((resolve, reject) => {
            this.port = new SerialPort({
                path: options.path,
                baudRate: options.baudrate || 9600,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                autoOpen: false
            });

            this.port.open((err) => {
                if (err) return reject(new Error(`NodeSerialBridge: Failed to open port -> ${err.message}`));
                resolve({ status: 'connected', path: options.path });
            });

            this.port.on('data', (data) => {
                if (this.rawCallback) {
                    this.rawCallback(data.toString('hex').toUpperCase());
                }
            });

            this.port.on('error', (err) => {
                console.error('NodeSerialBridge error:', err.message);
            });
        });
    }

    async write(hex) {
        return new Promise((resolve, reject) => {
            if (!this.port || !this.port.isOpen) {
                return reject(new Error('NodeSerialBridge: Port is not open.'));
            }
            this.port.write(Buffer.from(hex, 'hex'), (err) => {
                if (err) return reject(new Error(`NodeSerialBridge: Write failed -> ${err.message}`));
                this.port.drain(() => resolve({ sent: hex }));
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            if (!this.port || !this.port.isOpen) return resolve();
            this.port.close(() => {
                this.port = null;
                resolve({ status: 'closed' });
            });
        });
    }

    onRawData(callback) {
        this.rawCallback = callback;
    }
}
