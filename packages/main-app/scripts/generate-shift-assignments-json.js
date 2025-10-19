// CSV -> JSON(assignments) 生成スクリプト（Node.js版）
const fs = require('fs')
const path = require('path')

function parseArgs() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v]
  }))
  const year = Number(args.year || args.y)
  const month = Number(args.month || args.m)
  if (!year || !month) throw new Error('Usage: --year=YYYY --month=M')
  return { year, month }
}

function readCsvRows(filePath) {
  const raw = fs.readFileSync(filePath)
  let text = raw.toString('utf8')
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  return text
    .split(/\r?\n/)
    .filter(l => l.length > 0)
    .map(l => l.split(','))
}

function toEnum(label) {
  switch (label) {
    case '産直': return 'SANCHOKU'
    case 'ドンキ(福岡)': return 'DONKI_FUKUOKA'
    case 'ドンキ(長崎)': return 'DONKI_NAGASAKI'
    case 'ユニック': return 'UNIC'
    case '休み': return 'OFF'
    case '有給': return 'PAID_LEAVE'
    default: return null
  }
}

function main() {
  const { year, month } = parseArgs()
  // リポジトリ直下 or packages/main-app 直下の両方を探索
  const candidates = [
    path.join(process.cwd(), 'Si25_11 remake-Excel', '繧ｷ繝ｼ繝・-繧ｷ繝輔ヨ陦ｨ-2.csv'),
    path.join(process.cwd(), '..', '..', 'Si25_11 remake-Excel', '繧ｷ繝ｼ繝・-繧ｷ繝輔ヨ陦ｨ-2.csv'),
  ]
  const csvPath = candidates.find(p => fs.existsSync(p))
  if (!csvPath) throw new Error(`CSV not found in:\n- ${candidates.join('\n- ')}`)
  const rows = readCsvRows(csvPath)

  const dayRegex = /^(\d{1,2})\/(\d{1,2})$/
  const headerRowIdx = rows.findIndex(r => r.some(c => dayRegex.test(c)))
  if (headerRowIdx < 0) throw new Error('Day header row not found')
  const dayCols = []
  rows[headerRowIdx].forEach((val, idx) => { if (dayRegex.test(val)) dayCols.push(idx) })

  const expected = ['田中','丸山','坂下','伊藤']
  const out = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const name = (row[0] || '').trim()
    if (!name || !expected.includes(name)) continue

    for (const col of dayCols) {
      const header = rows[headerRowIdx][col]
      const m = header.match(dayRegex)
      if (!m) continue
      const d = Number(m[2])
      const routeLabel = (row[col] || '').trim()
      const carLabel = (row[col + 1] || '').trim().replace('？', '?')
      if (!routeLabel && !carLabel) continue
      const routeEnum = toEnum(routeLabel)
      if (!routeEnum) continue
      const carNumber = carLabel === '' ? null : carLabel
      out.push({ day: d, staffName: name, route: routeEnum, carNumber, noteBL: null, noteBR: null })
    }
  }

  const outDir = path.dirname(csvPath)
  const jsonPath = path.join(outDir, `assignments-${year}-${month}.json`)
  const payload = { year, month, assignments: out }
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`Wrote ${out.length} records -> ${jsonPath}`)
}

try { main() } catch (e) { console.error(e); process.exit(1) }


