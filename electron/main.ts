import { app, BrowserWindow, ipcMain, dialog, session, shell } from "electron";
import path, { join, dirname, basename, extname } from "path";
import * as fs from "fs";
import { exec, spawn } from "child_process";
import Database from "better-sqlite3";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { parseDocument } from "./parser";
import { fetchWithRetry, toPortalError } from "./portal-fetch";
import { IMAGE_EXTS } from "./parser/utils";
import { getBinaryPath } from "./binManager";
import {
  extractAiText,
  parseAiResponse,
} from "./ai-response-parser";

let mainWindow: BrowserWindow | null = null;
let db: Database.Database | null = null;

// Define paths
const DIST = join(__dirname, "../dist");
const DIST_ELECTRON = join(__dirname, "../dist-electron");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const DB_PATH = join(app.getPath("userData"), "mysimkari.sqlite");

function isCorruptionError(err: any): boolean {
  if (!err) return false;
  if ((err as any).code === "SQLITE_CORRUPT") return true;
  const msg = String((err as any).message || err);
  return /malformed|corrupt|not a database/i.test(msg);
}

function backupAndRemoveDbFiles(): void {
  try {
    try {
      db?.close();
    } catch {}
    db = null;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    // Keep a backup of the corrupt file for forensics, then start fresh.
    if (fs.existsSync(DB_PATH)) {
      try {
        fs.renameSync(DB_PATH, `${DB_PATH}.corrupt-${stamp}.bak`);
      } catch {
        try {
          fs.unlinkSync(DB_PATH);
        } catch {}
      }
    }
    for (const suffix of ["-wal", "-shm", "-journal"]) {
      try {
        if (fs.existsSync(`${DB_PATH}${suffix}`)) fs.unlinkSync(`${DB_PATH}${suffix}`);
      } catch {}
    }
  } catch (err) {
    console.error("Failed to remove corrupt database files:", err);
  }
}

function createSchema(target: Database.Database): void {
  target.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS documents (
      path TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      size INTEGER,
      parsed_name TEXT,
      parsed_desc TEXT,
      parsed_date TEXT,
      status TEXT
    );
  `);
  // Add raw_text column if missing (for existing DBs)
  try {
    target.exec(`ALTER TABLE documents ADD COLUMN raw_text TEXT`);
  } catch {}
}

function initDB(hasRetried = false) {
  try {
    db = new Database(DB_PATH);
    db.pragma("busy_timeout = 5000");
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = FULL");

    // Fail fast if the file is already corrupt instead of crashing later
    // inside readDirRecursive / select-folder.
    const check = db.prepare("PRAGMA integrity_check").get() as any;
    if (check && check.integrity_check && check.integrity_check !== "ok") {
      throw Object.assign(new Error(`integrity_check failed: ${check.integrity_check}`), {
        code: "SQLITE_CORRUPT",
      });
    }

    createSchema(db);
  } catch (err) {
    console.error("initDB failed:", err);
    if (!hasRetried && isCorruptionError(err)) {
      console.error("Database appears corrupt, backing up and recreating...");
      backupAndRemoveDbFiles();
      return initDB(true);
    }
    throw err;
  }
}

/** Run a DB callback; if the file turns out to be corrupt mid-session, back it up, recreate, and retry once. */
function withDbRecovery<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (!isCorruptionError(err)) throw err;
    console.error("SQLite corruption detected, recovering...", err);
    backupAndRemoveDbFiles();
    initDB(true);
    return fn();
  }
}

function safeGet(sql: string, ...params: any[]): any {
  if (!db) initDB();
  return withDbRecovery(() => (db as Database.Database).prepare(sql).get(...params) as any);
}

function safeRun(sql: string, ...params: any[]): void {
  if (!db) initDB();
  withDbRecovery(() => (db as Database.Database).prepare(sql).run(...params));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(DIST_ELECTRON, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#ffffff",
      symbolColor: "#3b82f6",
      height: 56,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(DIST, "index.html"));
  }
}

app.whenReady().then(() => {
  try {
    initDB();
  } catch (err) {
    console.error("Failed to initialize database on startup:", err);
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  try {
    try {
      db?.pragma("wal_checkpoint(TRUNCATE)");
    } catch {}
    try {
      db?.close();
    } catch {}
  } finally {
    db = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  try {
    try {
      db?.pragma("wal_checkpoint(TRUNCATE)");
    } catch {}
    try {
      db?.close();
    } catch {}
  } finally {
    db = null;
  }
});

// IPC Handlers
ipcMain.handle("select-folder", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory"],
    });

    if (result.canceled) return null;

    const folderPath = result.filePaths[0];
    const fileTree = readDirRecursive(folderPath);
    return { folderPath, fileTree };
  } catch (err) {
    console.error("select-folder failed:", err);
    throw err instanceof Error ? err : new Error("Failed to read folder");
  }
});

ipcMain.handle("read-folder", async (_event, folderPath: string) => {
  try {
    if (!fs.existsSync(folderPath)) return null;
    return readDirRecursive(folderPath);
  } catch (err) {
    console.error("read-folder failed:", err);
    throw err instanceof Error ? err : new Error("Failed to read folder");
  }
});

function readDirRecursive(dirPath: string): any[] {
  const items: any[] = [];
  let files: fs.Dirent[];
  try {
    files = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    console.error(`Cannot read directory ${dirPath}:`, err);
    return items;
  }

  // Ensure DB is open before scanning; if it's corrupt, initDB() already
  // backed it up and recreated it. If it still fails, continue without cache
  // so a DB problem never aborts the folder scan.
  try {
    if (!db) initDB();
  } catch (err) {
    console.error("DB unavailable during folder scan, continuing without cache:", err);
  }

  for (const f of files) {
    const fullPath = join(dirPath, f.name);
    if (f.isDirectory()) {
      const children = readDirRecursive(fullPath);
      if (children.length > 0) {
        // Folder modification date, so folders can also match the sidebar
        // date-range filter directly (e.g. renamed / new files added inside).
        let folderMtime = "";
        try {
          folderMtime = fs.statSync(fullPath).mtime.toISOString().split("T")[0];
        } catch {}
        items.push({
          name: f.name,
          path: fullPath,
          type: "folder",
          mtime: folderMtime,
          children,
        });
      }
    } else if (
      f.isFile() &&
      f.name.match(
        /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|bmp|tiff|tif|webp|gif|txt)$/i,
      )
    ) {
      const ext = extname(fullPath).toLowerCase().replace(".", "");
      // File date/size for the sidebar date-range filter. Stat here so the
      // renderer can filter without an IPC call per file.
      let mtime = "";
      let size = 0;
      try {
        const stats = fs.statSync(fullPath);
        mtime = stats.mtime.toISOString().split("T")[0];
        size = stats.size;
      } catch {}
      let existing: any = null;
      try {
        // Re-prepare on every call so a mid-scan recovery (which replaces the
        // db handle) never leaves us with a stale prepared statement.
        existing = safeGet("SELECT * FROM documents WHERE path = ?", fullPath);
      } catch (err) {
        // A single bad row / transient error must not abort the whole scan.
        console.error(`DB lookup failed for ${fullPath}, treating as unprocessed:`, err);
        existing = null;
      }

      if (!existing) {
        try {
          safeRun(
            "INSERT INTO documents (path, name, type, status) VALUES (?, ?, ?, ?)",
            fullPath,
            f.name,
            ext,
            "unprocessed",
          );
        } catch (err) {
          console.error(`DB insert failed for ${fullPath}:`, err);
          // Fall through: still show the file, just without persisting.
        }
        items.push({
          name: f.name,
          path: fullPath,
          type: "file",
          fileType: ext,
          status: "unprocessed",
          mtime,
          size,
        });
      } else {
        items.push({
          name: existing.name,
          path: existing.path,
          type: "file",
          fileType: existing.type,
          status: existing.status,
          mtime,
          size,
          parsedData: existing.parsed_name
            ? {
                name: existing.parsed_name,
                description: existing.parsed_desc,
                date: existing.parsed_date,
              }
            : undefined,
        });
      }
    }
  }
  return items;
}

ipcMain.handle("parse-file", async (_event, path: string, type: string) => {
  const parsedData = await parseDocument(path, type);
  safeRun(
    "UPDATE documents SET parsed_name = ?, parsed_desc = ?, parsed_date = ?, raw_text = ?, status = ? WHERE path = ?",
    parsedData.name,
    parsedData.description,
    parsedData.date,
    parsedData.rawText || "",
    "ready",
    path,
  );
  return parsedData;
});

ipcMain.handle("check-session", () => {
  const sessionRow = safeGet("SELECT value FROM settings WHERE key = ?", "session") as any;
  return !!sessionRow;
});

ipcMain.handle("login-mysimkari", () => {
  return new Promise<boolean>((resolve) => {
    let resolved = false;

    const finish = (value: boolean) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };

    const authWindow = new BrowserWindow({
      width: 800,
      height: 700,
      parent: mainWindow!,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: "persist:mysimkari",
      },
    });

    authWindow.loadURL("https://mysimkari.kejaksaan.go.id/");

    const checkUrl = async (url: string) => {
      try {
        if (!url.includes("/pegawai/edit")) return;

        let uniqueuserid: string | null = null;

        const match = url.match(/\/pegawai\/edit\/([^\/?#]+)/);

        if (match) {
          uniqueuserid = match[1];

          safeRun(
            `
            INSERT OR REPLACE INTO settings (key, value)
            VALUES (?, ?)
          `,
            "uniqueuserid",
            uniqueuserid,
          );
        }

        const ses = session.fromPartition("persist:mysimkari");

        const cookies = await ses.cookies.get({
          url: "https://mysimkari.kejaksaan.go.id",
        });

        safeRun(
          `
          INSERT OR REPLACE INTO settings (key, value)
          VALUES (?, ?)
        `,
          "session",
          JSON.stringify(cookies),
        );

        if (uniqueuserid && cookies.length > 0) {
          const cookieString = cookies
            .map((c) => `${c.name}=${c.value}`)
            .join("; ");

          try {
            const resp = await fetch(
              `https://mysimkari.kejaksaan.go.id/pegawai/edit/${uniqueuserid}`,
              {
                headers: {
                  Cookie: cookieString,
                },
              },
            );

            const html = await resp.text();

            const nipMatch = html.match(
              /<input[^>]*name="nip"[^>]*value="([^"]*)"/i,
            );

            if (nipMatch) {
              const nip = nipMatch[1];

              safeRun(
                `
                INSERT OR REPLACE INTO settings (key, value)
                VALUES (?, ?)
              `,
                "nip",
                nip,
              );
            }
          } catch (err) {
            console.error("Failed to fetch NIP:", err);
          }
        }

        authWindow.close();

        finish(true);
      } catch (err) {
        console.error(err);
        finish(false);
      }
    };

    authWindow.webContents.on("did-navigate", (_, url) => {
      checkUrl(url);
    });

    authWindow.webContents.on("did-redirect-navigation", (_, url) => {
      checkUrl(url);
    });

    authWindow.on("closed", () => {
      finish(false);
    });
  });
});

ipcMain.handle("logout-mysimkari", async () => {
  safeRun("DELETE FROM settings WHERE key = ?", "session");
  safeRun("DELETE FROM settings WHERE key = ?", "uniqueuserid");
  await session.fromPartition("persist:mysimkari").clearStorageData();
  return true;
});

ipcMain.handle("get-form-options", async () => {
  const sessionRow = safeGet("SELECT value FROM settings WHERE key = ?", "session") as any;
  const userRow = safeGet("SELECT value FROM settings WHERE key = ?", "uniqueuserid") as any;

  if (!sessionRow || !userRow) return null;

  const cookies = JSON.parse(sessionRow.value);
  const cookieString = cookies
    .map((c: any) => `${c.name}=${c.value}`)
    .join("; ");

  try {
    const response = await fetchWithRetry(
      `https://mysimkari.kejaksaan.go.id/dashboard-utama/pegawai/${userRow.value}`,
      {
        headers: { Cookie: cookieString },
      },
    );
    const html = await response.text();

    const extractOptions = (id: string) => {
      const selectMatch = html.match(
        new RegExp(`<select[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`),
      );
      if (!selectMatch) return [];

      const options = [];
      const optionRegex =
        /<option[^>]*value="([^"]*)"(?:[^>]*data-kegiatan-saya="([^"]*)")?[^>]*>([\s\S]*?)<\/option>/g;
      let match;
      while ((match = optionRegex.exec(selectMatch[1])) !== null) {
        if (match[1]) {
          // ignore empty value (placeholder)
          options.push({
            value: match[1],
            label: match[3].trim(),
            sasaran: match[2] || "",
          });
        }
      }
      return options;
    };

    return {
      tipe: extractOptions("tipekegiatan"),
      kategori: extractOptions("kaitan_kegiatan"),
      indikator: extractOptions("indikatorkinerja"),
    };
  } catch (error) {
    console.error("Error crawling form options:", error);
    return toPortalError(error);
  }
});

ipcMain.handle("get-file-stats", async (_event, path: string) => {
  try {
    const stats = fs.statSync(path);
    return {
      mtime: stats.mtime.toISOString().split("T")[0],
      size: stats.size,
    };
  } catch (error) {
    return null;
  }
});

ipcMain.handle("sync-data", async (_event, path: string, formData: any) => {
  const sessionRow = safeGet("SELECT value FROM settings WHERE key = ?", "session") as any;
  const nipRow = safeGet("SELECT value FROM settings WHERE key = ?", "nip") as any;
  if (!sessionRow || !nipRow) return false;

  const cookies = JSON.parse(sessionRow.value);
  const cookieString = cookies
    .map((c: any) => `${c.name}=${c.value}`)
    .join("; ");
  const nip = nipRow.value;

  let processedPath = path;
  let isTempFile = false;

  try {
    // 1. Prepare/Compress file
    const result = await prepareFileForSync(path);
    processedPath = result.path;
    isTempFile = result.isTemp;

    // 2. Fetch page to extract raw CSRF token
    const userRow = safeGet("SELECT value FROM settings WHERE key = ?", "uniqueuserid") as any;
    if (!userRow) return false;
    const uniqueuserid = userRow.value;
    const getResp = await fetch(
      `https://mysimkari.kejaksaan.go.id/pegawai/edit/${uniqueuserid}`,
      {
        headers: { Cookie: cookieString },
      },
    );

    const html = await getResp.text();
    const tokenMatch = html.match(/<meta name="csrf-token" content="([^"]+)">/);
    const csrfToken = tokenMatch ? tokenMatch[1] : "";

    // 3. Prepare Payload
    const fileBuffer = fs.readFileSync(processedPath);
    const fileBlob = new Blob([fileBuffer]);
    let fileName = basename(path);

    // If converted to PDF (isTempFile), update extension to .pdf
    if (isTempFile) {
      fileName = fileName.replace(/\.[^/.]+$/, "") + ".pdf";
    }

    const payload = new FormData();
    payload.append("_token", csrfToken);
    payload.append("tipe_kegiatan", formData.tipe_kegiatan);
    payload.append("kaitan_kegiatan", formData.kaitan_kegiatan);
    payload.append("id_indikator", formData.id_indikator);
    payload.append("sasaran_kegiatan", formData.sasaran_kegiatan);
    payload.append("nama_kegiatan", formData.name);
    payload.append("desc_kegiatan", formData.description);
    payload.append("tanggal_kegiatan", formData.date);
    payload.append("menit", formData.menit?.toString() || "420");
    payload.append("file", fileBlob, fileName);
    payload.append("nip", nip);

    // 4. Send POST Request
    const response = await fetch(
      "https://mysimkari.kejaksaan.go.id/ekinerja/simpankinerja/indikator/new",
      {
        method: "POST",
        headers: {
          Cookie: cookieString,
          "x-csrf-token": csrfToken,
          "x-requested-with": "XMLHttpRequest",
          Referer: "https://mysimkari.kejaksaan.go.id/dashboard-utama/pegawai",
        },
        body: payload as any,
      },
    );

    // Clean up temp file if created
    if (isTempFile && fs.existsSync(processedPath)) {
      try {
        fs.unlinkSync(processedPath);
      } catch (e) {}
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 419) {
        safeRun("DELETE FROM settings WHERE key = ?", "session");
      }
      console.error(
        "Sync failed with status:",
        response.status,
        await response.text(),
      );
      return false;
    }

    safeRun(
      "UPDATE documents SET parsed_name = ?, parsed_desc = ?, parsed_date = ?, status = ? WHERE path = ?",
      formData.name,
      formData.description,
      formData.date,
      "synced",
      path,
    );
    return true;
  } catch (error) {
    console.error("Sync error:", error);
    if (isTempFile && fs.existsSync(processedPath)) {
      try {
        fs.unlinkSync(processedPath);
      } catch (e) {}
    }
    return false;
  }
});

ipcMain.handle("get-sync-history", async () => {
  const sessionRow = safeGet("SELECT value FROM settings WHERE key = ?", "session") as any;
  const nipRow = safeGet("SELECT value FROM settings WHERE key = ?", "nip") as any;

  if (!sessionRow || !nipRow) return null;

  const cookies = JSON.parse(sessionRow.value);
  const cookieString = cookies
    .map((c: any) => `${c.name}=${c.value}`)
    .join("; ");
  const nip = nipRow.value;

  try {
    const response = await fetchWithRetry(
      `https://mysimkari.kejaksaan.go.id/get-kinerja/${nip}/all/data`,
      {
        headers: {
          Cookie: cookieString,
          "x-requested-with": "XMLHttpRequest",
          Referer: "https://mysimkari.kejaksaan.go.id/dashboard-utama/pegawai",
        },
      },
    );

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Error fetching sync history:", error);
    return toPortalError(error);
  }
});

ipcMain.handle("save-setting", (_event, key: string, value: string) => {
  safeRun("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value);
  return true;
});

ipcMain.handle("get-setting", (_event, key: string) => {
  const row = safeGet("SELECT value FROM settings WHERE key = ?", key) as any;
  return row ? row.value : null;
});

ipcMain.handle("open-file", async (_event, path: string) => {
  return await shell.openPath(path);
});

ipcMain.handle("open-with-dialog", async (_event, path: string) => {
  const openWithPath = join(
    process.env.SystemRoot || "C:\\Windows",
    "System32\\OpenWith.exe",
  );
  exec(`"${openWithPath}" "${path}"`);
});

ipcMain.handle("show-item-in-folder", async (_event, path: string) => {
  shell.showItemInFolder(path);
});

ipcMain.handle("get-associated-apps", async (_event, ext: string) => {
  if (process.platform !== "win32") return [];

  const cleanExt = ext.startsWith(".") ? ext : `.${ext}`;

  return new Promise((resolve) => {
    const script = `
      $ext = "${cleanExt}";
      $apps = @();
      $regPaths = @(
        "Registry::HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\$ext\\OpenWithList",
        "Registry::HKEY_CLASSES_ROOT\\$ext\\OpenWithList",
        "Registry::HKEY_CLASSES_ROOT\\SystemFileAssociations\\$ext\\OpenWithList"
      );
      foreach ($rp in $regPaths) {
        if (Test-Path $rp) {
          $list = Get-ItemProperty -Path $rp -ErrorAction SilentlyContinue;
          if ($list) {
            foreach ($p in $list.PSObject.Properties) {
              if ($p.Name -match "^[a-z0-9]$") {
                $val = $p.Value;
                if ($val -and $val -notmatch "^[a-z]{8}$" -and $val -ne "MRUList") { 
                  $apps += $val
                }
              }
            }
          }
        }
      }
      # Fallback for common types if list is short
      if ($apps.Count -lt 2) {
        if ($ext -eq ".pdf") { $apps += @("msedge.exe", "chrome.exe", "AcroRd32.exe") }
        elseif ($ext -match "\\.doc|\\.docx") { $apps += @("Winword.exe", "write.exe") }
        elseif ($ext -match "\\.xls|\\.xlsx") { $apps += @("Excel.exe") }
        elseif ($ext -match "\\.ppt|\\.pptx") { $apps += @("Powerpnt.exe") }
        elseif ($ext -match "\\.jpg|\\.jpeg|\\.png|\\.bmp|\\.tiff|\\.tif|\\.webp|\\.gif") { $apps += @("mspaint.exe", "msedge.exe", "chrome.exe") }
        elseif ($ext -eq ".txt") { $apps += @("notepad.exe", "write.exe") }
      }
      $apps | Select-Object -Unique | Where-Object { $_ -match "\\.exe$" } | ConvertTo-Json
    `;

    exec(
      `powershell -Command "${script.replace(/\n/g, " ")}"`,
      (error, stdout) => {
        if (error || !stdout) {
          // Last resort fallback if PS fails
          const fallback = [];
          if (cleanExt === ".pdf") fallback.push("msedge.exe", "chrome.exe");
          resolve(fallback);
          return;
        }
        try {
          const result = JSON.parse(stdout);
          const appsArray = Array.isArray(result) ? result : [result];
          resolve(appsArray.filter(Boolean));
        } catch {
          resolve([]);
        }
      },
    );
  });
});

ipcMain.handle("open-with-app", async (_event, path: string, app: string) => {
  exec(`start "" "${app}" "${path}"`);
});

ipcMain.handle("compress-pdf", async (_event, filePath: string) => {
  const dir = dirname(filePath);
  const name = basename(filePath, extname(filePath));
  const outPath = join(dir, `${name}_compressed.pdf`);

  const result = await compressPdfInternal(filePath, outPath);
  if (result === "FALLBACK") {
    return await runWordFallback(filePath, outPath);
  }
  return result;
});

ipcMain.handle("convert-to-pdf", async (_event, filePath: string) => {
  const dir = dirname(filePath);
  const name = basename(filePath, extname(filePath));
  const outPath = join(dir, `${name}_outpdf.pdf`);
  const ext = extname(filePath).toLowerCase().replace(".", "");
  if (IMAGE_EXTS.includes(ext)) {
    return await convertImageToPdfInternal(filePath, outPath);
  }
  return await convertToPdfInternal(filePath, outPath);
});

// --- AI Settings & Generation ---

ipcMain.handle(
  "save-ai-settings",
  (
    _event,
    settings: {
      provider: string;
      apiKey: string;
      model: string;
      baseUrl: string;
      systemPrompt: string;
      temperature: number;
      maxTokens: number;
    },
  ) => {
    safeRun("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "ai_provider", settings.provider);
    safeRun("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "ai_api_key", settings.apiKey);
    safeRun("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "ai_model", settings.model);
    safeRun("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "ai_base_url", settings.baseUrl);
    safeRun(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      "ai_system_prompt",
      settings.systemPrompt,
    );
    safeRun(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      "ai_temperature",
      settings.temperature.toString(),
    );
    safeRun(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      "ai_max_tokens",
      settings.maxTokens.toString(),
    );
    return true;
  },
);

ipcMain.handle("get-ai-settings", () => {
  const get = (key: string) => {
    const row = safeGet("SELECT value FROM settings WHERE key = ?", key) as any;
    return row ? row.value : "";
  };
  return {
    provider: get("ai_provider"),
    apiKey: get("ai_api_key"),
    model: get("ai_model"),
    baseUrl: get("ai_base_url"),
    systemPrompt: get("ai_system_prompt"),
    temperature: parseFloat(get("ai_temperature") || "0.7"),
    maxTokens: parseInt(get("ai_max_tokens") || "1024"),
  };
});

ipcMain.handle(
  "test-ai-connection",
  async (
    _event,
    settings: {
      provider: string;
      apiKey: string;
      model: string;
      baseUrl: string;
    },
  ) => {
    try {
      if (settings.provider === "gemini") {
        const baseUrl = normalizeGeminiBaseUrl(settings.baseUrl);
        const res = await fetch(`${baseUrl}/models`, {
          headers: { "x-goog-api-key": settings.apiKey },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return {
            success: false,
            error: err?.error?.message || `HTTP ${res.status}`,
          };
        }
        const data = (await res.json()) as any;
        const models = (data.models || []).map((m: any) =>
          m.name.replace("models/", ""),
        );
        return { success: true, models };
      } else {
        // OpenAI-compatible
        const baseUrl = settings.baseUrl.replace(/\/+$/, "");
        const res = await fetch(`${baseUrl}/v1/models`, {
          headers: { Authorization: `Bearer ${settings.apiKey}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return {
            success: false,
            error: err?.error?.message || `HTTP ${res.status}`,
          };
        }
        const data = (await res.json()) as any;
        const models = (data.data || []).map((m: any) => m.id);
        return { success: true, models };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Connection failed" };
    }
  },
);

ipcMain.handle(
  "generate-ai",
  async (
    _event,
    payload: {
      provider: string;
      apiKey: string;
      model: string;
      baseUrl: string;
      systemPrompt: string;
      temperature: number;
      maxTokens: number;
      fileText: string;
      tipeKegiatan: string;
      kategoriKegiatan: string;
      indikatorKinerja: string;
      sasaranKinerja: string;
      target: "name" | "description" | "both";
    },
  ) => {
    try {
      const contextBlock = `Konteks Form:
- Tipe Kegiatan: ${payload.tipeKegiatan || "(belum dipilih)"}
- Kategori: ${payload.kategoriKegiatan || "(belum dipilih)"}
- Indikator: ${payload.indikatorKinerja || "(belum dipilih)"}
- Sasaran: ${payload.sasaranKinerja || "(belum dipilih)"}`;

      let userPrompt = "";
      if (payload.target === "name") {
        userPrompt = `${contextBlock}

Isi Dokumen:
${payload.fileText.substring(0, 4000)}

Buatkan nama kegiatan yang singkat dan formal (maksimal 100 karakter). Tulis hanya nama kegiatannya saja, tanpa penjelasan tambahan.`;
      } else if (payload.target === "description") {
        userPrompt = `${contextBlock}

Isi Dokumen:
${payload.fileText.substring(0, 4000)}

Buatkan deskripsi kegiatan yang detail dan formal (maksimal 300 karakter). Tulis hanya deskripsi kegiatannya saja, tanpa penjelasan tambahan.`;
      } else {
        userPrompt = `${contextBlock}

Isi Dokumen:
${payload.fileText.substring(0, 4000)}

Buatkan nama kegiatan (maksimal 100 karakter) dan deskripsi kegiatan (maksimal 300 karakter). Format jawaban:
NAMA: [nama kegiatan]
DESKRIPSI: [deskripsi kegiatan]`;
      }

      const defaultSystem = `Saya adalah seorang pegawai administrasi di Kejaksaan Negeri PIDIE. Bantu saya menyusun format berikut berdasarkan dokumen yang saya berikan.`;
      const systemPrompt = payload.systemPrompt || defaultSystem;

      let result: { name?: string; description?: string } = {};

      if (payload.provider === "gemini") {
        const baseUrl = normalizeGeminiBaseUrl(payload.baseUrl);
        const res = await fetch(`${baseUrl}/interactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": payload.apiKey,
          },
          body: JSON.stringify({
            model: payload.model || "gemini-3.7-flash",
            input: userPrompt,
            system_instruction: systemPrompt,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return {
            error: err?.error?.message || `Gemini API error: ${res.status}`,
          };
        }

        const data = (await res.json()) as any;

        const text = extractAiText(data);
        if (!text) {
          return { error: "Gemini returned an empty response" };
        }
        result = parseAiResponse(text, payload.target);
      } else {
        // OpenAI-compatible
        const baseUrl = payload.baseUrl.replace(/\/+$/, "");
        const res = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${payload.apiKey}`,
          },
          body: JSON.stringify({
            model: payload.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: payload.temperature,
            max_tokens: payload.maxTokens,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { error: err?.error?.message || `API error: ${res.status}` };
        }
        const data = (await res.json()) as any;
        const text = extractAiText(data?.choices?.[0]?.message?.content);
        result = parseAiResponse(text, payload.target);
      }

      const hasName = Boolean(result.name?.trim());
      const hasDescription = Boolean(result.description?.trim());
      if (
        (payload.target === "name" && !hasName) ||
        (payload.target === "description" && !hasDescription) ||
        (payload.target === "both" && (!hasName || !hasDescription))
      ) {
        return { error: "AI returned an incomplete response" };
      }

      return result;
    } catch (err: any) {
      return { error: err.message || "AI generation failed" };
    }
  },
);

function normalizeGeminiBaseUrl(baseUrl: string): string {
  const configuredUrl = baseUrl.trim().replace(/\/+$/, "");
  const defaultUrl = "https://generativelanguage.googleapis.com/v1beta";

  if (!configuredUrl) return defaultUrl;

  return configuredUrl.replace(/\/(?:interactions|models)$/, "");
}

ipcMain.handle("get-file-text", async (_event, filePath: string) => {
  try {
    const fileType = path.extname(filePath).toLowerCase().substring(1);
    const parsed = await parseDocument(filePath, fileType);
    return parsed.rawText || "";
  } catch {
    return "";
  }
});

// --- Internal Helper Functions ---

async function prepareFileForSync(
  filePath: string,
): Promise<{ path: string; isTemp: boolean }> {
  const MAX_SIZE = 500 * 1024; // 500KB
  let currentPath = filePath;
  let isTemp = false;
  const ext = extname(filePath).toLowerCase().replace(".", "");

  try {
    // 1. Convert to PDF if not already
    if (ext !== "pdf") {
      const pdfPath = join(app.getPath("temp"), `sync_${Date.now()}.pdf`);
      const success = IMAGE_EXTS.includes(ext)
        ? await convertImageToPdfInternal(filePath, pdfPath)
        : await convertToPdfInternal(filePath, pdfPath);
      if (success) {
        currentPath = pdfPath;
        isTemp = true;
      }
    }

    // 2. Check size and compress if needed
    let stats = fs.statSync(currentPath);
    if (stats.size > MAX_SIZE) {
      // Stage 1: /ebook (150dpi)
      const compressedPath = join(
        app.getPath("temp"),
        `comp_ebook_${Date.now()}.pdf`,
      );
      let result = await compressPdfInternal(
        currentPath,
        compressedPath,
        "/ebook",
      );

      if (result === "FALLBACK") {
        result = await runWordFallback(currentPath, compressedPath);
      }

      if (result === true && fs.existsSync(compressedPath)) {
        let compStats = fs.statSync(compressedPath);

        // If still too big, Stage 2: /screen (72dpi)
        if (compStats.size > MAX_SIZE) {
          const aggressivePath = join(
            app.getPath("temp"),
            `comp_screen_${Date.now()}.pdf`,
          );
          let aggResult = await compressPdfInternal(
            currentPath,
            aggressivePath,
            "/screen",
          );

          if (aggResult === true && fs.existsSync(aggressivePath)) {
            if (isTemp) fs.unlinkSync(currentPath);
            if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath);
            currentPath = aggressivePath;
            isTemp = true;
          } else {
            // Keep the ebook version if screen failed
            if (isTemp) fs.unlinkSync(currentPath);
            currentPath = compressedPath;
            isTemp = true;
          }
        } else {
          if (isTemp) fs.unlinkSync(currentPath);
          currentPath = compressedPath;
          isTemp = true;
        }
      }
    }

    return { path: currentPath, isTemp };
  } catch (err) {
    console.error("Error in prepareFileForSync:", err);
    return { path: filePath, isTemp: false };
  }
}

async function compressPdfInternal(
  filePath: string,
  outPath: string,
  quality: string = "/ebook",
): Promise<boolean | "FALLBACK"> {
  const gsCommand = getBinaryPath("ghostscript");
  return new Promise((resolve) => {
    const args = [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=${quality}`,
      "-dNOPAUSE",
      "-dBATCH",
      `-sOutputFile=${outPath}`,
      filePath,
    ];
    const proc = spawn(gsCommand, args);
    proc.on("error", (err: any) => {
      if (err.code === "ENOENT") resolve("FALLBACK");
      else resolve(false);
    });
    proc.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

async function runWordFallback(
  filePath: string,
  outPath: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const scriptPath = join(
      app.getPath("temp"),
      `compress_fallback_${Date.now()}.ps1`,
    );
    const script = `
      try {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = 0
        $doc = $word.Documents.Open("${filePath.replace(/"/g, '`"')}", $false, $true)
        $doc.ExportAsFixedFormat("${outPath.replace(/"/g, '`"')}", 17, $false, 0)
        $doc.Close(0)
        $word.Quit()
        Write-Output "success"
      } catch {
        if ($word) { $word.Quit() }
        Write-Output "error"
      }
    `;
    fs.writeFileSync(scriptPath, script, "utf8");
    exec(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`,
      (err, stdout) => {
        if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        resolve(!err && stdout.includes("success"));
      },
    );
  });
}

async function convertImageToPdfInternal(
  filePath: string,
  outPath: string,
): Promise<boolean> {
  try {
    // Normalize any image format to JPEG, downscale if huge, then embed in a PDF.
    // Keeps output under the 500KB portal limit when possible.
    let quality = 80;
    let width = 1500;
    let jpegBuffer: Buffer = Buffer.alloc(0);

    for (let attempt = 0; attempt < 3; attempt++) {
      const buf: Buffer = await sharp(filePath)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      jpegBuffer = buf;

      // Rough budget: leave room for PDF container overhead
      if (buf.length < 450 * 1024 || quality <= 50) break;
      quality -= 15;
      if (quality < 50) {
        quality = 50;
        width = 1100;
      }
    }

    if (jpegBuffer.length === 0) return false;

    const pdf = await PDFDocument.create();
    const img = await pdf.embedJpg(jpegBuffer);
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    const bytes = await pdf.save();
    fs.writeFileSync(outPath, Buffer.from(bytes));
    return true;
  } catch (err) {
    console.error("Error converting image to PDF:", err);
    return false;
  }
}

async function convertToPdfInternal(
  filePath: string,
  outPath: string,
): Promise<boolean> {
  const ext = extname(filePath).toLowerCase().replace(".", "");
  let script = "";
  const escapedIn = filePath.replace(/"/g, '`"');
  const escapedOut = outPath.replace(/"/g, '`"');

  if (["doc", "docx"].includes(ext)) {
    script = `
      try {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $doc = $word.Documents.Open("${escapedIn}")
        $doc.ExportAsFixedFormat("${escapedOut}", 17)
        $doc.Close(0)
        $word.Quit()
        Write-Output "success"
      } catch { 
        if ($word) { $word.Quit() }
        Write-Output "error"
      }
    `;
  } else if (["xls", "xlsx"].includes(ext)) {
    script = `
      try {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $wb = $excel.Workbooks.Open("${escapedIn}")
        $wb.ExportAsFixedFormat(0, "${escapedOut}")
        $wb.Close($false)
        $excel.Quit()
        Write-Output "success"
      } catch { 
        if ($excel) { $excel.Quit() }
        Write-Output "error"
      }
    `;
  } else if (["ppt", "pptx"].includes(ext)) {
    script = `
      try {
        $ppt = New-Object -ComObject PowerPoint.Application
        $pres = $ppt.Presentations.Open("${escapedIn}", -1, 0, 0)
        $pres.SaveAs("${escapedOut}", 32)
        $pres.Close()
        $ppt.Quit()
        Write-Output "success"
      } catch { 
        if ($ppt) { $ppt.Quit() }
        Write-Output "error"
      }
    `;
  }

  if (!script) return false;

  const scriptPath = join(app.getPath("temp"), `convert_${Date.now()}.ps1`);
  fs.writeFileSync(scriptPath, script, "utf8");

  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`,
      (err, stdout) => {
        if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        resolve(!err && stdout.includes("success"));
      },
    );
  });
}
