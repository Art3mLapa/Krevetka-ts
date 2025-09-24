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

// Функция добавления ветки изменённых файлов в дифф формате
function addToTree(
    root: TreeNode,
    filePath: string,
    mark: "+" | "~" | "-"
): void {
    const parts = filePath.split("/").filter(part => part.length > 0);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        let childMap = new Map(current.children.map(c => [c.name, c]));
        let child = childMap.get(part);
        if (!child) {
            child = { name: part, children: [] };
            current.children.push(child);
        }
        current = child;
        if (i === parts.length - 1) {
            current.mark = mark;
            current.isFile = true;
        }
    }
}

// функция рендера дифф файлов в HTML
function renderDiffTree(node: TreeNode, id: number = 0): string {
    let html = "";
    const color =
        node.mark === "+"
            ? "#a0d468"
            : node.mark === "~"
            ? "#ffd700"
            : node.mark === "-"
            ? "#ff6b6b"
            : "#c5c5c5";
    const markStr = node.mark ? `${node.mark} ` : "";
    const hasChildren = node.children.length > 0;
    if (node.isFile) {
        html += `<div class="file ${
            node.mark ? node.mark : ""
        }">${markStr}<span style="color: ${color};">${node.name}</span></div>`;
    } else {
        html += `<details class="directory" open>`;
        html += `<summary class="name"><span style="color: ${color};">${node.name}</span></summary>`;
        html += `<div class="path">/${node.name}</div>`;
        node.children.sort((a, b) => a.name.localeCompare(b.name));
        node.children.forEach((child, index) => {
            html += renderDiffTree(child, id * 10 + index + 1);
        });
        html += `</details>`;
    }
    return html;
}

// функция рендера иерархии файлов игры
function renderFullTree(
    obj: any,
    currentPath: string = "",
    id: number = 0
): string {
    let html = "";
    if ("File Size" in obj && "File Hash" in obj && "File URL" in obj) {
        // файл
        const fileName = path.basename(currentPath);
        const size = obj["File Size"];
        const hash = obj["File Hash"];
        const url = obj["File URL"];
        html += `<div class="file"><a href="${url}" style="color: #8a9cff; text-decoration: underline;">${fileName}</a> <span style="opacity: 0.5;">(${size}, ${hash})</span></div>`;
    } else {
        // папка
        const keys = Object.keys(obj).sort();
        if (keys.length > 0) {
            if (currentPath === "/") {
                keys.forEach((key, index) => {
                    const newPath = key;
                    html += renderFullTree(
                        obj[key],
                        newPath,
                        id * 10 + index + 1
                    );
                });
            } else {
                html += `<details class="directory">`;
                html += `<summary class="name">${
                    path.basename(currentPath) || "/"
                }</summary>`;
                html += `<div class="path">/${currentPath.replace(
                    /^\/+/,
                    ""
                )}</div>`;
                keys.forEach((key, index) => {
                    const newPath = currentPath ? `${currentPath}/${key}` : key;
                    html += renderFullTree(
                        obj[key],
                        newPath,
                        id * 10 + index + 1
                    );
                });
                html += `</details>`;
            }
        }
    }
    return html;
}

// Мониторинг обновлений
async function monitor() {
    console.log("[DEBUG] Starting monitor loop.");

    const authUrl =
        "https://launcher.stalcraft.net/auth?state=true&login=REDACTED&pass=ASVDgH23Zsa2fw%3F%24jlxRWkJ6GPI~&passhash=%242y%2410%244Cnik4H3KLzggCetlCLgkefE7KWNlDM8ZmeIzL4up856lkb1n0Lcy&bootstrap=9d665c84d90a06af94679bde05994fd775a20cd&hwid=11111111111111111111111111111111111111111111111111111111111111111&id=4102a88e-184d-4321-1234-a641f7bfb647&protocol_version=3";

    let token: string;
    try {
        const authRes = await axios.get<AuthResponse>(authUrl);
        token = authRes.data.token;
        console.log("[DEBUG] Obtained token:", token);
    } catch (error) {
        console.error("[ERROR] Failed to obtain token:", error);
        return;
    }

    const downloadUrl = `http://launcher.stalcraft.net/torrentData?id=stalcraft&token=${token}&login=REDACTED`;

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
    let diffHtml = '<div class="no-changes">Изменений не обнаружено.</div>';
    if (fs.existsSync(diffFilePath)) {
        const diffLines = fs
            .readFileSync(diffFilePath, "utf8")
            .split("\n")
            .filter(line => line.trim());
        if (diffLines.length > 0) {
            const root: TreeNode = { name: "", children: [] };
            diffLines.forEach(line => {
                const mark = line[0] as "+" | "~" | "-";
                const pathStr = line.slice(2).trim();
                addToTree(root, pathStr, mark);
            });
            diffHtml = `<div class="changes">${root.children
                .map((child, index) => renderDiffTree(child, index))
                .join("")}</div>`;
        }
    }
    const html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <title>Патчноут</title>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta name="description" content="Изменения в файлах ассетов игры" />
            <style>
                body {
                    background-color: #1e1e1e;
                    color: #c5c5c5;
                    font-family: monospace;
                    padding: 16px;
                    width: 100%;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    overflow-x: hidden;
                }
                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-image: url('pattern_anti_spectrum.png');
                    background-repeat: repeat;
                    background-size: 200px;
                    opacity: 0.03;
                    pointer-events: none;
                    z-index: 0;
                }
                .changes {
                    width: 100%;
                    flex: 1;
                    position: relative;
                    z-index: 1;
                }
                .directory,
                .file,
                .path {
                    margin-left: 16px;
                    width: 100%;
                    position: relative;
                }
                .path {
                    opacity: 0.5;
                }
                .directory > .name {
                    font-size: 16px;
                }
                .added { color: #a0d468; }
                .deleted { color: #ff6b6b; }
                .modified { color: #ffd700; }
                .diff-line {
                    font-family: 'Consolas', monospace;
                    padding: 4px 8px;
                    margin: 2px 0;
                    border-radius: 4px;
                    background: rgba(0, 0, 0, 0.2);
                }
                .no-changes {
                    text-align: center;
                    padding: 20px;
                    color: #888;
                    font-style: italic;
                }
                .footer {
                    margin-top: 20px;
                    text-align: center;
                    padding: 10px;
                    border-top: 1px solid #333;
                    position: relative;
                    z-index: 1;
                }
                .footer a {
                    color: #c5c5c5;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: color 0.3s ease;
                }
                .footer a:hover {
                    color: #8a9cff;
                }
                .footer img {
                    width: 24px;
                    height: 24px;
                }
                h1 {
                    font-size: 24px;
                    margin-bottom: 16px;
                }
                h3 a {
                    color: #8a9cff;
                    text-decoration: none;
                    transition: color 0.3s ease;
                }
                h3 a:hover {
                    color: #b39ddb;
                }
                details[open] > summary .arrow {
                    content: '▼';
                }
                details:not([open]) > summary .arrow {
                    content: '▶';
                }
                summary .arrow {
                    margin-right: 5px;
                    cursor: pointer;
                }
            </style>
        </head>
        <body>
            <h1>Файлы игры STALCRAFT ${new Date().toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
            })}</h1>
            ${diffHtml}
            <div class="footer">
                <h3><a href="https://github.com/Art3mLapa">Site made by krevetka-ts</a></h3>
            </div>
        </body>
        </html>
    `;
    res.send(html);
});

app.get("/explore", (req, res) => {
    console.log("[DEBUG] Serving /explore");
    let treeHtml = '<div class="no-changes">Нет доступных данных.</div>';
    if (fs.existsSync(jsonFilePath)) {
        const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
        treeHtml = `<div class="changes">${renderFullTree(
            jsonData,
            "/"
        )}</div>`;
    }
    const html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <title>Патчноут</title>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta name="description" content="Обзор файлов ассетов игры" />
            <style>
                body {
                    background-color: #1e1e1e;
                    color: #c5c5c5;
                    font-family: monospace;
                    padding: 16px;
                    width: 100%;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    overflow-x: hidden;
                }
                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-image: url('pattern_anti_spectrum.png');
                    background-repeat: repeat;
                    background-size: 200px;
                    opacity: 0.03;
                    pointer-events: none;
                    z-index: 0;
                }
                .changes {
                    width: 100%;
                    flex: 1;
                    position: relative;
                    z-index: 1;
                }
                .directory,
                .file,
                .path {
                    margin-left: 16px;
                    width: 100%;
                    position: relative;
                }
                .path {
                    opacity: 0.5;
                }
                .directory > .name {
                    font-size: 16px;
                }
                .no-changes {
                    text-align: center;
                    padding: 20px;
                    color: #888;
                    font-style: italic;
                }
                .footer {
                    margin-top: 20px;
                    text-align: center;
                    padding: 10px;
                    border-top: 1px solid #333;
                    position: relative;
                    z-index: 1;
                }
                .footer a {
                    color: #c5c5c5;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: color 0.3s ease;
                }
                .footer a:hover {
                    color: #8a9cff;
                }
                .footer img {
                    width: 24px;
                    height: 24px;
                }
                h1 {
                    font-size: 24px;
                    margin-bottom: 16px;
                }
                h3 a {
                    color: #8a9cff;
                    text-decoration: none;
                    transition: color 0.3s ease;
                }
                h3 a:hover {
                    color: #b39ddb;
                }
                details[open] > summary .arrow {
                    content: '▼';
                }
                details:not([open]) > summary .arrow {
                    content: '▶';
                }
                summary .arrow {
                    margin-right: 5px;
                    cursor: pointer;
                }
            </style>
        </head>
        <body>
            <h1>Обзор файлов STALCRAFT ${new Date().toLocaleDateString(
                "ru-RU",
                { day: "numeric", month: "long", year: "numeric" }
            )}</h1>
            ${treeHtml}
            <div class="footer">
                <h3><a href="https://github.com/Art3mLapa">Site made by krevetka-ts</a></h3>
            </div>
        </body>
        </html>
    `;
    res.send(html);
});

// Запуск сервера
app.listen(1488, () => {
    console.log("[DEBUG] Server started on http://localhost:1488");
    monitor();
});
