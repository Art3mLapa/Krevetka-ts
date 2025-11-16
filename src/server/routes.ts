import express from "express";
import fs from "fs";
import { PATHS, CONFIG } from "../config";
import { logger } from "../utils/logger";

const app = express();

app.get("/krevetka", (req, res) => {
  logger.debug("GET /krevetka");

  if (fs.existsSync(PATHS.diffFullFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(PATHS.diffFullFile, "utf8"));
      return res.json(data);
    } catch (e) {
      logger.error("Failed to read diff_full.json", e);
    }
  }

  if (fs.existsSync(PATHS.diffFile)) {
    const lines = fs.readFileSync(PATHS.diffFile, "utf8")
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);

    const result = lines.map(line => ({
      change: line[0] as "+" | "~" | "-",
      path: line.slice(2).trim(),
    }));
    return res.json(result);
  }

  res.json([]);
});

app.get("/explore", (req, res) => {
  logger.debug("GET /explore");

  const currentPath = PATHS.jsonFile;

  if (fs.existsSync(currentPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(currentPath, "utf8"));
      return res.json(data);
    } catch (e) {
      logger.error("Failed to parse stalcraft_data.json", e);
      return res.status(500).json({ error: "Invalid JSON" });
    }
  }

  logger.warn("stalcraft_data.json not found");
  res.json({});
});

export function startServer(): void {
  app.listen(CONFIG.port, () => {
    logger.debug(`Server running on http://localhost:${CONFIG.port}`);
  });
}