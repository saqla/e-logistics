import { NextResponse } from 'next/server'
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

  const includeColor = await hasLowerColorColumn()
  const [notes, routes, lowers] = await Promise.all([
    prisma.dayNote.findMany({
      where: { year, month },
      orderBy: [{ day: 'asc' }, { slot: 'asc' }],
      select: { day: true, slot: true, text: true },
    }),
    prisma.routeAssignment.findMany({
      where: { year, month },
      select: { day: true, route: true, staffId: true, special: true },
    }),
    includeColor
      ? prisma.lowerAssignment.findMany({
          where: { year, month },
          select: { day: true, rowIndex: true, staffId: true, color: true },
        })
      : (prisma.lowerAssignment.findMany({
          where: { year, month },
          select: { day: true, rowIndex: true, staffId: true },
        }) as any),
  ])
  return NextResponse.json({ notes, routes, lowers })
}

// POST /api/schedule  保存一括
// { year, month, notes: DayNote[], routes: RouteAssignment[], lowers: LowerAssignment[] }
export async function POST(req: Request) {
  const isPreview = process.env.VERCEL_ENV !== 'production'
  const t0 = Date.now()
  try {
    const body = await req.json()
    const tParsed = Date.now()
    const year: number = body?.year
    const month: number = body?.month
    if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })

    const notes = Array.isArray(body?.notes) ? body.notes : []
    const routes = Array.isArray(body?.routes) ? body.routes : []
    const lowers = Array.isArray(body?.lowers) ? body.lowers : []

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


