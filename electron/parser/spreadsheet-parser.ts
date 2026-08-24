import * as xlsx from 'xlsx'

export async function parseSpreadsheet(filePath: string): Promise<string> {
  const workbook = xlsx.readFile(filePath)
  const sheetTexts: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) continue

    const sheetText = xlsx.utils.sheet_to_txt(worksheet)
    sheetTexts.push(`=== SHEET: ${sheetName} ===\n${sheetText}`)
  }

  return sheetTexts.join('\n\n')
}
