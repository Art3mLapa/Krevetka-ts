import fs from "fs";
import { logger } from "./logger";
import { FileMap, FileInfo } from "../types";

export function extractFiles(obj: any, currentPath = "", files: FileMap = {}): FileMap {
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    if ("File Size" in obj && "File Hash" in obj && "File URL" in obj) {
      files[currentPath] = obj as FileInfo;
    } else {
      for (const key in obj) {
        const newPath = currentPath ? `${currentPath}/${key}` : key;
        extractFiles(obj[key], newPath, files);
      }
    }
  }
  return files;
}

export function loadJson<T = any>(path: string): T | null {
  if (!fs.existsSync(path)) return null;
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (e) {
    logger.error(`Failed to parse JSON: ${path}`, e);
    return null;
  }
}