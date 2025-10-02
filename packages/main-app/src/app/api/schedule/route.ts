import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/schedule?year=2025&month=9
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })

  const [notes, routes, lowers] = await Promise.all([
    prisma.dayNote.findMany({ where: { year, month }, orderBy: [{ day: 'asc' }, { slot: 'asc' }] }),
    prisma.routeAssignment.findMany({ where: { year, month } }),
    prisma.lowerAssignment.findMany({ where: { year, month } }),
  ])
  return NextResponse.json({ notes, routes, lowers })
}

// POST /api/schedule  保存一括
// { year, month, notes: DayNote[], routes: RouteAssignment[], lowers: LowerAssignment[] }
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const year: number = body?.year
    const month: number = body?.month
    if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })

    const notes = Array.isArray(body?.notes) ? body.notes : []
    const routes = Array.isArray(body?.routes) ? body.routes : []
    const lowers = Array.isArray(body?.lowers) ? body.lowers : []

    // 非インタラクティブトランザクション（元の挙動へロールバック）
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

    // LowerAssignment 置換（当月分を削除→非空のみ作成）
    ops.push(prisma.lowerAssignment.deleteMany({ where: { year, month } }))
    for (const l of lowers as any[]) {
      if (!l || l.staffId == null || `${l.staffId}`.trim() === '') continue
      ops.push(
        prisma.lowerAssignment.create({
          data: { year, month, day: Number(l.day), rowIndex: Number(l.rowIndex), staffId: String(l.staffId) },
        })
      )
    }

    await prisma.$transaction(ops)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('POST /api/schedule error:', e)
    const message = e?.message || 'Internal Error'
    const code = e?.code
    return NextResponse.json({ error: message, code }, { status: 500 })
  }
}


