import officeParser from 'officeparser'

export async function parsePresentation(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    officeParser.parseOffice(filePath, (data: any, err: any) => {
      if (err) return reject(err)
      resolve(String(data) || '')
    })
  })
}
