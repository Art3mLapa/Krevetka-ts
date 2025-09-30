import fs from "fs";
import path from "path";
import child_process from "child_process";
import axios from "axios";
import express from "express";
import crypto from "crypto";

interface AuthResponse {
    token: string;
}

type DownloadResponse = ArrayBuffer;

console.log("[DEBUG] Starting TypeScript monitor and server script.");

// путин
const projectDir = process.cwd();
const torrentDataDir = path.join(projectDir, "torrent_data");
const torrentFilePath = path.join(torrentDataDir, "torrentData");
const jsonFilePath = path.join(projectDir, "stalcraft_data.json");
const diffFilePath = path.join(projectDir, "diff.txt");

interface TreeNode {
    name: string;
    children: TreeNode[];
    mark?: "+" | "~" | "-";
    isFile?: boolean;
}

// Получение хеш суммы торрент даты
function getFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) return resolve("");
        const hash = crypto.createHash("sha256");
        const stream = fs.createReadStream(filePath);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
    });
}

// получение всех путей файлов с информацией
function getFiles(
    obj: any,
    currentPath: string = "",
    files: Record<string, any> = {}
): Record<string, any> {
    if (typeof obj === "object" && obj !== null) {
        if ("File Size" in obj && "File Hash" in obj && "File URL" in obj) {
            files[currentPath] = obj;
        } else {
            for (const key in obj) {
                const newPath = currentPath ? `${currentPath}/${key}` : key;
                getFiles(obj[key], newPath, files);
            }
        }
    }
    return files;
}

// сравнениие изменений в двух структурах JSON
function compareJsons(
    oldJson: any,
    newJson: any
): { added: string[]; changed: string[]; removed: string[] } {
    const oldFiles = getFiles(oldJson);
    const newFiles = getFiles(newJson);

    const oldPaths = new Set(Object.keys(oldFiles));
    const newPaths = new Set(Object.keys(newFiles));

    const added: string[] = [];
    const changed: string[] = [];
    const removed: string[] = [];

    Array.from(newPaths).forEach(p => {
        if (!oldPaths.has(p)) {
            added.push(p);
        } else if (
            JSON.stringify(newFiles[p]) !== JSON.stringify(oldFiles[p])
        ) {
            changed.push(p);
        }
    });

    Array.from(oldPaths).forEach(p => {
        if (!newPaths.has(p)) {
            removed.push(p);
        }
    });

    return { added, changed, removed };
}

// Функция добавления ветки изменённых файлов в JSON формате
function buildDiffJson(
    diffLines: string[]
): { path: string; change: "+" | "~" | "-" }[] {
    const result: { path: string; change: "+" | "~" | "-" }[] = [];
    diffLines.forEach(line => {
        const mark = line[0] as "+" | "~" | "-";
        const pathStr = line.slice(2).trim();
        result.push({ path: pathStr, change: mark });
    });
    return result;
}

// Мониторинг обновлений
async function monitor() {
    console.log("[DEBUG] Starting monitor loop.");

    const authUrl = "";

    let token: string;
    try {
        const authRes = await axios.get<AuthResponse>(authUrl);
        token = authRes.data.token;
        console.log("[DEBUG] Obtained token:", token);
    } catch (error) {
        console.error("[ERROR] Failed to obtain token:", error);
        return;
    }

    const downloadUrl = `http://launcher.stalcraft.net/torrentData?id=stalcraft&token=${token}&login=`;

    let currentDiff: { added: string[]; changed: string[]; removed: string[] };

    async function checkAndUpdate() {
        console.log("[DEBUG] Checking for updates.");

        let remoteSize: number;
        try {
            const headRes = await axios.head(downloadUrl);
            remoteSize = parseInt(headRes.headers["content-length"] || "0", 10);
            console.log("[DEBUG] Remote file size:", remoteSize);
        } catch (error) {
            console.error("[ERROR] Failed to get remote size:", error);
            return;
        }

        const localSize = fs.existsSync(torrentFilePath)
            ? fs.statSync(torrentFilePath).size
            : 0;
        console.log("[DEBUG] Local file size:", localSize);

        if (localSize === 0 || localSize !== remoteSize) {
            const tempTorrentPath = path.join(
                torrentDataDir,
                "new_torrentData"
            );
            try {
                const dlRes = await axios.get<DownloadResponse>(downloadUrl, {
                    responseType: "arraybuffer",
                });
                fs.mkdirSync(torrentDataDir, { recursive: true });
                fs.writeFileSync(tempTorrentPath, Buffer.from(dlRes.data));
                console.log("[DEBUG] Downloaded new torrentData to temp.");
            } catch (error) {
                console.error("[ERROR] Download failed:", error);
                return;
            }

            const [localHash, tempHash] = await Promise.all([
                getFileHash(torrentFilePath),
                getFileHash(tempTorrentPath),
            ]);
            console.log("[DEBUG] Local hash:", localHash);
            console.log("[DEBUG] Temp hash:", tempHash);

            if (localSize === 0 || localHash !== tempHash) {
                // бекап старых файлов
                const oldTorrentPath = path.join(
                    torrentDataDir,
                    "old_torrentData"
                );
                const oldJsonPath = path.join(
                    projectDir,
                    "old_stalcraft_data.json"
                );
                if (fs.existsSync(torrentFilePath))
                    fs.renameSync(torrentFilePath, oldTorrentPath);
                if (fs.existsSync(jsonFilePath))
                    fs.renameSync(jsonFilePath, oldJsonPath);

                // перемещение нового торрент даты и запуск парсера
                fs.renameSync(tempTorrentPath, torrentFilePath);
                child_process.execSync("node parseTorrent.js", {
                    stdio: "inherit",
                });
                console.log(
                    "[DEBUG] Parsed new torrentData to stalcraft_data.json."
                );

                // сравнениие двух JSON файлов
                if (fs.existsSync(oldJsonPath)) {
                    const oldJson = JSON.parse(
                        fs.readFileSync(oldJsonPath, "utf8")
                    );
                    const newJson = JSON.parse(
                        fs.readFileSync(jsonFilePath, "utf8")
                    );
                    currentDiff = compareJsons(oldJson, newJson);

                    // Генерация дифф файла
                    const diffLines = [
                        ...currentDiff.added.map(p => `+ ${p}`),
                        ...currentDiff.changed.map(p => `~ ${p}`),
                        ...currentDiff.removed.map(p => `- ${p}`),
                    ].sort();
                    fs.writeFileSync(diffFilePath, diffLines.join("\n"));
                    console.log("[DEBUG] Generated diff.txt.");
                }

                // Чистка старых файлов
                if (fs.existsSync(oldTorrentPath))
                    fs.unlinkSync(oldTorrentPath);
                if (fs.existsSync(oldJsonPath)) fs.unlinkSync(oldJsonPath);
            } else {
                console.log("[DEBUG] Hashes match, no update needed.");
                fs.unlinkSync(tempTorrentPath);
            }
        } else {
            console.log("[DEBUG] Sizes match, no update needed.");
        }

        if (!fs.existsSync(jsonFilePath) && fs.existsSync(torrentFilePath)) {
            console.log("[DEBUG] stalcraft_data.json missing, running parser.");
            child_process.execSync("node parseTorrent.js", {
                stdio: "inherit",
            });
        }
    }

    await checkAndUpdate();

    // Интервал проверок в мс (20 секунд)
    setInterval(async () => {
        await checkAndUpdate();
    }, 20000);
}

// Запуск сервера
const app = express();

app.get("/krevetka", (req, res) => {
    console.log("[DEBUG] Serving /krevetka");
    res.setHeader("Content-Type", "application/json");
    if (fs.existsSync(diffFilePath)) {
        const diffLines = fs
            .readFileSync(diffFilePath, "utf8")
            .split("\n")
            .filter(line => line.trim());
        if (diffLines.length > 0) {
            const diffJson = buildDiffJson(diffLines);
            res.json(diffJson);
        } else {
            res.json([]);
        }
    } else {
        res.json([]);
    }
});

app.get("/explore", (req, res) => {
    console.log("[DEBUG] Serving /explore");
    res.setHeader("Content-Type", "application/json");
    const oldJsonPath = path.join(projectDir, "old_stalcraft_data.json");
    if (fs.existsSync(oldJsonPath)) {
        const jsonData = JSON.parse(fs.readFileSync(oldJsonPath, "utf8"));
        res.json(jsonData);
    } else {
        res.json({});
    }
});

app.listen(1488, () => {
    console.log("[DEBUG] Server started on http://localhost:1488");
    monitor();
});
