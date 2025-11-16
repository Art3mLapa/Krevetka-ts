import { updateTorrentFile } from "./download";
import { parseTorrentData } from "./parser/index";
import { generateDiff } from "./diff/generator";
import { getFileHash, safeRemove } from "../utils/file";
import { PATHS } from "../config";
import { logger } from "../utils/logger";
import { CONFIG } from "../config";

let lastTorrentHash: string | null = null;

export async function startMonitoring(): Promise<void> {
  const check = async () => {
    try {
      const updated = await updateTorrentFile();

      const currentHash = updated ? await getFileHash(PATHS.torrentFile) : null;

      const shouldParse = updated || !lastTorrentHash;

      if (shouldParse) {
        await parseTorrentData(true);
        generateDiff();
        lastTorrentHash = currentHash || lastTorrentHash;
      }
    } catch (error) {
      logger.error("Update cycle failed:", error);
    } finally {
      safeRemove(PATHS.oldTorrent);
      safeRemove(PATHS.oldJson);
    }
  };

  await check();
  setInterval(check, CONFIG.checkIntervalMs);
}