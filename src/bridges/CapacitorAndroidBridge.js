import { BaseBridge } from './BaseBridge.js';

/**
 * Capacitor Android Bridge
 * Connects the JS layer to the native SerialPlugin via Capacitor Plugin API.
 * Use this bridge when running inside a Capacitor Android app.
 *
 * Required native side: SerialPlugin.java registered in MainActivity.
 */
export class CapacitorAndroidBridge extends BaseBridge {
    constructor() {
        super();
        this.rawCallback = null;
        this._listenersAttached = false;
    }

    _getPlugin() {
        const plugin = window.Capacitor?.Plugins?.SerialPlugin;
        if (!plugin) throw new Error(
            'CapacitorAndroidBridge: SerialPlugin not found. ' +
            'Make sure SerialPlugin.java is registered in MainActivity via registerPlugin(SerialPlugin.class).'
        );
        return plugin;
    }

    async open(options) {
        const plugin = this._getPlugin();
        const result = await plugin.openPort(options);
        this._attachListeners(plugin);
        return result;
    }

    async write(hex) {
        return await this._getPlugin().sendHex({ hex });
    }

    async close() {
        this._listenersAttached = false;
        return await this._getPlugin().closePort();
    }

    onRawData(callback) {
        this.rawCallback = callback;
    }

    _attachListeners(plugin) {
        if (this._listenersAttached) return;

        plugin.addListener('onSerialData', (event) => {
            if (this.rawCallback) this.rawCallback(event.hex);
        });

        plugin.addListener('onSerialError', (event) => {
            console.error('CapacitorAndroidBridge SerialError:', event.error);
        });

        this._listenersAttached = true;
    }
}
