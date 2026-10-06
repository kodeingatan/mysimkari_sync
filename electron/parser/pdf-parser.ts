import * as fs from 'fs'
import pdfParse from 'pdf-parse'
import Tesseract from 'tesseract.js'
import { TESS_LANGS, getTesseractOptions } from './tesseract-config'

export async function parsePdf(filePath: string): Promise<string> {
  const pdfBuffer = fs.readFileSync(filePath)
  // pdf.js logs harmless font quirks (missing glyf table, TT bytecode ops)
  // via console.log; parsing itself continues fine.
  const pdfData = await suppressPdfJsFontWarnings(() => pdfParse(pdfBuffer))
  const text = pdfData.text || ''

  if (text.trim().length < 50) {
    return await ocrPdf(filePath)
  }

  return text
}

const PDFJS_FONT_WARNING_PATTERNS = [/^Warning:\s*TT:/, /glyf.*not found/i]

/** Run fn while swallowing known-harmless pdf.js font warnings. */
export async function suppressPdfJsFontWarnings<T>(fn: () => Promise<T>): Promise<T> {
  const originalLog = console.log
  console.log = (...args: unknown[]) => {
    const first = args.length > 0 ? String(args[0]) : ''
    if (PDFJS_FONT_WARNING_PATTERNS.some((re) => re.test(first))) return
    originalLog(...args)
  }
  try {
    return await fn()
  } finally {
    console.log = originalLog
  }
}

async function ocrPdf(filePath: string): Promise<string> {
  let worker: Awaited<ReturnType<typeof Tesseract.createWorker>> | null = null

  try {
    worker = await Tesseract.createWorker(TESS_LANGS, undefined, getTesseractOptions())
    const result = await worker.recognize(filePath)
    return result.data.text || ''
  } catch (error) {
    console.error(`PDF OCR error ${filePath}:`, error)
    return ''
  } finally {
    if (worker) {
      await worker.terminate()
    }
  }
}
