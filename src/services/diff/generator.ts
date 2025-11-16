import fs from "fs";
import { PATHS } from "../../config";
import { loadJson, extractFiles } from "../../utils/json"; 
import { logger } from "../../utils/logger";
import { FileMap, DetailedChange, DiffEntry } from "../../types";

function compareMaps(oldMap: FileMap, newMap: FileMap) {
}

export function generateDiff(): void {
  const oldJson = loadJson(PATHS.oldJson);
  const newJson = loadJson(PATHS.jsonFile);

  if (!oldJson || !newJson) {
    logger.debug("Skipping diff: missing old or new JSON");
    return;
  }

  const oldMap = extractFiles(oldJson);
  const newMap = extractFiles(newJson);
  const { added, removed, changed } = compareMaps(oldMap, newMap);

  const simpleLines = [
    ...added.map(p => `+ ${p}`),
    ...changed.map(c => `~ ${c.path}`),
    ...removed.map(p => `- ${p}`),
  ].sort();
  fs.writeFileSync(PATHS.diffFile, simpleLines.join("\n"));

  const full: DiffEntry[] = [
    ...added.map(p => ({ path: p, change: "+", new: newMap[p] })),
    ...changed.map(c => ({ path: c.path, change: "~", diffs: c.diffs })),
    ...removed.map(p => ({ path: p, change: "-", old: oldMap[p] })),
  ];
  fs.writeFileSync(PATHS.diffFullFile, JSON.stringify(full, null, 2));

  logger.debug("Diff generated");
}