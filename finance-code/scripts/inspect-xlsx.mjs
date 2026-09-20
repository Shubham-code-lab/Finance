import fs from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'

const file = process.argv[2]
const zip = unzipSync(fs.readFileSync(file))
const xml = (path) => (zip[path] ? strFromU8(zip[path]) : '')
const decode = (value = '') =>
  String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")

const sharedStrings = []
for (const match of xml('xl/sharedStrings.xml').matchAll(/<si[\s\S]*?<\/si>/g)) {
  const parts = [...match[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decode(part[1]))
  sharedStrings.push(parts.join(''))
}

const relMap = {}
for (const rel of xml('xl/_rels/workbook.xml.rels').matchAll(/<Relationship[^>]*\/>/g)) {
  const id = rel[0].match(/Id="([^"]+)"/)?.[1]
  const target = rel[0].match(/Target="([^"]+)"/)?.[1]
  if (id && target) relMap[id] = target
}

const sheets = [...xml('xl/workbook.xml').matchAll(/<(?:\w+:)?sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((sheet) => ({
  name: decode(sheet[1]),
  path: 'xl/' + relMap[sheet[2]].replace(/^\//, '').replace(/^xl\//, ''),
}))

function columnIndex(column) {
  let index = 0
  for (const char of column) index = index * 26 + char.charCodeAt(0) - 64
  return index - 1
}

function cellValue(cellXml) {
  const type = cellXml.match(/ t="([^"]+)"/)?.[1]
  const raw = cellXml.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1]
  if (type === 's') return sharedStrings[Number(raw)] ?? ''
  if (type === 'inlineStr') return decode(cellXml.match(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/)?.[1] ?? '')
  if (type === 'str') return decode(raw ?? '')
  return raw ?? ''
}

for (const sheet of sheets) {
  const sheetXml = xml(sheet.path)
  console.log(
    `\nSHEET ${sheet.name} ${sheet.path} bytes=${zip[sheet.path]?.length ?? 0} rowTags=${(sheetXml.match(/<x:row/g) ?? []).length}`,
  )
  const rows = []
  const rowParts = sheetXml.split('<x:row').slice(1)
  for (const rowPart of rowParts) {
    const rowXml = '<x:row' + rowPart.split('</x:row>')[0] + '</x:row>'
    const rowNumber = rowXml.match(/r="(\d+)"/)?.[1] ?? '0'
    const values = []
    for (const cellMatch of rowXml.matchAll(/<x:c[^>]*r="([A-Z]+)\d+"[\s\S]*?<\/x:c>/g)) {
      values[columnIndex(cellMatch[1])] = cellValue(cellMatch[0])
    }
    if (values.some((value) => value !== undefined && value !== '')) {
      rows.push({ row: Number(rowNumber), values: values.map((value) => value ?? null) })
    }
    if (rows.length >= 14) break
  }
  console.log(JSON.stringify(rows, null, 2))
}
