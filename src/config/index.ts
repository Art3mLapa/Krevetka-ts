export const CONFIG = {
  projectDir: process.cwd(),
  port: 1488,
  checkIntervalMs: 20_000,
  authUrl: process.env.AUTH_URL || "", // https://launcher.stalcraft.net/auth?state=true&login=....
  downloadBaseUrl: "http://launcher.stalcraft.net/torrentData",
} as const;

export const PATHS = {
  torrentDataDir: `${CONFIG.projectDir}/torrent_data`,
  torrentFile: `${CONFIG.projectDir}/torrent_data/torrentData`,
  jsonFile: `${CONFIG.projectDir}/stalcraft_data.json`,
  diffFile: `${CONFIG.projectDir}/diff.txt`,
  diffFullFile: `${CONFIG.projectDir}/diff_full.json`,
  oldTorrent: `${CONFIG.projectDir}/torrent_data/old_torrentData`,
  oldJson: `${CONFIG.projectDir}/old_stalcraft_data.json`,
  tempTorrent: `${CONFIG.projectDir}/torrent_data/new_torrentData`,
} as const;