import { BaseBridge } from './BaseBridge.js';

/**
 * Cordova Android Bridge
 * Connects the JS layer to the native SerialPlugin via Cordova's exec() API.
 * Use this bridge when running inside a Cordova Android app.
 *
 * Required native side: SerialPlugin.java registered as a Cordova plugin.
 * Add to config.xml:
 *   <plugin name="SerialPlugin" value="com.universalserialsdk.SerialPlugin" />
 */
export class CordovaAndroidBridge extends BaseBridge {
    constructor() {
        super();
        this.rawCallback = null;
        this._deviceReady = false;
        this._openQueue = [];
    }

    _exec(action, args = []) {
        return new Promise((resolve, reject) => {
            if (typeof cordova === 'undefined') {
                return reject(new Error(
                    'CordovaAndroidBridge: cordova is not defined. ' +
                    'Make sure you are running inside a Cordova app.'
                ));
            }
            cordova.exec(
                (result) => resolve(result),
                (err)    => reject(new Error(`CordovaAndroidBridge: ${err}`)),
                'SerialPlugin',
                action,
                args
            );
        });
    }

    async open(options) {
        // Wait for deviceready if Cordova hasn't fired yet
        await this._waitForDeviceReady();

        const result = await this._exec('openPort', [options]);

        // Register data listener after port is open
        this._attachDataListener();

        return result;
    }

    async write(hex) {
        return await this._exec('sendHex', [{ hex }]);
    }

    async close() {
        return await this._exec('closePort', []);
    }

    onRawData(callback) {
        this.rawCallback = callback;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    _waitForDeviceReady() {
        if (this._deviceReady) return Promise.resolve();
        return new Promise((resolve) => {
            document.addEventListener('deviceready', () => {
                this._deviceReady = true;
                resolve();
            }, { once: true });
        });
    }

    _attachDataListener() {
        // Use Cordova exec with keepCallback=true to receive ongoing data events
        if (typeof cordova === 'undefined') return;
        cordova.exec(
            (event) => {
                if (event?.hex && this.rawCallback) {
                    this.rawCallback(event.hex);
                }
            },
            (err) => console.error('CordovaAndroidBridge data error:', err),
            'SerialPlugin',
            'listenData',
            [],
            true // keepCallback - keeps the channel open for multiple callbacks
        );
    }
}
