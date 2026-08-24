import { ParsedData } from './parser/types'
import { normalizeExt, extractInfoFromText, IMAGE_EXTS, OFFICE_EXTS, SPREADSHEET_EXTS, PRESENTATION_EXTS } from './parser/utils'
import { parsePdf } from './parser/pdf-parser'
import { parseOffice } from './parser/office-parser'
import { parseSpreadsheet } from './parser/spreadsheet-parser'
import { parsePresentation } from './parser/presentation-parser'
import { ocrImage } from './parser/image-ocr'

export type { ParsedData } from './parser/types'

export async function parseDocument(filePath: string, fileType?: string): Promise<ParsedData> {
  const ext = normalizeExt(filePath, fileType)
  let text = ''

  try {
    if (ext === 'pdf') {
      text = await parsePdf(filePath)
    } else if (OFFICE_EXTS.includes(ext)) {
      text = await parseOffice(ext, filePath)
    } else if (SPREADSHEET_EXTS.includes(ext)) {
      text = await parseSpreadsheet(filePath)
    } else if (PRESENTATION_EXTS.includes(ext)) {
      text = await parsePresentation(filePath)
    } else if (IMAGE_EXTS.includes(ext)) {
      text = await ocrImage(filePath)
    }
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error)
  }

  const info = extractInfoFromText(text)
  return { ...info, rawText: text.substring(0, 8000) }
}
