interface ParseCSVResult {
  headers: string[]
  rows: Record<string, string>[]
  rowCount: number
}

/**
 * Parse a CSV string into headers and row objects.
 * Handles quoted fields, commas inside quotes, and auto-detects delimiter (comma, tab, semicolon).
 */
export function parseCSV(content: string): ParseCSVResult {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) {
    return { headers: [], rows: [], rowCount: 0 }
  }

  const delimiter = detectDelimiter(normalized)
  const lines = splitLines(normalized)

  if (lines.length === 0) {
    return { headers: [], rows: [], rowCount: 0 }
  }

  const headers = parseLine(lines[0], delimiter).map((h) => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseLine(line, delimiter)
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] ?? '').trim()
    }
    rows.push(row)
  }

  return { headers, rows, rowCount: rows.length }
}

function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0]
  const commaCount = (firstLine.match(/,/g) || []).length
  const tabCount = (firstLine.match(/\t/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t'
  if (semicolonCount > commaCount && semicolonCount > tabCount) return ';'
  return ','
}

function splitLines(content: string): string[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    if (char === '"') {
      inQuotes = !inQuotes
      current += char
    } else if (char === '\n' && !inQuotes) {
      lines.push(current)
      current = ''
    } else {
      current += char
    }
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === delimiter) {
        fields.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }

  fields.push(current)
  return fields
}
