/**
 * Generates PWA icons at 192, 256, 384, and 512px using only Node built-ins
 * (writes raw PNG via a minimal PNG encoder — no external deps needed).
 * 
 * Run with: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Minimal PNG encoder (pure Node, no canvas needed)
function buildPNG(width, height, pixels) {
    // pixels: Uint8Array of RGBA values, row by row
    const crc32 = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            table[i] = c;
        }
        return (buf) => {
            let crc = 0xffffffff;
            for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
            return (crc ^ 0xffffffff) >>> 0;
        };
    })();

    function chunk(type, data) {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const typeB = Buffer.from(type);
        const crcBytes = Buffer.alloc(4);
        crcBytes.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
        return Buffer.concat([len, typeB, data, crcBytes]);
    }

    function deflate(data) {
        // Use Node's zlib for DEFLATE compression
        return require('zlib').deflateSync(data, { level: 9 });
    }

    // IHDR
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB ... we'll use RGBA: type 6
    ihdr[9] = 6; // RGBA

    // Raw image data (filter byte 0 before each row)
    const rowSize = width * 4;
    const raw = Buffer.alloc((rowSize + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (rowSize + 1)] = 0; // filter byte
        for (let x = 0; x < width; x++) {
            const src = (y * width + x) * 4;
            const dst = y * (rowSize + 1) + 1 + x * 4;
            raw[dst] = pixels[src];
            raw[dst + 1] = pixels[src + 1];
            raw[dst + 2] = pixels[src + 2];
            raw[dst + 3] = pixels[src + 3];
        }
    }

    const idat = deflate(raw);
    const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return Buffer.concat([
        PNG_SIG,
        chunk('IHDR', ihdr),
        chunk('IDAT', idat),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function generateIcon(size) {
    const pixels = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const cx = size / 2, cy = size / 2;
            const dx = x - cx, dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const r = size / 2;

            // Corner radius (rounded square)
            const cornerR = size * 0.22;
            const ax = Math.abs(dx), ay = Math.abs(dy);
            const inRoundedSquare = (ax <= r - cornerR && ay <= r) ||
                (ay <= r - cornerR && ax <= r) ||
                (Math.sqrt((ax - (r - cornerR)) ** 2 + (ay - (r - cornerR)) ** 2) <= cornerR);

            if (!inRoundedSquare) {
                // Transparent outside
                pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = 0; pixels[idx + 3] = 0;
                continue;
            }

            // Dark background: #0a0a0f
            let R = 10, G = 10, B = 15, A = 255;

            // Radial glow: purple (#7c3aed) centre, teal (#06b6d4) outer
            const t = Math.min(dist / r, 1);
            const glowR = Math.round(124 * (1 - t) + 6 * t);
            const glowG = Math.round(58 * (1 - t) + 182 * t);
            const glowB = Math.round(237 * (1 - t) + 212 * t);
            const glowA = Math.max(0, 0.4 - t * 0.35);

            R = Math.round(R * (1 - glowA) + glowR * glowA);
            G = Math.round(G * (1 - glowA) + glowG * glowA);
            B = Math.round(B * (1 - glowA) + glowB * glowA);

            // QR-like grid pattern in the lower third
            const gridSize = Math.round(size * 0.04);
            const gridY = Math.round(size * 0.60);
            const gridX0 = Math.round(size * 0.22);
            const gridX1 = Math.round(size * 0.78);
            if (y >= gridY && y <= gridY + gridSize * 5 && x >= gridX0 && x <= gridX1) {
                const gx = Math.floor((x - gridX0) / gridSize);
                const gy = Math.floor((y - gridY) / gridSize);
                // Simple QR-like pattern
                const pattern = [
                    [1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1],
                    [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1],
                    [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1],
                    [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1],
                    [1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1],
                ];
                if (gy < pattern.length && gx < pattern[0].length && pattern[gy][gx]) {
                    R = 255; G = 255; B = 255;
                }
            }

            // Emoji-like car shape in upper-center
            const carCX = cx, carCY = size * 0.34;
            const carW = size * 0.28, carH = size * 0.14;
            if (Math.abs(x - carCX) < carW && Math.abs(y - carCY) < carH) {
                // gradient from purple to teal
                const tCar = (x - (carCX - carW)) / (2 * carW);
                R = Math.round(124 + (6 - 124) * tCar);
                G = Math.round(58 + (182 - 58) * tCar);
                B = Math.round(237 + (212 - 237) * tCar);
            }

            // Wheels
            [carCX - size * 0.16, carCX + size * 0.16].forEach((wx) => {
                const wy = carCY + size * 0.10;
                const wr = size * 0.05;
                if (Math.sqrt((x - wx) ** 2 + (y - wy) ** 2) < wr) {
                    R = 30; G = 30; B = 40;
                }
            });

            pixels[idx] = R; pixels[idx + 1] = G; pixels[idx + 2] = B; pixels[idx + 3] = A;
        }
    }

    return buildPNG(size, size, pixels);
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const sizes = [192, 256, 384, 512];
sizes.forEach((size) => {
    const buf = generateIcon(size);
    const outPath = path.join(outDir, `icon-${size}.png`);
    fs.writeFileSync(outPath, buf);
    console.log(`✅ Generated ${outPath} (${buf.length} bytes)`);
});

console.log('\n🎉 All PWA icons generated!');
