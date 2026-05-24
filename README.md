# Universal Serial Stream SDK

Industrial-grade serial communication SDK for hybrid mobile apps. Cleanly separates **Transport Bridges**, **Stream Parsers**, and **Protocol Drivers** so you only write what's unique to your hardware.

Supports Capacitor Android (native UART), Web Serial API (Chrome desktop), and is designed to extend to Cordova and React Native.

---

## Architecture

```
Your App
   │
   ▼
UniversalSerialClient       ← single entry point
   │
   ├── Bridge Layer          ← HOW to connect (swap per framework)
   │   ├── CapacitorAndroidBridge   (Capacitor + native UART)
   │   ├── WebSerialBridge          (Chrome Web Serial API)
   │   └── [Your own bridge]        extend BaseBridge
   │
   ├── StreamParser          ← sliding window, handles fragmented packets
   │
   └── Driver Layer          ← WHAT protocol (swap per hardware)
       ├── SampleLockerDriver       (世凯众源 RS485 locker boards)
       └── [Your own driver]        extend BaseDriver
```

---

## Installation

### Capacitor (Android)
```bash
npm install universal-serial-sdk
npx cap sync
```
The installer automatically adds JitPack, Android-SerialPort-API, and registers SerialPlugin. No `MainActivity.java` changes needed.

### Linux (Node.js)
```bash
npm install universal-serial-sdk
npm install serialport
sudo usermod -a -G dialout $USER  # one-time permission setup
```

### Electron
```bash
npm install universal-serial-sdk
npm install serialport  # only needed for node mode
```

### Cordova (Android)
```bash
npm install universal-serial-sdk
```
Add to `config.xml`: `<plugin name="SerialPlugin" value="com.universalserialsdk.SerialPlugin" />`

---

## Quick Start by Platform

### Capacitor (Android)
```javascript
import { UniversalSerialClient, CapacitorAndroidBridge, SampleLockerDriver } from 'universal-serial-sdk';

const client = new UniversalSerialClient({
    path: '/dev/ttyS4',
    baudrate: 9600,
    bridge: new CapacitorAndroidBridge(),
    driver: new SampleLockerDriver()
});
```

### Linux (Node.js)
```javascript
import { UniversalSerialClient, SampleLockerDriver } from 'universal-serial-sdk';
import { NodeSerialBridge } from 'universal-serial-sdk/src/bridges/NodeSerialBridge.js';

const client = new UniversalSerialClient({
    path: '/dev/ttyS4',
    baudrate: 9600,
    bridge: new NodeSerialBridge(),
    driver: new SampleLockerDriver()
});
```

### Electron
```javascript
import { UniversalSerialClient, SampleLockerDriver } from 'universal-serial-sdk';
import { ElectronSerialBridge } from 'universal-serial-sdk/src/bridges/ElectronSerialBridge.js';

const client = new UniversalSerialClient({
    path: '/dev/ttyS4',
    baudrate: 9600,
    bridge: new ElectronSerialBridge(), // auto-detects IPC or node mode
    driver: new SampleLockerDriver()
});
```

### Cordova (Android)
```javascript
import { UniversalSerialClient, SampleLockerDriver } from 'universal-serial-sdk';
import { CordovaAndroidBridge } from 'universal-serial-sdk/src/bridges/CordovaAndroidBridge.js';

const client = new UniversalSerialClient({
    path: '/dev/ttyS4',
    baudrate: 9600,
    bridge: new CordovaAndroidBridge(),
    driver: new SampleLockerDriver()
});
```

### Web Serial API (Chrome Desktop Testing)
```javascript
import { UniversalSerialClient, WebSerialBridge, SampleLockerDriver } from 'universal-serial-sdk';

const client = new UniversalSerialClient({
    baudrate: 9600,
    bridge: new WebSerialBridge(),
    driver: new SampleLockerDriver()
});
```

---

## Quick Start

```javascript
import {
    UniversalSerialClient,
    CapacitorAndroidBridge,
    SampleLockerDriver
} from 'universal-serial-sdk';

const client = new UniversalSerialClient({
    path: '/dev/ttyS4',
    baudrate: 9600,
    bridge: new CapacitorAndroidBridge(),
    driver: new SampleLockerDriver()
});

// Listen for verified packets
client.onPacket(
    (packet) => console.log('RX:', packet.hex),
    (err)    => console.warn('Checksum fail:', err)
);

// Connect
await client.open();

// Query all locks on board 1
await client.executeAction('query', { boardNo: 1, lockNo: null });

// Query single lock
await client.executeAction('query', { boardNo: 1, lockNo: 3 });

// Unlock
await client.executeAction('unlock', { boardNo: 1, lockNo: 3 });

// Close
await client.close();
```

---

## Writing Your Own Driver

Extend `BaseDriver` with 3 methods:

```javascript
import { BaseDriver } from 'universal-serial-sdk';

export class MyGateDriver extends BaseDriver {

    // Tell the parser what a valid frame looks like
    getFrameConstraints() {
        return {
            header: [0xAA, 0xBB],   // your frame header bytes
            trailer: [0xCC],         // your frame trailer bytes
            minLen: 6                // minimum valid packet length
        };
    }

    // Validate checksum of a complete extracted frame
    verifyChecksum(bytes) {
        // e.g. XOR check, CRC16, etc.
        return true;
    }

    // Translate action names into raw byte arrays
    compileCommand(action, params = {}) {
        if (action === 'openGate') {
            return [0xAA, 0xBB, params.gateId, 0x01, 0xCC];
        }
        return [];
    }
}
```

---

## Writing Your Own Bridge

Extend `BaseBridge` for other frameworks (Cordova, React Native, etc.):

```javascript
import { BaseBridge } from 'universal-serial-sdk';

export class CordovaAndroidBridge extends BaseBridge {
    async open(options) {
        return new Promise((resolve, reject) => {
            cordova.exec(resolve, reject, 'SerialPlugin', 'openPort', [options]);
        });
    }
    async write(hex) {
        return new Promise((resolve, reject) => {
            cordova.exec(resolve, reject, 'SerialPlugin', 'sendHex', [{ hex }]);
        });
    }
    async close() {
        return new Promise((resolve, reject) => {
            cordova.exec(resolve, reject, 'SerialPlugin', 'closePort', []);
        });
    }
    onRawData(callback) {
        // wire up your framework's event listener here
    }
}
```

---

## Web Serial API (Desktop Chrome Testing)

```javascript
import { UniversalSerialClient, WebSerialBridge, SampleLockerDriver } from 'universal-serial-sdk';

const client = new UniversalSerialClient({
    baudrate: 9600,
    bridge: new WebSerialBridge(),
    driver: new SampleLockerDriver()
});

await client.open(); // triggers browser port picker
```

---

## License

ISC
