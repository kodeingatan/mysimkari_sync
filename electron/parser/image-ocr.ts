import sharp from 'sharp'
import Tesseract from 'tesseract.js'

export async function ocrImage(filePath: string): Promise<string> {
  let worker: Awaited<ReturnType<typeof Tesseract.createWorker>> | null = null

  try {
    const processedBuffer = await sharp(filePath)
      .rotate()
      .resize({ width: 2500, withoutEnlargement: false })
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer()

    worker = await Tesseract.createWorker('ind+eng')
    const result = await worker.recognize(processedBuffer)
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
