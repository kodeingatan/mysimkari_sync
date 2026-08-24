import * as fs from 'fs'
import pdfParse from 'pdf-parse'
import Tesseract from 'tesseract.js'

export async function parsePdf(filePath: string): Promise<string> {
  const pdfBuffer = fs.readFileSync(filePath)
  const pdfData = await pdfParse(pdfBuffer)
  const text = pdfData.text || ''

  if (text.trim().length < 50) {
    return await ocrPdf(filePath)
  }

  return text
}

async function ocrPdf(filePath: string): Promise<string> {
  let worker: Awaited<ReturnType<typeof Tesseract.createWorker>> | null = null

  try {
    worker = await Tesseract.createWorker('ind+eng')
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
