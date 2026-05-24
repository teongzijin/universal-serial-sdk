import { BaseBridge } from './BaseBridge.js';

/**
 * Physical driver channel leveraging HTML5 Web Serial API directly from Chrome browser engine.
 */
export class WebSerialBridge extends BaseBridge {
    constructor() {
        super();
        this.port = null;
        this.reader = null;
        this.rawCallback = null;
        this.isLooping = false;
    }

    async open(options) {
        if (!navigator.serial) throw new Error("WebSerialBridge: Web Serial API not supported in this browser.");
        this.port = await navigator.serial.requestPort();
        await this.port.open({ baudRate: options.baudrate || 9600 });
        this.isLooping = true;
        this._startStreamPump();
        return { status: "web_serial_active" };
    }

    async _startStreamPump() {
        while (this.port.readable && this.isLooping) {
            this.reader = this.port.readable.getReader();
            try {
                while (this.isLooping) {
                    const { value, done } = await this.reader.read();
                    if (done) break;
                    if (value && this.rawCallback) {
                        const hex = Array.from(value).map(b => ('0' + b.toString(16).toUpperCase()).slice(-2)).join('');
                        this.rawCallback(hex);
                    }
                }
            } catch (e) {
                break;
            } finally {
                this.reader.releaseLock();
            }
        }
    }

    async write(hex) {
        const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
        const writer = this.port.writable.getWriter();
        await writer.write(bytes);
        writer.releaseLock();
    }

    async close() {
        this.isLooping = false;
        if (this.reader) await this.reader.cancel();
        if (this.port) await this.port.close();
    }

    onRawData(callback) {
        this.rawCallback = callback;
    }
}