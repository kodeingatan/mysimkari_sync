import * as xlsx from 'xlsx'

export async function parseSpreadsheet(filePath: string): Promise<string> {
  const workbook = xlsx.readFile(filePath)
  const sheetTexts: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) continue

    const csv = xlsx.utils.sheet_to_csv(worksheet)
    sheetTexts.push(`=== SHEET: ${sheetName} ===\n${csv}`)
  }

  return sheetTexts.join('\n\n')
}
