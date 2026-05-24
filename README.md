# Universal Serial Stream SDK

Industrial-grade serial communication SDK for hybrid mobile and desktop apps. Cleanly separates **Transport Bridges**, **Stream Parsers**, and **Protocol Drivers** so you only write what's unique to your hardware.

Supports Capacitor Android (native UART), Cordova Android, Node.js (Linux & Windows), Electron, and Web Serial API (Chrome desktop).

---

## Architecture

```
Your App
   │
   ▼
UniversalSerialClient            ← single entry point
   │
   ├── Bridge Layer              ← HOW to connect (swap per framework)
   │   ├── CapacitorAndroidBridge   (Capacitor + native UART)
   │   ├── CordovaAndroidBridge     (Cordova Android)
   │   ├── NodeSerialBridge         (Linux & Windows Node.js)
   │   ├── ElectronSerialBridge     (Electron desktop)
   │   ├── WebSerialBridge          (Chrome Web Serial API)
   │   └── [Your own bridge]        extend BaseBridge
   │
   ├── StreamParser              ← sliding window, handles fragmented packets
   │
   └── Driver Layer              ← WHAT protocol (swap per hardware)
       ├── SampleLockerDriver       (世凯众源 RS485 locker boards sample)
       └── [Your own driver]        extend BaseDriver
```

---

## Installation

### Capacitor (Android)

```bash
npm install universal-serial-sdk
npx cap sync
```

The installer automatically:
- Adds JitPack to `android/build.gradle`
- Adds `Android-SerialPort-API` to `android/app/build.gradle`
- Registers `SerialPlugin` via Capacitor service discovery

No changes to `MainActivity.java` needed.

---

### Cordova (Android)

```bash
cordova plugin add universal-serial-sdk
```

---

### Linux (Node.js)

```bash
npm install universal-serial-sdk
npm install serialport
```

> **Permission note:** On some Linux distributions, you may need to add your user to the `dialout` group to access serial ports without root:
> ```bash
> sudo usermod -a -G dialout $USER
> # Re-login after running this
> ```
> On many industrial devices this is not required as the port permissions are pre-configured by the manufacturer.

---

### Windows (Node.js)

```bash
npm install universal-serial-sdk
npm install serialport
```

> **Build tools note:** If `serialport` installation fails, you need Visual C++ Build Tools first:
> - [Download Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
> - Or run as Administrator: `npm install --global windows-build-tools`

---

### Electron

```bash
npm install universal-serial-sdk
npm install serialport   # only needed for node mode
```

---

## Serial Port Path Reference

The `path` value depends on your operating system and device:

| Platform | Example Path | Notes |
|----------|-------------|-------|
| Android (UART) | `/dev/ttyS4` | Varies by device, e.g. `/dev/ttyS0`, `/dev/ttyS1` |
| Android (USB) | `/dev/ttyUSB0` | USB-to-serial adapter |
| Linux | `/dev/ttyS0`, `/dev/ttyUSB0` | Check with `ls /dev/tty*` |
| Windows | `COM3`, `COM4` | Check Device Manager for the correct COM port |
| macOS | `/dev/tty.usbserial-XXXX` | Check with `ls /dev/tty.*` |

> Always verify the correct port path on your specific device before connecting.

---

## Quick Start by Platform

### Capacitor (Android)

```javascript
import { UniversalSerialClient, CapacitorAndroidBridge, SampleLockerDriver } from 'universal-serial-sdk';

const client = new UniversalSerialClient({
    path: '/dev/ttyS4',   // check your device's actual port path
    baudrate: 9600,
    bridge: new CapacitorAndroidBridge(),
    driver: new SampleLockerDriver()
});

client.onPacket(
    (packet) => console.log('RX:', packet.hex),
    (err)    => console.warn('Checksum fail:', err)
);

await client.open();
await client.executeAction('query', { boardNo: 1, lockNo: null });
await client.close();
```

---

### Cordova (Android)

```javascript
import { UniversalSerialClient, SampleLockerDriver } from 'universal-serial-sdk';
import { CordovaAndroidBridge } from 'universal-serial-sdk/src/bridges/CordovaAndroidBridge.js';

const client = new UniversalSerialClient({
    path: '/dev/ttyS4',   // check your device's actual port path
    baudrate: 9600,
    bridge: new CordovaAndroidBridge(),
    driver: new SampleLockerDriver()
});

client.onPacket((packet) => console.log('RX:', packet.hex));
await client.open();
await client.executeAction('query', { boardNo: 1, lockNo: null });
await client.close();
```

---

### Linux (Node.js)

```javascript
import { UniversalSerialClient, SampleLockerDriver } from 'universal-serial-sdk';
import { NodeSerialBridge } from 'universal-serial-sdk/src/bridges/NodeSerialBridge.js';

const client = new UniversalSerialClient({
    path: '/dev/ttyS0',   // check with: ls /dev/tty*
    baudrate: 9600,
    bridge: new NodeSerialBridge(),
    driver: new SampleLockerDriver()
});

client.onPacket((packet) => console.log('RX:', packet.hex));
await client.open();
await client.executeAction('query', { boardNo: 1, lockNo: null });
await client.close();
```

---

### Windows (Node.js)

```javascript
import { UniversalSerialClient, SampleLockerDriver } from 'universal-serial-sdk';
import { NodeSerialBridge } from 'universal-serial-sdk/src/bridges/NodeSerialBridge.js';

const client = new UniversalSerialClient({
    path: 'COM3',         // check Device Manager for your COM port (COM1, COM2, COM3...)
    baudrate: 9600,
    bridge: new NodeSerialBridge(),
    driver: new SampleLockerDriver()
});

client.onPacket((packet) => console.log('RX:', packet.hex));
await client.open();
await client.executeAction('query', { boardNo: 1, lockNo: null });
await client.close();
```

---

### Electron

```javascript
import { UniversalSerialClient, SampleLockerDriver } from 'universal-serial-sdk';
import { ElectronSerialBridge } from 'universal-serial-sdk/src/bridges/ElectronSerialBridge.js';

const client = new UniversalSerialClient({
    path: 'COM3',         // Windows: COM3 / Linux: /dev/ttyS0 / macOS: /dev/tty.usbserial-XXXX
    baudrate: 9600,
    bridge: new ElectronSerialBridge(),  // auto-detects IPC or node mode
    driver: new SampleLockerDriver()
});

client.onPacket((packet) => console.log('RX:', packet.hex));
await client.open();
await client.executeAction('query', { boardNo: 1, lockNo: null });
await client.close();
```

---

### Web Serial API (Chrome Desktop)

```javascript
import { UniversalSerialClient, WebSerialBridge, SampleLockerDriver } from 'universal-serial-sdk';

const client = new UniversalSerialClient({
    baudrate: 9600,
    bridge: new WebSerialBridge(),   // triggers browser port picker, no path needed
    driver: new SampleLockerDriver()
});

client.onPacket((packet) => console.log('RX:', packet.hex));
await client.open();
await client.executeAction('query', { boardNo: 1, lockNo: null });
await client.close();
```

> Web Serial API requires Chrome or Edge. The browser will show a port picker dialog on `open()`.

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
        // implement your checksum logic here (XOR, CRC16, etc.)
        return true;
    }

    // Translate action names into raw byte arrays to send
    compileCommand(action, params = {}) {
        if (action === 'openGate') {
            return [0xAA, 0xBB, params.gateId, 0x01, 0xCC];
        }
        return [];
    }
}
```

`SampleLockerDriver` is a reference implementation for 世凯众源 RS485 locker boards. Use it as a starting point for your own driver.

---

## Writing Your Own Bridge

Extend `BaseBridge` to support other frameworks (React Native, custom WebView, etc.):

```javascript
import { BaseBridge } from 'universal-serial-sdk';

export class MyCustomBridge extends BaseBridge {

    async open(options) {
        // options = { path, baudrate }
        // connect to serial port here
    }

    async write(hex) {
        // send hex string to serial port
    }

    async close() {
        // close the connection
    }

    onRawData(callback) {
        // call callback(hexString) whenever data arrives
    }
}
```

---

## License

ISC
