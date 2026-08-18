import { app, BrowserWindow, ipcMain, dialog, session, shell } from 'electron'
import { join, dirname, basename, extname } from 'path'
import * as fs from 'fs'
import { exec, spawn } from 'child_process'
import Database from 'better-sqlite3'
import { parseDocument } from './parser'
import { getBinaryPath } from './binManager'

let mainWindow: BrowserWindow | null = null
let db: Database.Database | null = null

// Define paths
const DIST = join(__dirname, '../dist')
const DIST_ELECTRON = join(__dirname, '../dist-electron')
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const DB_PATH = join(app.getPath('userData'), 'mysimkari.sqlite')

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
  // Add raw_text column if missing (for existing DBs)
  try { db.exec(`ALTER TABLE documents ADD COLUMN raw_text TEXT`) } catch {}
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
  const fileTree = readDirRecursive(folderPath)
  return { folderPath, fileTree }
})

ipcMain.handle('read-folder', async (_event, folderPath: string) => {
  if (!fs.existsSync(folderPath)) return null
  return readDirRecursive(folderPath)
})

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
      const ext = extname(fullPath).toLowerCase().replace('.', '')
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

ipcMain.handle('parse-file', async (_event, path: string, type: string) => {
  const parsedData = await parseDocument(path, type)
  db?.prepare('UPDATE documents SET parsed_name = ?, parsed_desc = ?, parsed_date = ?, raw_text = ?, status = ? WHERE path = ?').run(
    parsedData.name, parsedData.description, parsedData.date, parsedData.rawText || '', 'ready', path
  )
  return parsedData
})

ipcMain.handle('check-session', () => {
  const sessionRow = db?.prepare('SELECT value FROM settings WHERE key = ?').get('session') as any
  return !!sessionRow
})

ipcMain.handle('login-mysimkari', () => {
  return new Promise<boolean>((resolve) => {
    let resolved = false

    const finish = (value: boolean) => {
      if (!resolved) {
        resolved = true
        resolve(value)
      }
    }

    const authWindow = new BrowserWindow({
      width: 800,
      height: 700,
      parent: mainWindow!,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:mysimkari'
      }
    })

    authWindow.loadURL('https://mysimkari.kejaksaan.go.id/')

    const checkUrl = async (url: string) => {
      try {
        if (!url.includes('/pegawai/edit')) return

        let uniqueuserid: string | null = null

        const match = url.match(/\/pegawai\/edit\/([^\/?#]+)/)

        if (match) {
          uniqueuserid = match[1]

          db?.prepare(`
            INSERT OR REPLACE INTO settings (key, value)
            VALUES (?, ?)
          `).run('uniqueuserid', uniqueuserid)
        }

        const ses = session.fromPartition('persist:mysimkari')

        const cookies = await ses.cookies.get({
          url: 'https://mysimkari.kejaksaan.go.id'
        })

        db?.prepare(`
          INSERT OR REPLACE INTO settings (key, value)
          VALUES (?, ?)
        `).run('session', JSON.stringify(cookies))

        if (uniqueuserid && cookies.length > 0) {
          const cookieString = cookies
            .map((c) => `${c.name}=${c.value}`)
            .join('; ')

          try {
            const resp = await fetch(
              `https://mysimkari.kejaksaan.go.id/pegawai/edit/${uniqueuserid}`,
              {
                headers: {
                  Cookie: cookieString
                }
              }
            )

            const html = await resp.text()

            const nipMatch = html.match(
              /<input[^>]*name="nip"[^>]*value="([^"]*)"/i
            )

            if (nipMatch) {
              const nip = nipMatch[1]

              db?.prepare(`
                INSERT OR REPLACE INTO settings (key, value)
                VALUES (?, ?)
              `).run('nip', nip)
            }
          } catch (err) {
            console.error('Failed to fetch NIP:', err)
          }
        }

        authWindow.close()

        finish(true)
      } catch (err) {
        console.error(err)
        finish(false)
      }
    }

    authWindow.webContents.on('did-navigate', (_, url) => {
      checkUrl(url)
    })

    authWindow.webContents.on('did-redirect-navigation', (_, url) => {
      checkUrl(url)
    })

    authWindow.on('closed', () => {
      finish(false)
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
      mtime: stats.mtime.toISOString().split('T')[0],
      size: stats.size
    }
  } catch (error) {
    return null
  }
})

ipcMain.handle('sync-data', async (_event, path: string, formData: any) => {
  const sessionRow = db?.prepare('SELECT value FROM settings WHERE key = ?').get('session') as any
  const nipRow = db?.prepare('SELECT value FROM settings WHERE key = ?').get('nip') as any
  if (!sessionRow || !nipRow) return false

  const cookies = JSON.parse(sessionRow.value)
  const cookieString = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ')
  const nip = nipRow.value

  let processedPath = path
  let isTempFile = false

  try {
    // 1. Prepare/Compress file
    const result = await prepareFileForSync(path)
    processedPath = result.path
    isTempFile = result.isTemp

    // 2. Fetch page to extract raw CSRF token
    const userRow = db?.prepare('SELECT value FROM settings WHERE key = ?').get('uniqueuserid') as any
    if (!userRow) return false
    const uniqueuserid = userRow.value
    const getResp = await fetch(`https://mysimkari.kejaksaan.go.id/pegawai/edit/${uniqueuserid}`, {
      headers: { 'Cookie': cookieString }
    })

    const html = await getResp.text()
    const tokenMatch = html.match(/<meta name="csrf-token" content="([^"]+)">/)
    const csrfToken = tokenMatch ? tokenMatch[1] : ''

    // 3. Prepare Payload
    const fileBuffer = fs.readFileSync(processedPath)
    const fileBlob = new Blob([fileBuffer])
    let fileName = basename(path)

    // If converted to PDF (isTempFile), update extension to .pdf
    if (isTempFile) {
      fileName = fileName.replace(/\.[^/.]+$/, "") + ".pdf"
    }

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
    payload.append('nip', nip)

    // 4. Send POST Request
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

    // Clean up temp file if created
    if (isTempFile && fs.existsSync(processedPath)) {
      try { fs.unlinkSync(processedPath) } catch (e) { }
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 419) {
        db?.prepare('DELETE FROM settings WHERE key = ?').run('session')
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
    if (isTempFile && fs.existsSync(processedPath)) {
      try { fs.unlinkSync(processedPath) } catch (e) { }
    }
    return false
  }
})

ipcMain.handle('get-sync-history', async () => {
  const sessionRow = db?.prepare('SELECT value FROM settings WHERE key = ?').get('session') as any
  const nipRow = db?.prepare('SELECT value FROM settings WHERE key = ?').get('nip') as any

  if (!sessionRow || !nipRow) return null

  const cookies = JSON.parse(sessionRow.value)
  const cookieString = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ')
  const nip = nipRow.value

  try {
    const response = await fetch(`https://mysimkari.kejaksaan.go.id/get-kinerja/${nip}/all/data`, {
      headers: {
        'Cookie': cookieString,
        'x-requested-with': 'XMLHttpRequest',
        'Referer': 'https://mysimkari.kejaksaan.go.id/dashboard-utama/pegawai'
      }
    })

    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('Error fetching sync history:', error)
    return null
  }
})

ipcMain.handle('save-setting', (_event, key: string, value: string) => {
  db?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  return true
})

ipcMain.handle('get-setting', (_event, key: string) => {
  const row = db?.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any
  return row ? row.value : null
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
  const dir = dirname(filePath)
  const name = basename(filePath, extname(filePath))
  const outPath = join(dir, `${name}_compressed.pdf`)

  const result = await compressPdfInternal(filePath, outPath)
  if (result === 'FALLBACK') {
    return await runWordFallback(filePath, outPath)
  }
  return result
})

ipcMain.handle('convert-to-pdf', async (_event, filePath: string) => {
  const dir = dirname(filePath)
  const name = basename(filePath, extname(filePath))
  const outPath = join(dir, `${name}_outpdf.pdf`)
  return await convertToPdfInternal(filePath, outPath)
})

// --- AI Settings & Generation ---

ipcMain.handle('save-ai-settings', (_event, settings: {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
  systemPrompt: string
  temperature: number
  maxTokens: number
}) => {
  const upsert = db?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  upsert?.run('ai_provider', settings.provider)
  upsert?.run('ai_api_key', settings.apiKey)
  upsert?.run('ai_model', settings.model)
  upsert?.run('ai_base_url', settings.baseUrl)
  upsert?.run('ai_system_prompt', settings.systemPrompt)
  upsert?.run('ai_temperature', settings.temperature.toString())
  upsert?.run('ai_max_tokens', settings.maxTokens.toString())
  return true
})

ipcMain.handle('get-ai-settings', () => {
  const get = (key: string) => {
    const row = db?.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any
    return row ? row.value : ''
  }
  return {
    provider: get('ai_provider'),
    apiKey: get('ai_api_key'),
    model: get('ai_model'),
    baseUrl: get('ai_base_url'),
    systemPrompt: get('ai_system_prompt'),
    temperature: parseFloat(get('ai_temperature') || '0.7'),
    maxTokens: parseInt(get('ai_max_tokens') || '1024')
  }
})

ipcMain.handle('test-ai-connection', async (_event, settings: {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}) => {
  try {
    if (settings.provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${settings.apiKey}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { success: false, error: err?.error?.message || `HTTP ${res.status}` }
      }
      const data = await res.json() as any
      const models = (data.models || []).map((m: any) => m.name.replace('models/', ''))
      return { success: true, models }
    } else {
      // OpenAI-compatible
      const baseUrl = settings.baseUrl.replace(/\/+$/, '')
      const res = await fetch(`${baseUrl}/v1/models`, {
        headers: { 'Authorization': `Bearer ${settings.apiKey}` }
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { success: false, error: err?.error?.message || `HTTP ${res.status}` }
      }
      const data = await res.json() as any
      const models = (data.data || []).map((m: any) => m.id)
      return { success: true, models }
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Connection failed' }
  }
})

ipcMain.handle('generate-ai', async (_event, payload: {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  fileText: string
  tipeKegiatan: string
  kategoriKegiatan: string
  indikatorKinerja: string
  sasaranKinerja: string
  target: 'name' | 'description' | 'both'
}) => {
  try {
    const contextBlock = `Konteks Form:
- Tipe Kegiatan: ${payload.tipeKegiatan || '(belum dipilih)'}
- Kategori: ${payload.kategoriKegiatan || '(belum dipilih)'}
- Indikator: ${payload.indikatorKinerja || '(belum dipilih)'}
- Sasaran: ${payload.sasaranKinerja || '(belum dipilih)'}`

    let userPrompt = ''
    if (payload.target === 'name') {
      userPrompt = `${contextBlock}

Isi Dokumen:
${payload.fileText.substring(0, 4000)}

Buatkan nama kegiatan yang singkat dan formal (maksimal 100 karakter). Tulis hanya nama kegiatannya saja, tanpa penjelasan tambahan.`
    } else if (payload.target === 'description') {
      userPrompt = `${contextBlock}

Isi Dokumen:
${payload.fileText.substring(0, 4000)}

Buatkan deskripsi kegiatan yang detail dan formal (maksimal 300 karakter). Tulis hanya deskripsi kegiatannya saja, tanpa penjelasan tambahan.`
    } else {
      userPrompt = `${contextBlock}

Isi Dokumen:
${payload.fileText.substring(0, 4000)}

Buatkan nama kegiatan (maksimal 100 karakter) dan deskripsi kegiatan (maksimal 300 karakter). Format jawaban:
NAMA: [nama kegiatan]
DESKRIPSI: [deskripsi kegiatan]`
    }

    const defaultSystem = `Saya adalah seorang pegawai administrasi di Kejaksaan Negeri PIDIE. Bantu saya menyusun format berikut berdasarkan dokumen yang saya berikan.`
    const systemPrompt = payload.systemPrompt || defaultSystem

    let result: { name?: string, description?: string } = {}

    if (payload.provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${payload.model}:generateContent?key=${payload.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              temperature: payload.temperature,
              maxOutputTokens: payload.maxTokens
            }
          })
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { error: err?.error?.message || `Gemini API error: ${res.status}` }
      }
      const data = await res.json() as any
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      result = parseAiResponse(text, payload.target)
    } else {
      // OpenAI-compatible
      const baseUrl = payload.baseUrl.replace(/\/+$/, '')
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${payload.apiKey}`
        },
        body: JSON.stringify({
          model: payload.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: payload.temperature,
          max_tokens: payload.maxTokens
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { error: err?.error?.message || `API error: ${res.status}` }
      }
      const data = await res.json() as any
      const text = data?.choices?.[0]?.message?.content || ''
      result = parseAiResponse(text, payload.target)
    }

    return result
  } catch (err: any) {
    return { error: err.message || 'AI generation failed' }
  }
})

function parseAiResponse(text: string, target: string): { name?: string, description?: string } {
  const cleaned = text.trim()
  if (target === 'both') {
    const nameMatch = cleaned.match(/NAMA:\s*(.+)/i)
    const descMatch = cleaned.match(/DESKRIPSI:\s*(.+)/i)
    return {
      name: nameMatch ? nameMatch[1].trim().substring(0, 100) : cleaned.substring(0, 100),
      description: descMatch ? descMatch[1].trim().substring(0, 300) : cleaned.substring(0, 300)
    }
  }
  if (target === 'name') {
    return { name: cleaned.substring(0, 100) }
  }
  return { description: cleaned.substring(0, 300) }
}

ipcMain.handle('get-file-text', async (_event, filePath: string) => {
  try {
    const row = db?.prepare('SELECT raw_text FROM documents WHERE path = ?').get(filePath) as any
    return row?.raw_text || ''
  } catch {
    return ''
  }
})

// --- Internal Helper Functions ---

async function prepareFileForSync(filePath: string): Promise<{ path: string, isTemp: boolean }> {
  const MAX_SIZE = 500 * 1024 // 500KB
  let currentPath = filePath
  let isTemp = false
  const ext = extname(filePath).toLowerCase().replace('.', '')

  try {
    // 1. Convert to PDF if not already
    if (ext !== 'pdf') {
      const pdfPath = join(app.getPath('temp'), `sync_${Date.now()}.pdf`)
      const success = await convertToPdfInternal(filePath, pdfPath)
      if (success) {
        currentPath = pdfPath
        isTemp = true
      }
    }

    // 2. Check size and compress if needed
    let stats = fs.statSync(currentPath)
    if (stats.size > MAX_SIZE) {
      // Stage 1: /ebook (150dpi)
      const compressedPath = join(app.getPath('temp'), `comp_ebook_${Date.now()}.pdf`)
      let result = await compressPdfInternal(currentPath, compressedPath, '/ebook')

      if (result === 'FALLBACK') {
        result = await runWordFallback(currentPath, compressedPath)
      }

      if (result === true && fs.existsSync(compressedPath)) {
        let compStats = fs.statSync(compressedPath)

        // If still too big, Stage 2: /screen (72dpi)
        if (compStats.size > MAX_SIZE) {
          const aggressivePath = join(app.getPath('temp'), `comp_screen_${Date.now()}.pdf`)
          let aggResult = await compressPdfInternal(currentPath, aggressivePath, '/screen')

          if (aggResult === true && fs.existsSync(aggressivePath)) {
            if (isTemp) fs.unlinkSync(currentPath)
            if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath)
            currentPath = aggressivePath
            isTemp = true
          } else {
            // Keep the ebook version if screen failed
            if (isTemp) fs.unlinkSync(currentPath)
            currentPath = compressedPath
            isTemp = true
          }
        } else {
          if (isTemp) fs.unlinkSync(currentPath)
          currentPath = compressedPath
          isTemp = true
        }
      }
    }

    return { path: currentPath, isTemp }
  } catch (err) {
    console.error('Error in prepareFileForSync:', err)
    return { path: filePath, isTemp: false }
  }
}

async function compressPdfInternal(filePath: string, outPath: string, quality: string = '/ebook'): Promise<boolean | 'FALLBACK'> {
  const gsCommand = getBinaryPath('ghostscript')
  return new Promise((resolve) => {
    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=${quality}`,
      '-dNOPAUSE',
      '-dBATCH',
      `-sOutputFile=${outPath}`,
      filePath
    ]
    const proc = spawn(gsCommand, args)
    proc.on('error', (err: any) => {
      if (err.code === 'ENOENT') resolve('FALLBACK')
      else resolve(false)
    })
    proc.on('close', (code) => {
      resolve(code === 0)
    })
  })
}

async function runWordFallback(filePath: string, outPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const scriptPath = join(app.getPath('temp'), `compress_fallback_${Date.now()}.ps1`)
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
    `
    fs.writeFileSync(scriptPath, script, 'utf8')
    exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`, (err, stdout) => {
      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath)
      resolve(!err && stdout.includes("success"))
    })
  })
}

async function convertToPdfInternal(filePath: string, outPath: string): Promise<boolean> {
  const ext = extname(filePath).toLowerCase().replace('.', '')
  let script = ""
  const escapedIn = filePath.replace(/"/g, '`"')
  const escapedOut = outPath.replace(/"/g, '`"')

  if (['doc', 'docx'].includes(ext)) {
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
    `
  } else if (['xls', 'xlsx'].includes(ext)) {
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
    `
  } else if (['ppt', 'pptx'].includes(ext)) {
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
    `
  }

  if (!script) return false

  const scriptPath = join(app.getPath('temp'), `convert_${Date.now()}.ps1`)
  fs.writeFileSync(scriptPath, script, 'utf8')

  return new Promise((resolve) => {
    exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`, (err, stdout) => {
      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath)
      resolve(!err && stdout.includes("success"))
    })
  })
}
