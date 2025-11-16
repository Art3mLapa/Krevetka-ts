import fs from "fs";
import { createHash } from "crypto";
import path from "path";
import { logger } from "./logger";

export function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) return resolve("");
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

export function safeReadFile(filePath: string): Buffer | null {
  if (!fs.existsSync(filePath)) {
    logger.error(`File not found: ${filePath}`);
    return null;
  }
  try {
    return fs.readFileSync(filePath);
  } catch (e) {
    logger.error(`Failed to read file: ${filePath}`, e);
    return null;
  }
}

export function safeWriteFile(filePath: string, data: string | Buffer): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data);
    logger.debug(`File written: ${filePath}`);
  } catch (e) {
    logger.error(`Failed to write file: ${filePath}`, e);
  }
}

export function safeRemove(filePath: string): void {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      logger.warn(`Failed to remove ${filePath}:`, e);
    }
  }
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}