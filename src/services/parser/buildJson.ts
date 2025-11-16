import { TorrentMeta } from "./types";
import { ParsedFileInfo } from "./types";
import { safeWriteFile } from "../../utils/file";
import path from "path";

export function buildJsonHierarchy(meta: TorrentMeta, outputPath: string): void {
  const root: Record<string, any> = {};

  meta.files.forEach((file) => {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!current[dir]) current[dir] = {};
      current = current[dir];
    }

    const fileName = parts[parts.length - 1];
    const hashHex = file.sha1.toString("hex");
    const fileUrl = `${meta.reserved}${meta.name}/${hashHex}`;

    current[fileName] = {
      "File Size": file.size.toString(),
      "File Hash": hashHex,
      "File URL": fileUrl,
    } as ParsedFileInfo;
  });

  safeWriteFile(outputPath, JSON.stringify(root, null, 2));
}