import { app, BrowserWindow, ipcMain, dialog, session, shell } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { exec } from 'child_process'
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

ipcMain.handle('get-form-options', async () => {
  const sessionRow = db?.prepare('SELECT value FROM settings WHERE key = ?').get('session') as any
  const userRow = db?.prepare('SELECT value FROM settings WHERE key = ?').get('uniqueuserid') as any
  
  if (!sessionRow || !userRow) return null

  const cookies = JSON.parse(sessionRow.value)
  const cookieString = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ')

  try {
    const response = await fetch(`https://mysimkari.kejaksaan.go.id/dashboard-utama/pegawai/${userRow.value}`, {
      headers: { 'Cookie': cookieString }
    })
    const html = await response.text()

    const extractOptions = (id: string) => {
      const selectMatch = html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`))
      if (!selectMatch) return []
      
      const options = []
      const optionRegex = /<option[^>]*value="([^"]*)"(?:[^>]*data-kegiatan-saya="([^"]*)")?[^>]*>([\s\S]*?)<\/option>/g
      let match
      while ((match = optionRegex.exec(selectMatch[1])) !== null) {
        if (match[1]) { // ignore empty value (placeholder)
          options.push({
            value: match[1],
            label: match[3].trim(),
            sasaran: match[2] || ''
          })
        }
      }
      return options
    }

    return {
      tipe: extractOptions('tipekegiatan'),
      kategori: extractOptions('kaitan_kegiatan'),
      indikator: extractOptions('indikatorkinerja')
    }
  } catch (error) {
    console.error('Error crawling form options:', error)
    return null
  }
})

ipcMain.handle('get-file-stats', async (_event, path: string) => {
  try {
    const stats = fs.statSync(path)
    return {
      mtime: stats.mtime.toISOString().split('T')[0]
    }
  } catch (error) {
    return null
  }
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
    payload.append('tipe_kegiatan', formData.tipe_kegiatan)
    payload.append('kaitan_kegiatan', formData.kaitan_kegiatan)
    payload.append('id_indikator', formData.id_indikator)
    payload.append('sasaran_kegiatan', formData.sasaran_kegiatan)
    payload.append('nama_kegiatan', formData.name)
    payload.append('desc_kegiatan', formData.description)
    payload.append('tanggal_kegiatan', formData.date)
    payload.append('menit', formData.menit?.toString() || '420')
    payload.append('file', fileBlob, fileName)
    payload.append('nip', '199810232022031012') // Tetap gunakan NIP contoh jika tidak ada di session

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

ipcMain.handle('open-file', async (_event, path: string) => {
  return await shell.openPath(path)
})

ipcMain.handle('open-with-dialog', async (_event, path: string) => {
  const openWithPath = join(process.env.SystemRoot || 'C:\\Windows', 'System32\\OpenWith.exe')
  exec(`"${openWithPath}" "${path}"`)
})

ipcMain.handle('show-item-in-folder', async (_event, path: string) => {
  shell.showItemInFolder(path)
})

ipcMain.handle('get-associated-apps', async (_event, ext: string) => {
  if (process.platform !== 'win32') return []
  
  const cleanExt = ext.startsWith('.') ? ext : `.${ext}`
  
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
      }
      $apps | Select-Object -Unique | Where-Object { $_ -match "\\.exe$" } | ConvertTo-Json
    `;
    
    exec(`powershell -Command "${script.replace(/\n/g, ' ')}"`, (error, stdout) => {
      if (error || !stdout) {
        // Last resort fallback if PS fails
        const fallback = [];
        if (cleanExt === ".pdf") fallback.push("msedge.exe", "chrome.exe");
        resolve(fallback);
        return;
      }
      try {
        const result = JSON.parse(stdout)
        const appsArray = Array.isArray(result) ? result : [result]
        resolve(appsArray.filter(Boolean))
      } catch {
        resolve([])
      }
    })
  })
})

ipcMain.handle('open-with-app', async (_event, path: string, app: string) => {
  exec(`start "" "${app}" "${path}"`)
})

ipcMain.handle('compress-pdf', async (_event, filePath: string) => {
  const dir = filePath.substring(0, filePath.lastIndexOf('\\'))
  const ext = filePath.split('.').pop()
  const name = filePath.substring(filePath.lastIndexOf('\\') + 1, filePath.lastIndexOf('.'))
  const outPath = join(dir, `${name}_compress.${ext}`)

  const scriptPath = join(app.getPath('temp'), `compress_${Date.now()}.ps1`)
  const script = `
    try {
      $word = New-Object -ComObject Word.Application
      if ($null -eq $word) { throw "Could not create Word object" }
      $word.Visible = $false
      $doc = $word.Documents.Open("${filePath.replace(/"/g, '`"')}", $false, $true)
      if ($null -eq $doc) { throw "Could not open document" }
      $doc.ExportAsFixedFormat("${outPath.replace(/"/g, '`"')}", 17, $false, 1)
      $doc.Close(0)
      $word.Quit()
      Write-Output "success"
    } catch {
      Write-Output "Error: $($_.Exception.Message)"
      if ($word) { $word.Quit() }
    }
  `
  
  fs.writeFileSync(scriptPath, script, 'utf8')

  return new Promise((resolve) => {
    exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`, (err, stdout) => {
      fs.unlinkSync(scriptPath) // Clean up
      if (err || !stdout.includes("success")) {
        console.error("Compression failed:", stdout)
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
})

ipcMain.handle('convert-to-pdf', async (_event, filePath: string) => {
  const dir = filePath.substring(0, filePath.lastIndexOf('\\'))
  const name = filePath.substring(filePath.lastIndexOf('\\') + 1, filePath.lastIndexOf('.'))
  const ext = filePath.split('.').pop()?.toLowerCase()
  const outPath = join(dir, `${name}_outpdf.pdf`)

  let script = ""
  const escapedIn = filePath.replace(/"/g, '`"')
  const escapedOut = outPath.replace(/"/g, '`"')
  
  if (['doc', 'docx'].includes(ext || '')) {
    script = `
      try {
        $word = New-Object -ComObject Word.Application
        if ($null -eq $word) { throw "Word not found" }
        $word.Visible = $false
        $doc = $word.Documents.Open("${escapedIn}")
        if ($null -eq $doc) { throw "Failed to open document" }
        $doc.ExportAsFixedFormat("${escapedOut}", 17)
        $doc.Close(0)
        $word.Quit()
        Write-Output "success"
      } catch { 
        Write-Output "Error: $($_.Exception.Message)"
        if ($word) { $word.Quit() }
      }
    `
  } else if (['xls', 'xlsx'].includes(ext || '')) {
    script = `
      try {
        $excel = New-Object -ComObject Excel.Application
        if ($null -eq $excel) { throw "Excel not found" }
        $excel.Visible = $false
        $wb = $excel.Workbooks.Open("${escapedIn}")
        if ($null -eq $wb) { throw "Failed to open workbook" }
        $wb.ExportAsFixedFormat(0, "${escapedOut}")
        $wb.Close($false)
        $excel.Quit()
        Write-Output "success"
      } catch { 
        Write-Output "Error: $($_.Exception.Message)"
        if ($excel) { $excel.Quit() }
      }
    `
  } else if (['ppt', 'pptx'].includes(ext || '')) {
    script = `
      try {
        $ppt = New-Object -ComObject PowerPoint.Application
        if ($null -eq $ppt) { throw "PowerPoint not found" }
        $pres = $ppt.Presentations.Open("${escapedIn}", -1, 0, 0)
        if ($null -eq $pres) { throw "Failed to open presentation" }
        $pres.SaveAs("${escapedOut}", 32)
        $pres.Close()
        $ppt.Quit()
        Write-Output "success"
      } catch { 
        Write-Output "Error: $($_.Exception.Message)"
        if ($ppt) { $ppt.Quit() }
      }
    `
  }

  if (!script) return false

  const scriptPath = join(app.getPath('temp'), `convert_${Date.now()}.ps1`)
  fs.writeFileSync(scriptPath, script, 'utf8')

  return new Promise((resolve) => {
    exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`, (err, stdout) => {
      fs.unlinkSync(scriptPath) // Clean up
      if (err || !stdout.includes("success")) {
        console.error("Conversion failed:", stdout)
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
})
