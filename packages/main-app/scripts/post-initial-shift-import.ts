/* POST /api/shift/import に投入するための小スクリプト */
import fs from 'fs'
import path from 'path'

async function main() {
  const url = process.env.IMPORT_URL // 例: https://<preview-url>/api/shift/import
  const token = process.env.SHIFT_IMPORT_TOKEN
  if (!url || !token) throw new Error('IMPORT_URL/SHIFT_IMPORT_TOKEN を環境変数に設定してください')

  const file = path.join(process.cwd(), 'Si25_11 remake-Excel', 'assignments-2025-11.json')
  if (!fs.existsSync(file)) throw new Error(`JSON not found: ${file}`)
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'))
  // staffName -> staffId 置換はAPI側で行わないため、ここで補完
  // 最低限、APIに { day, staffId, route, carNumber, noteBL, noteBR } を投げる形式に変換する
  let converted = null
  const staffMapPath = path.join(process.cwd(), 'Si25_11 remake-Excel', 'staff-map.json')
  if (fs.existsSync(staffMapPath)) {
    const staffMap = JSON.parse(fs.readFileSync(staffMapPath, 'utf8')) as Record<string,string>
    converted = {
      year: payload.year,
      month: payload.month,
      assignments: payload.assignments.map((a: any) => ({
        day: a.day,
        staffId: staffMap[a.staffName],
        route: a.route,
        carNumber: a.carNumber ?? null,
        noteBL: a.noteBL ?? null,
        noteBR: a.noteBR ?? null,
      })).filter((x: any) => !!x.staffId)
    }
  } else {
    // staff-mapが無い場合は staffName を含めて送信し、API側で解決
    converted = {
      year: payload.year,
      month: payload.month,
      assignments: payload.assignments.map((a: any) => ({
        day: a.day,
        staffName: a.staffName,
        route: a.route,
        carNumber: a.carNumber ?? null,
        noteBL: a.noteBL ?? null,
        noteBR: a.noteBR ?? null,
      }))
    }
  }

  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-import-token': token }, body: JSON.stringify(converted) })
  const text = await res.text()
  console.log(res.status, text)
}

main().catch(e => { console.error(e); process.exit(1) })


