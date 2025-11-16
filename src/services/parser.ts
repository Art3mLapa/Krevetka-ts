import child_process from "child_process";
import { logger } from "../utils/logger";

export function runParser(): void {
  try {
    child_process.execSync("node parseTorrent.js", { stdio: "inherit" });
    logger.debug("Parser executed successfully");
  } catch (error) {
    logger.error("Parser failed:", error);
    throw error;
  }
}