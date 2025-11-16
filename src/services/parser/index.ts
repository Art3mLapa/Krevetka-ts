import path from "path";
import { CONFIG, PATHS } from "../../config";
import { logger } from "../../utils/logger";
import { safeReadFile } from "../../utils/file";
import { decompressGzip } from "./decompress";
import { parseBinary } from "./parseBinary";
import { buildJsonHierarchy } from "./buildJson";

const BIN_PATH = path.join(CONFIG.projectDir, "torrentData.bin");

export async function parseTorrentData(shouldParse: boolean, forceUpdate = false): Promise<void> {
  if (!shouldParse && !forceUpdate) {
    logger.debug("Skipping parse: no update");
    return;
  }

  const input = safeReadFile(PATHS.torrentFile);
  if (!input) return;

  const decompressed = decompressGzip(PATHS.torrentFile, BIN_PATH);
  if (!decompressed) return;

  const meta = parseBinary(decompressed);
  if (!meta) return;

  buildJsonHierarchy(meta, PATHS.jsonFile);
  logger.debug(`Parsed ${meta.files.length} files → ${PATHS.jsonFile}`);
}