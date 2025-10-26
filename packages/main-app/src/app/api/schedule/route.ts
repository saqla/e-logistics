import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// lower_assignments テーブルに color 列が存在するかをキャッシュ付きで確認
let hasLowerColorColumnCache: boolean | null = null
async function hasLowerColorColumn(): Promise<boolean> {
  if (hasLowerColorColumnCache != null) return hasLowerColorColumnCache
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      "select 1 from information_schema.columns where table_name='lower_assignments' and column_name='color' limit 1"
    )
    hasLowerColorColumnCache = Array.isArray(rows) && rows.length > 0
  } catch {
    hasLowerColorColumnCache = false
  }
  return hasLowerColorColumnCache
}

// GET /api/schedule?year=2025&month=9
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })

  // PrismaのenumとDBの古いenum値(EZAKI_DONKI等)不整合により500となるのを回避するため、GETはrawで取得
  const includeColor = await hasLowerColorColumn()
  const [notesRows, routeRows, lowerRows] = await Promise.all([
    (prisma.$queryRaw`SELECT "day","slot","text" FROM "day_notes" WHERE "year"=${year} AND "month"=${month} ORDER BY "day","slot"` as unknown as any[]),
    (prisma.$queryRaw`SELECT "day",
      CASE WHEN "route"='EZAKI_DONKI' THEN 'ESAKI_DONKI' ELSE "route" END AS route,
      "staffId","special"
      FROM "route_assignments" WHERE "year"=${year} AND "month"=${month}` as unknown as any[]),
    includeColor
      ? (prisma.$queryRaw`SELECT "day","rowIndex","staffId","color" FROM "lower_assignments" WHERE "year"=${year} AND "month"=${month}` as unknown as any[])
      : (prisma.$queryRaw`SELECT "day","rowIndex","staffId" FROM "lower_assignments" WHERE "year"=${year} AND "month"=${month}` as unknown as any[]),
  ])
  return NextResponse.json({ notes: notesRows, routes: routeRows, lowers: lowerRows })
}

// POST /api/schedule  保存一括
// { year, month, notes: DayNote[], routes: RouteAssignment[], lowers: LowerAssignment[] }
function isEditorDisabledByCookie(req: Request): boolean {
  const cookie = req.headers.get('cookie') || ''
  return /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
}

export async function POST(req: Request) {
  const isPreview = process.env.VERCEL_ENV !== 'production'
  const t0 = Date.now()
  try {
    const session = await getServerSession(authOptions as any)
    if (!(session as any)?.editorVerified || isEditorDisabledByCookie(req)) {
      return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
    }
    const body = await req.json()
    const tParsed = Date.now()
    const year: number = body?.year
    const month: number = body?.month
    if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const allowEmpty = searchParams.get('allowEmpty') === '1'
    const notes = Array.isArray(body?.notes) ? body.notes : []
    const routes = Array.isArray(body?.routes) ? body.routes : []
    const lowers = Array.isArray(body?.lowers) ? body.lowers : []

    // 空保存ガード：既存データがある月に対して、空配列での保存要求は無視（明示allowEmpty=1時のみ許可）
    const existingCounts = await Promise.all([
      prisma.dayNote.count({ where: { year, month } }),
      prisma.routeAssignment.count({ where: { year, month } }),
      prisma.lowerAssignment.count({ where: { year, month } }),
    ])
    const existingTotal = existingCounts[0] + existingCounts[1] + existingCounts[2]
    if (!allowEmpty && (!notes || notes.length===0) && (!routes || routes.length===0) && (!lowers || lowers.length===0) && existingTotal > 0) {
      const totalMs = Date.now() - t0
      const headers = new Headers({ 'Server-Timing': `total;dur=${totalMs}` })
      // 変更なしで成功扱いにする
      return NextResponse.json({ ok: true, noChange: true }, { headers })
    }

    // 非インタラクティブトランザクション（ロールバック版：アップサート中心）
    const ops: any[] = []

    // DayNote 置換（当月分を削除→非空のものだけ作成）
    ops.push(prisma.dayNote.deleteMany({ where: { year, month } }))
    const filteredNotes = (notes as any[]).filter(n => (n?.text ?? '').toString().trim() !== '')
    for (const n of filteredNotes) {
      ops.push(
        prisma.dayNote.create({
          data: { year, month, day: Number(n.day), slot: Number(n.slot), text: String(n.text) },
        })
      )
    }

    // RouteAssignment はupsertで更新/作成（全削除はしない）
    for (const r of routes as any[]) {
      ops.push(
        prisma.routeAssignment.upsert({
          where: { year_month_day_route: { year, month, day: Number(r.day), route: r.route } },
          update: { staffId: r.staffId ?? null, special: r.special ?? null },
          create: {
            year,
            month,
            day: Number(r.day),
            route: r.route,
            staffId: r.staffId ?? null,
            special: r.special ?? null,
          },
        })
      )
    }

    // LowerAssignment 置換（当月分を削除→非空のみ作成、色も保存）
    // クライアント側の重複防止に依存せず、サーバー側でも同日同スタッフの重複を排除する
    ops.push(prisma.lowerAssignment.deleteMany({ where: { year, month } }))

    // 正規化 + サーバーサイド重複排除（同一日×同一スタッフは最初の1件のみ採用）
    const normalizedLowers = (Array.isArray(lowers) ? (lowers as any[]) : [])
      .filter(l => !!l && l.staffId != null && `${l.staffId}`.trim() !== '')
      .map(l => ({
        day: Number(l.day),
        rowIndex: Number(l.rowIndex),
        staffId: String(l.staffId),
        color: l.color === 'PINK' ? 'PINK' : 'WHITE' as 'PINK' | 'WHITE',
      }))
      // rowIndexの小さいものを優先（配列順が不定でも安定化）
      .sort((a, b) => (a.day - b.day) || (a.rowIndex - b.rowIndex))

    const seenByDayStaff = new Set<string>()
    const dedupedLowers: { day: number; rowIndex: number; staffId: string; color: 'PINK' | 'WHITE' }[] = []
    for (const l of normalizedLowers) {
      const key = `${l.day}-${l.staffId}`
      if (seenByDayStaff.has(key)) continue
      seenByDayStaff.add(key)
      dedupedLowers.push(l)
    }

    const includeColorForCreate = await hasLowerColorColumn()
    if (includeColorForCreate) {
      for (const l of dedupedLowers) {
        ops.push(
          prisma.lowerAssignment.create({
            data: {
              year,
              month,
              day: l.day,
              rowIndex: l.rowIndex,
              staffId: l.staffId,
              color: l.color,
            },
          })
        )
      }
    } else {
      // color列が存在しない古いDBに対してはraw insertで回避（id/createdAt/updatedAtも明示指定）
      for (const l of dedupedLowers) {
        const id = randomUUID()
        const createdAt = new Date()
        const updatedAt = createdAt
        ops.push(
          prisma.$executeRaw`INSERT INTO "lower_assignments" ("id","year","month","day","rowIndex","staffId","createdAt","updatedAt") VALUES (${id}, ${year}, ${month}, ${l.day}, ${l.rowIndex}, ${l.staffId}, ${createdAt}, ${updatedAt})`
        )
      }
    }

    const tDbStart = Date.now()
    await prisma.$transaction(ops)
    const tDbEnd = Date.now()

    const totalMs = Date.now() - t0
    const dbMs = tDbEnd - tDbStart
    const serverTiming = `db;dur=${dbMs}, total;dur=${totalMs}`
    const headers = new Headers({ 'Server-Timing': serverTiming })
    if (isPreview) {
      return NextResponse.json({ ok: true, timings: { parseMs: tParsed - t0, totalMs, dbMs, opsCount: ops.length } }, { headers })
    }
    return NextResponse.json({ ok: true }, { headers })
  } catch (e: any) {
    console.error('POST /api/schedule error:', e)
    const message = e?.message || 'Internal Error'
    const code = e?.code
    return NextResponse.json({ error: message, code }, { status: 500 })
  }
}


