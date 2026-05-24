/**
 * Universal Stream Real-time Re-alignment Engine.
 * Implements a shifting sliding window parsing state machine.
 */
export class StreamParser {
    constructor() {
        this.buffer = [];
        this.packetListener = null;
        this.errorListener = null;
        this.driver = null;
    }

    /**
     * Inject the protocol configuration mapping strategy
     * @param {BaseDriver} driver Target peripheral hardware protocol dictionary
     */
    setDriver(driver) {
        this.driver = driver;
    }

    /**
     * Push incoming hex stream fragments into the parsing queue heap
     * @param {string} hex Raw hexadecimal string snippet from native layers
     */
    pushHexStream(hex) {
        if (!hex) return;
        for (let i = 0; i < hex.length; i += 2) {
            this.buffer.push(parseInt(hex.substr(i, 2), 16));
        }
        this._analyzeSlidingWindow();
    }

    /**
     * Internal Sliding Window Analyzer
     * Coordinates chunk realignment, noise filtering, boundaries slicing, and driver check validations.
     * @private
     */
    _analyzeSlidingWindow() {
        // Halt parsing sequences immediately if no driver protocol dictionary is attached
        if (!this.driver) return; 

        // Query frame layout constraints dynamically from the active driver strategy
        const constraints = this.driver.getFrameConstraints();
        const header = constraints.header;
        const trailer = constraints.trailer;
        const hLen = header.length;
        const tLen = trailer.length;

        while (this.buffer.length >= constraints.minLen) {
            
            // 1. Dynamic Frame Header Alignment Lookup
            let headIdx = this.buffer.findIndex((b, idx, arr) => {
                for (let i = 0; i < hLen; i++) {
                    if (arr[idx + i] !== header[i]) return false;
                }
                return true;
            });

            if (headIdx === -1) {
                // Safeguard trailing edge bytes to avoid breaking incoming headers sliced in halves
                if (this.buffer.length > hLen) {
                    this.buffer = this.buffer.slice(this.buffer.length - hLen);
                }
                break;
            }
            if (headIdx > 0) {
                // Purge unaligned orphan debris data preceding verified headers
                this.buffer = this.buffer.slice(headIdx);
                continue;
            }

            // 2. Dynamic Frame Terminator Tail Boundary Scan
            let tailIdx = -1;
            const endBound = this.buffer.length - tLen;
            for (let k = hLen; k <= endBound; k++) {
                let match = true;
                for (let i = 0; i < tLen; i++) {
                    if (this.buffer[k + i] !== trailer[i]) { 
                        match = false; 
                        break; 
                    }
                }
                if (match) { 
                    tailIdx = k; 
                    break; 
                }
            }

            if (tailIdx === -1) break; // Frame slicing truncated, await next byte segment chunk injection

            const packageSize = tailIdx + tLen;
            if (this.buffer.length < packageSize) break;

            // 3. Extract verified clean packet frame and update window queue
            const slicedFrameBytes = this.buffer.slice(0, packageSize);
            this.buffer = this.buffer.slice(packageSize); 

            // 4. Delegate mathematical checksum arithmetic (BCC, CRC16, etc.) to the target driver
            if (!this.driver.verifyChecksum(slicedFrameBytes)) {
                if (this.errorListener) {
                    this.errorListener({ 
                        type: "checksum_mismatch", 
                        bytes: slicedFrameBytes 
                    });
                }
                continue;
            }

            // 5. Emit pristine verified frames up to upper application layers for custom business routing
            if (this.packetListener) {
                this.packetListener({
                    rawBytes: slicedFrameBytes,
                    hex: slicedFrameBytes.map(b => ('0' + b.toString(16).toUpperCase()).slice(-2)).join('')
                });
            }
        }
    }

    /**
     * Bind long-running stream callback handlers
     * @param {Function} onPacket Callback invoked when a complete frame passes verification
     * @param {Function} onError Callback invoked upon checksum mismatch alerts
     */
    bindEvents(onPacket, onError) {
        this.packetListener = onPacket;
        this.errorListener = onError;
    }

    /**
     * Purge residual heap bytes from memory cache to prevent stream pollution
     */
    reset() { 
        this.buffer = []; 
    }
}