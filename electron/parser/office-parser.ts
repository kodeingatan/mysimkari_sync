import * as fs from 'fs'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import mammoth from 'mammoth'

const execFileAsync = promisify(execFile)

export async function parseOffice(ext: string, filePath: string): Promise<string> {
  if (ext === 'doc') {
    const convertedPath = await convertDocToDocx(filePath)
    const result = await mammoth.extractRawText({ path: convertedPath })

    if (convertedPath !== filePath && fs.existsSync(convertedPath)) {
      fs.unlinkSync(convertedPath)
    }

    return result.value || ''
  }

  const result = await mammoth.extractRawText({ path: filePath })
  return result.value || ''
}

async function convertDocToDocx(filePath: string): Promise<string> {
  const outputDir = path.dirname(filePath)
  const outputPath = path.join(
    outputDir,
    `${path.basename(filePath, path.extname(filePath))}.docx`,
  )

  const escapedPath = filePath.replace(/"/g, '`"')
  const escapedOut = outputPath.replace(/"/g, '`"')

  const script = `
    try {
      $word = New-Object -ComObject Word.Application
      $word.Visible = $false
      $doc = $word.Documents.Open("${escapedPath}")
      $doc.SaveAs2("${escapedOut}", 16)
      $doc.Close()
      $word.Quit()
      Write-Output "success"
    } catch {
      Write-Output "error"
    }
  `

  const scriptPath = path.join(outputDir, `convert_doc_${Date.now()}.ps1`)
  fs.writeFileSync(scriptPath, script, 'utf8')

  try {
    await execFileAsync('powershell', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
    ])
  } finally {
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath)
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error(`Gagal mengkonversi DOC ke DOCX: ${filePath}`)
  }

  return outputPath
}
