import axios from "axios";
import fs from "fs";
import { PATHS, CONFIG } from "../config";
import { getFileHash, ensureDir, safeRemove } from "../utils/file";
import { logger } from "../utils/logger";
import { getAuthToken } from "./auth";

export async function downloadTorrent(token: string): Promise<Buffer> {
  const url = `${CONFIG.downloadBaseUrl}?id=stalcraft&token=${token}&login=`;
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 30_000 });
  return Buffer.from(res.data);
}

export async function getRemoteSize(token: string): Promise<number> {
  const url = `${CONFIG.downloadBaseUrl}?id=stalcraft&token=${token}&login=`;
  const head = await axios.head(url);
  return parseInt(head.headers["content-length"] ?? "0", 10);
}

export async function updateTorrentFile(): Promise<boolean> {
  const token = await getAuthToken();
  const remoteSize = await getRemoteSize(token);
  const localSize = fs.existsSync(PATHS.torrentFile) ? fs.statSync(PATHS.torrentFile).size : 0;

  if (localSize === remoteSize && localSize > 0) {
    logger.debug("No update needed (size match)");
    return false;
  }

  const buffer = await downloadTorrent(token);
  ensureDir(PATHS.torrentDataDir);
  fs.writeFileSync(PATHS.tempTorrent, buffer);

  const localHash = await getFileHash(PATHS.torrentFile);
  const tempHash = await getFileHash(PATHS.tempTorrent);

  if (localHash === tempHash) {
    safeRemove(PATHS.tempTorrent);
    return false;
  }

  if (fs.existsSync(PATHS.torrentFile)) fs.renameSync(PATHS.torrentFile, PATHS.oldTorrent);
  if (fs.existsSync(PATHS.jsonFile)) fs.renameSync(PATHS.jsonFile, PATHS.oldJson);

  fs.renameSync(PATHS.tempTorrent, PATHS.torrentFile);
  return true;
}