import sharp from 'sharp'
import Tesseract from 'tesseract.js'
import { TESS_LANGS, getTesseractOptions } from './tesseract-config'

export async function ocrImage(filePath: string): Promise<string> {
  let worker: Awaited<ReturnType<typeof Tesseract.createWorker>> | null = null

  try {
    let input: string | Buffer = filePath
    try {
      input = await sharp(filePath, { animated: false })
        .rotate()
        .resize({ width: 2500, withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer()
    } catch {
      // Fallback: biarkan tesseract membaca file asli (mis. format tak didukung sharp)
      input = filePath
    }

    worker = await Tesseract.createWorker(TESS_LANGS, undefined, getTesseractOptions())
    const result = await worker.recognize(input)
    return result.data.text || ''
  } catch (error) {
    console.error(`OCR error ${filePath}:`, error)
    return ''
  } finally {
    if (worker) {
      await worker.terminate()
    }
  }
}
