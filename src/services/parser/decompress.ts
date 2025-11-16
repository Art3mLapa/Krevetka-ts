import zlib from "zlib";
import fs from "fs";
import { logger } from "../../utils/logger";
import { safeWriteFile } from "../../utils/file";

export function decompressGzip(inputPath: string, outputPath: string): Buffer | null {
  try {
    const data = fs.readFileSync(inputPath);
    const compressed = data.slice(4);

    const buffer = zlib.gunzipSync(compressed);
    safeWriteFile(outputPath, buffer);
    logger.debug(`Decompressed to: ${outputPath}`);
    return buffer;
  } catch (error) {
    logger.error("Failed to decompress gzip data", error);
    return null;
  }
}