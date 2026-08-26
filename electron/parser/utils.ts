import * as path from 'path'

export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp', 'gif']
export const OFFICE_EXTS = ['doc', 'docx']
export const SPREADSHEET_EXTS = ['xls', 'xlsx']
export const PRESENTATION_EXTS = ['ppt', 'pptx']
export const TEXT_EXTS = ['txt']

export function normalizeExt(filePath: string, fileType?: string): string {
  const ext = (fileType || path.extname(filePath)).toLowerCase().replace('.', '')
  return ext
}

export function extractInfoFromText(text: string): { name: string; description: string; date: string } {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)

  const name = lines.length > 0 ? lines[0].substring(0, 100) : 'Unknown Activity'
  const description = lines.length > 1 ? lines.slice(1, 5).join(' ').substring(0, 300) : 'No description found.'

  const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/
  const dateMatch = text.match(dateRegex)
  let dateStr = new Date().toISOString().split('T')[0]

  if (dateMatch) {
    dateStr = dateMatch[0].replace(/\//g, '-')
  }

  return { name, description, date: dateStr }
}
