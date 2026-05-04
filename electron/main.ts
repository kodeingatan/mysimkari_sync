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

ipcMain.handle('check-session', () => {
  const sessionRow = db?.prepare('SELECT value FROM settings WHERE key = ?').get('session') as any
  return !!sessionRow
})

ipcMain.handle('login-mysimkari', async () => {
  return new Promise((resolve) => {
    const authWindow = new BrowserWindow({
      width: 800,
      height: 700,
      parent: mainWindow!,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:mysimkari' // persistent session
      }
    })
    
    // 1. Open browser to mysimkari
    authWindow.loadURL('https://mysimkari.kejaksaan.go.id/')

    // 2. Wait until url directs to /pegawai/edit
    const checkUrl = async (url: string) => {
      if (url.includes('https://mysimkari.kejaksaan.go.id/pegawai/edit')) {
        // Extract uniqueuserid if it exists after /edit/
        const match = url.match(/\/pegawai\/edit\/([^\/?#]+)/)
        if (match) {
          const uniqueuserid = match[1]
          db?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('uniqueuserid', uniqueuserid)
        }

        // 3. Get session/cookies and save to settings
        const cookies = await session.fromPartition('persist:mysimkari').cookies.get({ url: 'https://mysimkari.kejaksaan.go.id' })
        db?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('session', JSON.stringify(cookies))
        authWindow.close()
        resolve(true)
      }
    }

    authWindow.webContents.on('did-navigate', (event, url) => checkUrl(url))
    authWindow.webContents.on('did-redirect-navigation', (event, url) => checkUrl(url))
    
    authWindow.on('closed', () => {
      resolve(false) // User closed window before login was completed
    })
  })
})

ipcMain.handle('logout-mysimkari', async () => {
  db?.prepare('DELETE FROM settings WHERE key = ?').run('session')
  db?.prepare('DELETE FROM settings WHERE key = ?').run('uniqueuserid')
  await session.fromPartition('persist:mysimkari').clearStorageData()
  return true
})

ipcMain.handle('sync-data', async (_event, path: string, formData: any) => {
  const sessionRow = db?.prepare('SELECT value FROM settings WHERE key = ?').get('session') as any
  if (!sessionRow) return false

  const cookies = JSON.parse(sessionRow.value)
  const cookieString = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ')

  try {
    // 1. Fetch page to extract raw CSRF token
    const getResp = await fetch('https://mysimkari.kejaksaan.go.id/dashboard-utama', {
      headers: { 'Cookie': cookieString }
    })
    const html = await getResp.text()
    const tokenMatch = html.match(/<meta name="csrf-token" content="([^"]+)">/)
    const csrfToken = tokenMatch ? tokenMatch[1] : ''

    // 2. Prepare Payload
    const fileBuffer = fs.readFileSync(path)
    const fileBlob = new Blob([fileBuffer])
    const fileName = path.split('\\').pop()?.split('/').pop() || 'document.pdf'

    const payload = new FormData()
    payload.append('_token', csrfToken)
    payload.append('tipe_kegiatan', '2')
    payload.append('kaitan_kegiatan', 'administrasi')
    payload.append('id_indikator', '192843')
    payload.append('sasaran_kegiatan', 'Melaksanakan penyusunan administrasi atau pelaksanaan kegiatan dalam rangka menindaklanjuti sesuai arahan pimpinan')
    payload.append('nama_kegiatan', formData.name)
    payload.append('desc_kegiatan', formData.description)
    payload.append('tanggal_kegiatan', formData.date)
    payload.append('menit', '420')
    payload.append('file', fileBlob, fileName)
    payload.append('nip', '199810232022031012') // From example request

    // 3. Send POST Request
    const response = await fetch('https://mysimkari.kejaksaan.go.id/ekinerja/simpankinerja/indikator/new', {
      method: 'POST',
      headers: {
        'Cookie': cookieString,
        'x-csrf-token': csrfToken,
        'x-requested-with': 'XMLHttpRequest',
        'Referer': 'https://mysimkari.kejaksaan.go.id/dashboard-utama/pegawai'
      },
      body: payload as any
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 419) {
        db?.prepare('DELETE FROM settings WHERE key = ?').run('session') // Session expired
      }
      console.error('Sync failed with status:', response.status, await response.text())
      return false
    }

    db?.prepare('UPDATE documents SET parsed_name = ?, parsed_desc = ?, parsed_date = ?, status = ? WHERE path = ?').run(
      formData.name, formData.description, formData.date, 'synced', path
    )
    return true
  } catch (error) {
    console.error('Sync error:', error)
    return false
  }
})
