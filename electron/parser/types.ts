export interface ParsedData {
  name: string
  description: string
  date: string
  rawText: string
}

export type SupportedExtension =
  | 'pdf'
  | 'doc' | 'docx'
  | 'xls' | 'xlsx'
  | 'ppt' | 'pptx'
  | 'jpg' | 'jpeg' | 'png'
  | 'bmp' | 'tiff' | 'tif'
  | 'webp' | 'gif'
