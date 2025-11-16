import { TorrentMeta } from "./types";

export function parseBinary(buffer: Buffer): TorrentMeta | null {
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
    if (size === 0) return "";
    const str = buffer.slice(pos, pos + size).toString("utf8");
    pos += size;
    return str;
  };

  const readSha1 = (): Buffer => {
    const sha = buffer.slice(pos, pos + 20);
    pos += 20;
    return sha;
  };

  try {
    const totalFilesSize = readUInt64BE();
    const comment = readString();
    const trackerCount = readUInt32BE();
    const trackers: string[] = [];
    for (let i = 0; i < trackerCount; i++) trackers.push(readString());
    const reserved = readString();
    const pieceLength = readUInt32BE();
    const name = readString();
    const fileCount = readUInt32BE();
    const files: TorrentMeta["files"] = [];

    for (let i = 0; i < fileCount; i++) {
      const filePath = readString();
      const fileSize = readInt64BE();
      const fileSha1 = readSha1();
      files.push({ path: filePath, size: fileSize, sha1: fileSha1 });
    }

    const hashCount = readUInt32BE();

    return {
      totalFilesSize,
      comment,
      trackers,
      reserved,
      pieceLength,
      name,
      files,
      hashCount,
    };
  } catch (error) {
    console.error("Binary parsing failed:", error);
    return null;
  }
}