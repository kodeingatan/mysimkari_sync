import * as fs from 'fs'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import * as xlsx from 'xlsx'
import officeParser from 'officeparser'

export interface ParsedData {
  name: string
  description: string
  date: string
}

export async function parseDocument(filePath: string, fileType: string): Promise<ParsedData> {
  let text = ''

  try {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        const pdfBuffer = fs.readFileSync(filePath)
        const pdfData = await pdfParse(pdfBuffer)
        text = pdfData.text
        break
      case 'doc':
      case 'docx':
        const docxResult = await mammoth.extractRawText({ path: filePath })
        text = docxResult.value
        break
      case 'xls':
      case 'xlsx':
        const workbook = xlsx.readFile(filePath)
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        text = xlsx.utils.sheet_to_txt(worksheet)
        break
      case 'ppt':
      case 'pptx':
        // using officeparser for pptx
        text = await new Promise((resolve, reject) => {
          officeParser.parseOffice(filePath, (data: any, err: any) => {
            if (err) return reject(err)
            resolve(String(data) || '')
          })
        })
        break
      default:
        text = ''
    }
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error)
  }

  return extractInfoFromText(text)
}

function extractInfoFromText(text: string): ParsedData {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  // Simple heuristic for Name: First non-empty line, or 'Unknown Activity'
  const name = lines.length > 0 ? lines[0].substring(0, 100) : 'Unknown Activity'
  
  // Heuristic for Description: Lines after the first one
  const description = lines.length > 1 ? lines.slice(1, 5).join(' ').substring(0, 300) : 'No description found.'

  // Heuristic for Date: Find something that looks like DD/MM/YYYY, YYYY-MM-DD or similar
  const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/
  const dateMatch = text.match(dateRegex)
  
  let dateStr = new Date().toISOString().split('T')[0] // default today
  
  if (dateMatch) {
    // Basic normalization, ideally use date-fns or similar
    dateStr = dateMatch[0].replace(/\//g, '-')
  }

  return { name, description, date: dateStr }
}
