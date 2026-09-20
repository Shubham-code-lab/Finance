import { strFromU8, unzipSync } from 'fflate'

export type WorkbookRow = { rowNumber: number; values: (string | number | null)[] }
export type WorkbookSheet = { name: string; rows: WorkbookRow[] }

function decodeXml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function columnIndex(column: string) {
  let index = 0
  for (const char of column) index = index * 26 + char.charCodeAt(0) - 64
  return index - 1
}

function parseScalar(value: string | null) {
  if (value === null || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) && String(numeric) === value ? numeric : decodeXml(value)
}

function cellValue(cellXml: string, sharedStrings: string[]) {
  const type = cellXml.match(/ t="([^"]+)"/)?.[1]
  const raw = cellXml.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1] ?? null
  if (type === 's') return sharedStrings[Number(raw)] ?? ''
  if (type === 'inlineStr') return decodeXml(cellXml.match(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/)?.[1] ?? '')
  if (type === 'str') return decodeXml(raw ?? '')
  return parseScalar(raw)
}

export async function parseXlsxWorkbookBlob(blob: Blob): Promise<WorkbookSheet[]> {
  const zip = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const xml = (path: string) => (zip[path] ? strFromU8(zip[path]) : '')
  const sharedStrings: string[] = []
  for (const match of xml('xl/sharedStrings.xml').matchAll(/<(?:\w+:)?si[\s\S]*?<\/(?:\w+:)?si>/g)) {
    sharedStrings.push([...match[0].matchAll(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((part) => decodeXml(part[1])).join(''))
  }

  const relMap: Record<string, string> = {}
  for (const rel of xml('xl/_rels/workbook.xml.rels').matchAll(/<Relationship[^>]*\/>/g)) {
    const id = rel[0].match(/Id="([^"]+)"/)?.[1]
    const target = rel[0].match(/Target="([^"]+)"/)?.[1]
    if (id && target) relMap[id] = 'xl/' + target.replace(/^\//, '').replace(/^xl\//, '')
  }

  return [...xml('xl/workbook.xml').matchAll(/<(?:\w+:)?sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((sheet) => {
    const sheetXml = xml(relMap[sheet[2]])
    const rows: WorkbookRow[] = []
    for (const rowPart of sheetXml.split(/<(?:\w+:)?row/).slice(1)) {
      const rowXml = '<row' + rowPart.split(/<\/(?:\w+:)?row>/)[0] + '</row>'
      const rowNumber = Number(rowXml.match(/r="(\d+)"/)?.[1] ?? 0)
      const values: (string | number | null)[] = []
      for (const cell of rowXml.matchAll(/<(?:\w+:)?c[^>]*r="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/(?:\w+:)?c>)/g)) {
        values[columnIndex(cell[1])] = cellValue(cell[0], sharedStrings)
      }
      if (values.some((value) => value !== undefined && value !== null && value !== '')) {
        rows.push({ rowNumber, values: values.map((value) => value ?? null) })
      }
    }
    return { name: decodeXml(sheet[1]), rows }
  })
}
