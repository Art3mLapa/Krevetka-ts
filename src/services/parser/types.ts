export interface TorrentFile {
  path: string;
  size: bigint;
  sha1: Buffer;
}

export interface TorrentMeta {
  totalFilesSize: bigint;
  comment: string;
  trackers: string[];
  reserved: string;
  pieceLength: number;
  name: string;
  files: TorrentFile[];
  hashCount: number;
}

export interface ParsedFileInfo {
  "File Size": string;
  "File Hash": string;
  "File URL": string;
}