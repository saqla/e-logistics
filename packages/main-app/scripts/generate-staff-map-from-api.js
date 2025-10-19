// Previewの /api/staff からスタッフ名->IDのマッピングを生成
const fs = require('fs')
const path = require('path')

async function main() {
  const importUrl = process.env.IMPORT_URL // 例: https://<preview>/api/shift/import
  if (!importUrl) throw new Error('IMPORT_URL を設定してください (例: https://<preview-url>/api/shift/import)')
  const base = new URL(importUrl).origin
  const headers = {}
  const bypass = process.env.VERCEL_BYPASS || process.env.VERCEL_PROTECTION_BYPASS
  if (bypass) headers['x-vercel-protection-bypass'] = bypass
  const basic = process.env.BASIC_AUTH // 形式: user:pass
  if (basic) headers['authorization'] = `Basic ${Buffer.from(basic).toString('base64')}`
  const res = await fetch(`${base}/api/staff`, { headers })
  if (!res.ok) throw new Error(`GET /api/staff failed: ${res.status}`)
  const json = await res.json()
  const order = ['田中','丸山','坂下','伊藤']
  const map = {}
  for (const s of json.staffs || []) {
    if (order.includes(s.name)) map[s.name] = s.id
  }
  const outDir = path.join(process.cwd(), '..', '..', 'Si25_11 remake-Excel')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'staff-map.json')
  fs.writeFileSync(outPath, JSON.stringify(map, null, 2), 'utf8')
  console.log(`Wrote staff-map.json -> ${outPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })


