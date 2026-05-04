import { app, BrowserWindow, ipcMain, dialog, session } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import Database from 'better-sqlite3'
import { parseDocument } from './parser'

let mainWindow: BrowserWindow | null = null
let db: Database.Database | null = null

// Define paths
const DIST = join(__dirname, '../dist')
const DIST_ELECTRON = join(__dirname, '../dist-electron')
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const DB_PATH = join(app.getPath('userData'), 'mysimkari.sqlite')

// Initialize SQLite
function initDB() {
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  
  db.exec(`
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
  `)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(DIST_ELECTRON, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#3b82f6',
      height: 56
    }
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(DIST, 'index.html'))
  }
}

app.whenReady().then(() => {
  initDB()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  })
  
  if (result.canceled) return null
  
  const folderPath = result.filePaths[0]
  
  function readDirRecursive(dirPath: string): any[] {
    const items: any[] = []
    const files = fs.readdirSync(dirPath, { withFileTypes: true })
    
    for (const f of files) {
      const fullPath = join(dirPath, f.name)
      if (f.isDirectory()) {
        const children = readDirRecursive(fullPath)
        if (children.length > 0) {
          items.push({
            name: f.name,
            path: fullPath,
            type: 'folder',
            children
          })
        }
      } else if (f.isFile() && f.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i)) {
        const ext = f.name.split('.').pop()?.toLowerCase() || ''
        const existing = db?.prepare('SELECT * FROM documents WHERE path = ?').get(fullPath) as any
        
        if (!existing) {
          db?.prepare('INSERT INTO documents (path, name, type, status) VALUES (?, ?, ?, ?)').run(fullPath, f.name, ext, 'unprocessed')
          items.push({
            name: f.name,
            path: fullPath,
            type: 'file',
            fileType: ext,
            status: 'unprocessed'
          })
        } else {
          items.push({
            name: existing.name,
            path: existing.path,
            type: 'file',
            fileType: existing.type,
            status: existing.status,
            parsedData: existing.parsed_name ? {
              name: existing.parsed_name,
              description: existing.parsed_desc,
              date: existing.parsed_date
            } : undefined
          })
        }
      }
    }
    return items
  }

  const fileTree = readDirRecursive(folderPath)
  return fileTree
})

ipcMain.handle('parse-file', async (_event, path: string, type: string) => {
  const parsedData = await parseDocument(path, type)
  db?.prepare('UPDATE documents SET parsed_name = ?, parsed_desc = ?, parsed_date = ?, status = ? WHERE path = ?').run(
    parsedData.name, parsedData.description, parsedData.date, 'ready', path
  )
  return parsedData
})

ipcMain.handle('login-mysimkari', async () => {
  return new Promise((resolve) => {
    const authWindow = new BrowserWindow({
      width: 600,
      height: 700,
      parent: mainWindow!,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    
    authWindow.loadURL('data:text/html,<h2>Mock Login Page (MySimkari)</h2><p>Click login to simulate success.</p><button onclick="document.cookie=\'session=mock_cookie_123; path=/\'; window.close()">Login</button>')
    
    authWindow.on('closed', async () => {
      const cookies = await session.defaultSession.cookies.get({ url: 'data:' })
      if (cookies.length > 0) {
        db?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('cookie', JSON.stringify(cookies))
        resolve(true)
      } else {
        resolve(false)
      }
    })
  })
})

ipcMain.handle('sync-data', async (_event, path: string, formData: any) => {
  // Check cookie
  const cookieRow = db?.prepare('SELECT value FROM settings WHERE key = ?').get('cookie') as any
  if (!cookieRow) return false

  // Simulate API request delay
  await new Promise(resolve => setTimeout(resolve, 1500))

  db?.prepare('UPDATE documents SET parsed_name = ?, parsed_desc = ?, parsed_date = ?, status = ? WHERE path = ?').run(
    formData.name, formData.description, formData.date, 'synced', path
  )
  return true
})
