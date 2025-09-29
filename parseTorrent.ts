import * as fs from 'fs';
import * as zlib from 'zlib';
import * as path from 'path';

console.log('[DEBUG] Starting TypeScript script for decompressing and parsing torrent data.');

const projectDir = process.cwd();
const torrentDataDir = path.join(projectDir, 'torrent_data');
const inputFilePath = path.join(torrentDataDir, 'torrentData');
const outputBinPath = path.join(projectDir, 'torrentData.bin');
const outputJsonPath = path.join(projectDir, 'stalcraft_data.json');

export async function parseTorrentData(shouldParse: boolean, forceUpdate: boolean = false) {

    console.log(`[DEBUG] Checking for input file at: ${inputFilePath}`);
    if (!fs.existsSync(inputFilePath)) {
        console.error('[ERROR] Input file "torrentData" not found in "torrent_data" directory.');
        process.exit(1);
    }

    if (!shouldParse && !forceUpdate) {
        console.log('[DEBUG] No new torrentData or force update detected, skipping parse.');
        return;
    }

    console.log('[DEBUG] Reading input file and skipping first 4 bytes.');
    const rawData = fs.readFileSync(inputFilePath);
    const compressedData = rawData.slice(4);

    console.log('[DEBUG] Attempting to decompress gzip data.');
    let buffer: Buffer;
    try {
        buffer = zlib.gunzipSync(compressedData);
        console.log('[DEBUG] Decompression successful.');

        fs.writeFileSync(outputBinPath, buffer);
        console.log(`[DEBUG] Decompressed data saved to: ${outputBinPath}`);
    } catch (error) {
        console.error('[ERROR] Failed to decompress: Invalid or truncated gzip data.', error);
        process.exit(1);
    }

    console.log('[DEBUG] Starting binary parsing.');
    let pos = 0;

    const readUInt64BE = (): bigint => {
        const value = buffer.readBigUInt64BE(pos);
        pos += 8;
        return value;
    };

    const readInt64BE = (): bigint => {
        const value = buffer.readBigInt64BE(pos);
        pos += 8;
        return value;
    };

    const readUInt32BE = (): number => {
        const value = buffer.readUInt32BE(pos);
        pos += 4;
        return value;
    };

    const readUInt16BE = (): number => {
        const value = buffer.readUInt16BE(pos);
        pos += 2;
        return value;
    };

    const readString = (): string => {
        const size = readUInt16BE();
        if (size > 0) {
            const str = buffer.slice(pos, pos + size).toString('utf8');
            pos += size;
            return str;
        }
        return '';
    };

    const readSha1 = (): Buffer => {
        const sha = buffer.slice(pos, pos + 20);
        pos += 20;
        return sha;
    };

    console.log('[DEBUG] Parsing TorrentMeta structure.');
    const totalFilesSize = readUInt64BE();
    console.log(`[DEBUG] Total Files Size: ${totalFilesSize}`);

    const comment = readString();
    console.log(`[DEBUG] Comment: ${comment}`);

    const trackerCount = readUInt32BE();
    console.log(`[DEBUG] Tracker Count: ${trackerCount}`);

    const trackers: string[] = [];
    for (let i = 0; i < trackerCount; i++) {
        const tracker = readString();
        trackers.push(tracker);
        console.log(`[DEBUG] Tracker ${i + 1}: ${tracker}`);
    }

    const reserved = readString();
    console.log(`[DEBUG] Reserved: ${reserved}`);

    const pieceLength = readUInt32BE();
    console.log(`[DEBUG] Piece Length: ${pieceLength}`);

    const name = readString();
    console.log(`[DEBUG] Torrent Name: ${name}`);

    const fileCount = readUInt32BE();
    console.log(`[DEBUG] File Count: ${fileCount}`);

    const files: { path: string; size: bigint; sha1: Buffer }[] = [];
    for (let i = 0; i < fileCount; i++) {
        const filePath = readString();
        const fileSize = readInt64BE();
        const fileSha1 = readSha1();
        files.push({ path: filePath, size: fileSize, sha1: fileSha1 });
        const hashHex = fileSha1.toString('hex');
        console.log(`[DEBUG] File ${i + 1}: Path="${filePath}", Size=${fileSize}, Hash=${hashHex}`);
    }

    const hashCount = readUInt32BE();
    console.log(`[DEBUG] Piece Hash Count: ${hashCount}`);

    console.log('[DEBUG] Building JSON hierarchy from file paths.');
    const root: Record<string, any> = {};

    files.forEach((file) => {
        const parts = file.path.split('/');
        let current = root;
        for (let i = 0; i < parts.length - 1; i++) {
            const dir = parts[i];
            if (!current[dir]) {
                current[dir] = {};
            }
            current = current[dir];
        }
        const fileName = parts[parts.length - 1];
        const hashHex = file.sha1.toString('hex');
        const fileUrl = `${reserved}${name}/${hashHex}`; // Construct URL using reserved + name + hash
        current[fileName] = {
            'File Size': file.size.toString(),
            'File Hash': hashHex,
            'File URL': fileUrl,
        };
        console.log(`[DEBUG] Added file to JSON: ${file.path} (URL: ${fileUrl})`);
    });

    console.log('[DEBUG] Saving JSON structure.');
    fs.writeFileSync(outputJsonPath, JSON.stringify(root, null, 2));
    console.log(`[DEBUG] JSON saved to: ${outputJsonPath}`);

    console.log('[DEBUG] Script execution complete.');
}
