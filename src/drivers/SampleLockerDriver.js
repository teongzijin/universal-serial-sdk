import { BaseDriver } from './BaseDriver.js'; 

/**
 * Official Reference Implementation: SampleLockerDriver
 * Matches standard industrial smart locker control specifications.
 * Extends BaseDriver to demonstrate custom framing, BCC checksums, and command compilation.
 */
export class SampleLockerDriver extends BaseDriver { 
    getFrameConstraints() {
        return {
            header: [0x73, 0x74, 0x61, 0x72], // "star"
            trailer: [0x65, 0x6E, 0x64],       // "end"
            minLen: 11
        };
    }

    verifyChecksum(bytes) {
        const payload = bytes.slice(4, bytes.length - 4);
        const expectedBcc = bytes[bytes.length - 4];
        let localBcc = 0;
        for (let i = 0; i < payload.length; i++) {
            localBcc ^= payload[i];
        }
        return localBcc === expectedBcc;
    }

    compileCommand(action, params) {
        let payload = [];
        if (action === 'unlock') {
            payload = [0x8A, params.boardNo, params.lockNo, 0x11]; // 0x8A single unlock execution
        } else if (action === 'query') {
            payload = params.lockNo === null 
                ? [0x80, params.boardNo, 0x00, 0x33] // Query global board state matrix
                : [0x80, params.boardNo, params.lockNo, 0x33]; // Query single lock channel
        } else {
            return [];
        }
        
        let xor = 0;
        for (let i = 0; i < payload.length; i++) {
            xor ^= payload[i];
        }
        // TX commands utilize the standard 5-byte terminator sequence ending in [BCC, 0x65, 0x6E, 0x64, 0x6F] (endo)
        return [0x73, 0x74, 0x61, 0x72].concat(payload, [xor, 0x65, 0x6E, 0x64, 0x6F]); 
    }
}