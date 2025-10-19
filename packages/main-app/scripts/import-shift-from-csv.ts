/*
 初回CSVインポート（Numbers由来CSVを想定）
 - 入力: Si25_11 remake-Excel/繧ｷ繝ｼ繝・-繧ｷ繝輔ヨ陦ｨ-2.csv
 - 出力: shift_assignments へ 2025/11 を一括置換保存
 使用: npx ts-node packages/main-app/scripts/import-shift-from-csv.ts --year=2025 --month=11
*/
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function parseArgs() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k,v] = a.replace(/^--/, '').split('=')
    return [k, v]
  })) as any
  const year = Number(args.year || args.y)
  const month = Number(args.month || args.m)
  if (!year || !month) throw new Error('Usage: --year=YYYY --month=M')
  return { year, month }
}

function readCsvRows(filePath: string): string[][] {
  const raw = fs.readFileSync(filePath)
  // NumbersのCSVはUTF-8(BOM)想定。BOM除去
  let text = raw.toString('utf8')
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  return text.split(/\r?\n/).filter(l => l.length > 0).map(l => l.split(','))
}

async function main() {
  const { year, month } = parseArgs()
  const file = path.join(process.cwd(), 'Si25_11 remake-Excel', '繧ｷ繝ｼ繝・-繧ｷ繝輔ヨ陦ｨ-2.csv')
  if (!fs.existsSync(file)) throw new Error(`CSV not found: ${file}`)

  const rows = readCsvRows(file)
  // テーブルはヘッダ＋ブロック行構成。対象は「氏名行」で、日毎に [route, car] の繰り返し
  // 氏名は固定順: 田中, 丸山, 坂下, 伊藤
  const staffOrder = ['田中','丸山','坂下','伊藤']
  const staffByName: Record<string, string> = {}
  const staffs = await prisma.staff.findMany({ select: { id: true, name: true } })
  for (const s of staffs) staffByName[s.name] = s.id

  const dayRegex = /^(\d{1,2})\/(\d{1,2})$/
  const headerRowIdx = rows.findIndex(r => r.some(c => dayRegex.test(c)))
  if (headerRowIdx < 0) throw new Error('Day header row not found')

  const dayCols: number[] = []
  rows[headerRowIdx].forEach((val, idx) => { if (dayRegex.test(val)) dayCols.push(idx) })
  // 各日につき2列（route, car）を想定し、氏名行では dayCol と dayCol+1 を読み取る

  const toEnum = (label: string): any => {
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

  type Rec = { day: number; staffId: string; route: any; carNumber: string | null; noteBL: string | null; noteBR: string | null }
  const records: Rec[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const name = row[0]?.trim()
    if (!name) continue
    if (!staffOrder.includes(name)) continue
    const staffId = staffByName[name]
    if (!staffId) continue

    for (const col of dayCols) {
      const header = rows[headerRowIdx][col]
      const m = header.match(dayRegex)
      if (!m) continue
      const d = Number(m[2])
      const route = (row[col] || '').trim()
      const car = (row[col+1] || '').trim().replace('？','?')
      if (!route && !car) continue
      const routeEnum = toEnum(route)
      if (!routeEnum) continue
      const carNumber = car === '' ? null : car
      records.push({ day: d, staffId, route: routeEnum, carNumber, noteBL: null, noteBR: null })
    }
  }

  // 置換保存
  await prisma.$transaction(async tx => {
    await tx.shiftAssignment.deleteMany({ where: { year, month } })
    for (const r of records) {
      await tx.shiftAssignment.create({ data: { year, month, day: r.day, staffId: r.staffId, route: r.route, carNumber: r.carNumber, noteBL: r.noteBL, noteBR: r.noteBR } })
    }
  })

  console.log(`Imported ${records.length} records for ${year}/${month}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })


