import { BaseBridge } from './BaseBridge.js';

/**
 * Electron Serial Bridge
 * Connects the JS layer to the serial port in an Electron app.
 * Supports two modes depending on your Electron setup:
 *
 * Mode A (Recommended): Via preload IPC bridge
 *   - More secure, works with contextIsolation: true
 *   - Requires setting up ipcMain handlers in your main process (see README)
 *
 * Mode B: Direct Node.js serialport (renderer with nodeIntegration: true)
 *   - Simpler but less secure
 *   - Required: npm install serialport
 *
 * The bridge auto-detects which mode is available.
 */
export class ElectronSerialBridge extends BaseBridge {
    constructor() {
        super();
        this.rawCallback = null;
        this._mode = null;
        this._nodePort = null;
    }

    _detectMode() {
        // Mode A: preload exposes window.electronSerial IPC bridge
        if (window.electronSerial) return 'ipc';
        // Mode B: direct Node.js access in renderer
        if (typeof require !== 'undefined') return 'node';
        throw new Error(
            'ElectronSerialBridge: No serial access method found.\n' +
            'Option A: Expose an IPC bridge via preload.js (window.electronSerial)\n' +
            'Option B: Enable nodeIntegration in BrowserWindow and install serialport'
        );
    }

    async open(options) {
        this._mode = this._detectMode();

        if (this._mode === 'ipc') {
            const result = await window.electronSerial.openPort(options);
            // Listen for data pushed from main process
            window.electronSerial.onData((hex) => {
                if (this.rawCallback) this.rawCallback(hex);
            });
            return result;
        }

        // Mode B: direct Node.js serialport
        let SerialPort;
        try {
            SerialPort = require('serialport').SerialPort;
        } catch (e) {
            throw new Error(
                'ElectronSerialBridge (node mode): "serialport" not found.\n' +
                'Run: npm install serialport'
            );
        }

        return new Promise((resolve, reject) => {
            this._nodePort = new SerialPort({
                path: options.path,
                baudRate: options.baudrate || 9600,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                autoOpen: false
            });

            this._nodePort.open((err) => {
                if (err) return reject(new Error(`ElectronSerialBridge: ${err.message}`));
                resolve({ status: 'connected', path: options.path });
            });

            this._nodePort.on('data', (data) => {
                if (this.rawCallback) {
                    this.rawCallback(data.toString('hex').toUpperCase());
                }
            });

            this._nodePort.on('error', (err) => {
                console.error('ElectronSerialBridge error:', err.message);
            });
        });
    }

    async write(hex) {
        if (this._mode === 'ipc') {
            return await window.electronSerial.sendHex(hex);
        }
        return new Promise((resolve, reject) => {
            if (!this._nodePort?.isOpen) {
                return reject(new Error('ElectronSerialBridge: Port is not open.'));
            }
            this._nodePort.write(Buffer.from(hex, 'hex'), (err) => {
                if (err) return reject(new Error(`ElectronSerialBridge: Write failed -> ${err.message}`));
                this._nodePort.drain(() => resolve({ sent: hex }));
            });
        });
    }

    async close() {
        if (this._mode === 'ipc') {
            return await window.electronSerial.closePort();
        }
        return new Promise((resolve) => {
            if (!this._nodePort?.isOpen) return resolve();
            this._nodePort.close(() => {
                this._nodePort = null;
                resolve({ status: 'closed' });
            });
        });
    }

    onRawData(callback) {
        this.rawCallback = callback;
    }
}
