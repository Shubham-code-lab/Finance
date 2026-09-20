import Papa from 'papaparse'

export type ParsedSheet = { headers: string[]; rows: Record<string, string | number | null>[] }

function scalarCell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export async function parseImportFile(file: File): Promise<ParsedSheet> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => resolve({ headers: result.meta.fields ?? [], rows: result.data }),
        error: reject,
      })
    })
  }
  return parseXlsxBlob(file)
}

export async function parseXlsxBlob(blob: Blob): Promise<ParsedSheet> {
  const { default: readXlsxFile } = await import('read-excel-file')
  const sheet = await readXlsxFile(blob)
  const headerValues = sheet[0] ?? []
  const headers = headerValues.map((value: unknown) => String(value ?? '').trim()).filter(Boolean)
  const rows: Record<string, string | number | null>[] = []
  sheet.slice(1).forEach((row) => {
    const record: Record<string, string | number | null> = {}
    headers.forEach((header: string, index: number) => {
      record[header] = scalarCell(row[index])
    })
    rows.push(record)
  })
  return { headers: rows.length ? Object.keys(rows[0]) : [], rows }
}
