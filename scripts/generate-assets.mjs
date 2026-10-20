import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(projectRoot, "assets");
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];

function hexToRgb(hex) {
    const value = hex.replace("#", "");
    return [
        parseInt(value.slice(0, 2), 16),
        parseInt(value.slice(2, 4), 16),
        parseInt(value.slice(4, 6), 16)
    ];
}

function rgba(hex, alpha = 1) {
    const [r, g, b] = hexToRgb(hex);
    return [r, g, b, Math.round(alpha * 255)];
}

function mix(a, b, t) {
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
    ];
}

function createCanvas(size) {
    return { size, data: new Uint8Array(size * size * 4) };
}

function blendPixel(canvas, x, y, color) {
    if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return;
    const index = (y * canvas.size + x) * 4;
    const alpha = color[3] / 255;
    const existingAlpha = canvas.data[index + 3] / 255;
    const outAlpha = alpha + existingAlpha * (1 - alpha);
    if (outAlpha === 0) return;
    for (let channel = 0; channel < 3; channel += 1) {
        const src = color[channel] * alpha;
        const dst = canvas.data[index + channel] * existingAlpha * (1 - alpha);
        canvas.data[index + channel] = Math.round((src + dst) / outAlpha);
    }
    canvas.data[index + 3] = Math.round(outAlpha * 255);
}

function fillEllipse(canvas, cx, cy, rx, ry, colorFn) {
    const minY = Math.max(0, Math.floor(cy - ry - 1));
    const maxY = Math.min(canvas.size - 1, Math.ceil(cy + ry + 1));
    const minX = Math.max(0, Math.floor(cx - rx - 1));
    const maxX = Math.min(canvas.size - 1, Math.ceil(cx + rx + 1));
    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            const dx = (x + 0.5 - cx) / rx;
            const dy = (y + 0.5 - cy) / ry;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 1) {
                const edge = Math.min(1, (1 - distance) * Math.max(rx, ry) + 0.15);
                const color = colorFn(x + 0.5, y + 0.5);
                blendPixel(canvas, x, y, [color[0], color[1], color[2], color[3] * edge]);
            }
        }
    }
}

function roundedRectContains(x, y, left, top, width, height, radius) {
    const right = left + width;
    const bottom = top + height;
    if (x < left || x > right || y < top || y > bottom) return false;
    if (x > left + radius && x < right - radius) return true;
    if (y > top + radius && y < bottom - radius) return true;
    const corners = [
        [left + radius, top + radius],
        [right - radius, top + radius],
        [left + radius, bottom - radius],
        [right - radius, bottom - radius]
    ];
    return corners.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius);
}

function fillRoundedRect(canvas, left, top, width, height, radius, color) {
    for (let y = Math.floor(top); y < Math.ceil(top + height); y += 1) {
        for (let x = Math.floor(left); x < Math.ceil(left + width); x += 1) {
            if (roundedRectContains(x + 0.5, y + 0.5, left, top, width, height, radius)) {
                blendPixel(canvas, x, y, color);
            }
        }
    }
}

function lineDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function strokePath(canvas, points, width, color) {
    const segments = points.slice(1).map((point, index) => [points[index], point]);
    const all = segments.flatMap(([a, b]) => [a, b]);
    const minX = Math.max(0, Math.floor(Math.min(...all.map((point) => point[0])) - width));
    const maxX = Math.min(canvas.size, Math.ceil(Math.max(...all.map((point) => point[0])) + width));
    const minY = Math.max(0, Math.floor(Math.min(...all.map((point) => point[1])) - width));
    const maxY = Math.min(canvas.size, Math.ceil(Math.max(...all.map((point) => point[1])) + width));
    for (let y = minY; y < maxY; y += 1) {
        for (let x = minX; x < maxX; x += 1) {
            let distance = Infinity;
            for (const [a, b] of segments) {
                distance = Math.min(distance, lineDistance(x + 0.5, y + 0.5, a[0], a[1], b[0], b[1]));
            }
            const coverage = Math.max(0, Math.min(1, width / 2 + 0.5 - distance));
            if (coverage > 0) {
                blendPixel(canvas, x, y, [color[0], color[1], color[2], color[3] * coverage]);
            }
        }
    }
}

let crcTable;
function crc32(buffer) {
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n += 1) {
            let c = n;
            for (let k = 0; k < 8; k += 1) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }
            crcTable[n] = c >>> 0;
        }
    }
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    const typeBuffer = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, body])));
    return Buffer.concat([length, typeBuffer, body, crc]);
}

function encodePng(canvas) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(canvas.size, 0);
    header.writeUInt32BE(canvas.size, 4);
    header[8] = 8;
    header[9] = 6;
    const stride = canvas.size * 4 + 1;
    const raw = Buffer.alloc(stride * canvas.size);
    for (let y = 0; y < canvas.size; y += 1) {
        Buffer.from(canvas.data.buffer, y * canvas.size * 4, canvas.size * 4).copy(raw, y * stride + 1);
    }
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return Buffer.concat([
        signature,
        chunk("IHDR", header),
        chunk("IDAT", deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0))
    ]);
}

function drawAppIcon(size) {
    const canvas = createCanvas(size);
    const scale = size / 256;
    fillRoundedRect(canvas, 8 * scale, 8 * scale, 240 * scale, 240 * scale, 54 * scale, rgba("#974FD0"));
    fillRoundedRect(canvas, 8 * scale, 8 * scale, 240 * scale, 96 * scale, 54 * scale, rgba("#AE6BE0", 0.4));
    fillRoundedRect(canvas, 60 * scale, 72 * scale, 148 * scale, 132 * scale, 18 * scale, rgba("#7D3FB1", 0.35));
    fillRoundedRect(canvas, 48 * scale, 54 * scale, 148 * scale, 132 * scale, 18 * scale, rgba("#FFFFFF"));
    fillRoundedRect(canvas, 48 * scale, 54 * scale, 98 * scale, 96 * scale, 16 * scale, rgba("#FFFFFF"));
    const ink = rgba("#B9A6D6");
    for (let index = 0; index < 3; index += 1) {
        fillRoundedRect(
            canvas,
            70 * scale,
            (106 + index * 26) * scale,
            (index === 2 ? 58 : 96) * scale,
            8 * scale,
            4 * scale,
            ink
        );
    }
    return canvas;
}

const avatarPalettes = {
    "nick-woods": { background: "#DEDEDE", backdrop: "#F2F2F2", skin: "#E9D5C7", hair: "#2E2C2A", shirt: "#3D3B39" },
    "maya-hayes": { background: "#9D85B4", backdrop: "#B39FCB", skin: "#E6C1A4", hair: "#381A1B", shirt: "#F4E7DA" },
    "cassie-melendez": { background: "#90C78D", backdrop: "#A7D5A4", skin: "#D9A77E", hair: "#4A2A1C", shirt: "#2F5D4A" },
    "ronny-schultz": { background: "#F8AEAB", backdrop: "#FCC2BF", skin: "#EAC3A1", hair: "#6B4A2F", shirt: "#7C93B8" },
    "amanda-finnegan": { background: "#EFEFEF", backdrop: "#F7F7F7", skin: "#E8CDBD", hair: "#1F1D1C", shirt: "#22201F" },
    "rob-houghton": { background: "#F9CA9C", backdrop: "#FBD9B4", skin: "#C98F63", hair: "#231A14", shirt: "#3A5169" }
};

const avatarVariants = {
    "nick-woods": "short",
    "maya-hayes": "long",
    "cassie-melendez": "bun",
    "ronny-schultz": "short",
    "amanda-finnegan": "photo",
    "rob-houghton": "short"
};

function drawAvatar(size, palette, variant) {
    const canvas = createCanvas(size);
    const scale = size / 256;
    const backdropTop = hexToRgb(palette.backdrop);
    const backdropBottom = hexToRgb(palette.background);
    fillEllipse(canvas, size / 2, size / 2, size / 2, size / 2, (_x, y) => {
        const color = mix(backdropTop, backdropBottom, y / size);
        return [...color, 255];
    });

    const skin = hexToRgb(palette.skin);
    const skinShadow = mix(skin, [90, 50, 40], 0.22);
    const hair = hexToRgb(palette.hair);
    const hairLight = mix(hair, [255, 255, 255], 0.18);
    const shirt = hexToRgb(palette.shirt);

    fillEllipse(canvas, 128 * scale, 268 * scale, 118 * scale, 104 * scale, () => [...shirt, 255]);
    fillEllipse(canvas, 128 * scale, 258 * scale, 40 * scale, 34 * scale, () => [...mix(skin, shirt, 0.25), 255]);
    fillEllipse(canvas, 132 * scale, 150 * scale, 18 * scale, 24 * scale, () => [...skinShadow, 255]);
    fillEllipse(canvas, 126 * scale, 126 * scale, 50 * scale, 60 * scale, (x) => {
        const shade = 1 - Math.max(0, (x - 126 * scale) / (size * 0.9));
        return [...mix(mix(skin, skinShadow, 0.35 * (1 - shade)), skin, shade * 0.6), 255];
    });

    if (variant === "photo" || variant === "bun") {
        fillEllipse(canvas, 126 * scale, 74 * scale, 48 * scale * (variant === "bun" ? 0.8 : 1), 30 * scale, () => [
            ...hair,
            255
        ]);
        if (variant === "bun") {
            fillEllipse(canvas, 176 * scale, 56 * scale, 20 * scale, 20 * scale, () => [...hair, 255]);
        }
        fillEllipse(canvas, 126 * scale, 100 * scale, 56 * scale, 44 * scale, (_x, y) => [
            ...(y < 92 * scale ? hairLight : hair),
            255
        ]);
        fillEllipse(canvas, 78 * scale, 136 * scale, 16 * scale, 34 * scale, () => [...hair, 255]);
        fillEllipse(canvas, 174 * scale, 136 * scale, 16 * scale, 34 * scale, () => [...hair, 255]);
    } else if (variant === "short") {
        fillEllipse(canvas, 126 * scale, 92 * scale, 54 * scale, 40 * scale, (_x, y) => [
            ...(y < 84 * scale ? hairLight : hair),
            255
        ]);
    } else {
        fillEllipse(canvas, 126 * scale, 84 * scale, 56 * scale, 44 * scale, () => [...hair, 255]);
        fillEllipse(canvas, 70 * scale, 160 * scale, 18 * scale, 52 * scale, () => [...hair, 255]);
        fillEllipse(canvas, 182 * scale, 160 * scale, 18 * scale, 52 * scale, () => [...hair, 255]);
    }

    const eye = mix(hair, [20, 20, 20], 0.5);
    fillEllipse(canvas, 108 * scale, 128 * scale, 5 * scale, 6 * scale, () => [...eye, 255]);
    fillEllipse(canvas, 146 * scale, 128 * scale, 5 * scale, 6 * scale, () => [...eye, 255]);
    strokePath(
        canvas,
        [
            [118 * scale, 158 * scale],
            [128 * scale, 164 * scale],
            [140 * scale, 157 * scale]
        ],
        Math.max(1.2, 3 * scale),
        [...mix(skin, [120, 60, 50], 0.55), 220]
    );

    return canvas;
}

function icoFromPngs(entries) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(entries.length, 4);
    const directory = Buffer.alloc(16 * entries.length);
    let offset = 6 + directory.length;
    entries.forEach(({ size, png }, index) => {
        const entry = index * 16;
        directory[entry] = size >= 256 ? 0 : size;
        directory[entry + 1] = size >= 256 ? 0 : size;
        directory.writeUInt16LE(1, entry + 4);
        directory.writeUInt16LE(32, entry + 6);
        directory.writeUInt32LE(png.length, entry + 8);
        directory.writeUInt32LE(offset, entry + 12);
        offset += png.length;
    });
    return Buffer.concat([header, directory, ...entries.map((entry) => entry.png)]);
}

async function main() {
    await mkdir(join(assetsDir, "avatars"), { recursive: true });

    const iconEntries = ICON_SIZES.map((size) => ({ size, png: encodePng(drawAppIcon(size)) }));
    await writeFile(join(assetsDir, "icon.png"), iconEntries[iconEntries.length - 1].png);
    await writeFile(join(assetsDir, "icon.ico"), icoFromPngs(iconEntries));

    for (const [name, palette] of Object.entries(avatarPalettes)) {
        const avatar = drawAvatar(128, palette, avatarVariants[name]);
        await writeFile(join(assetsDir, "avatars", `${name}.png`), encodePng(avatar));
    }

    console.log("assets written to", assetsDir);
}

await main();
