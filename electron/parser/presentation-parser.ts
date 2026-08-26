import officeParser from 'officeparser'

export async function parsePresentation(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    officeParser.parseOffice(filePath, (result: any, err: any) => {
      if (err) return reject(err)
      if (typeof result === 'string') return resolve(result)
      if (result && typeof result.toText === 'function') {
        return resolve(result.toText())
      }
      resolve('')
    })
  })
}
