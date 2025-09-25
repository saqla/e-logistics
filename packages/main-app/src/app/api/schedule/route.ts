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

    // トランザクションでUpsert相当（ユニークキー基準で置換）
    await prisma.$transaction(async (tx) => {
    // DayNote（置換保存：先に当月分を削除し、空でないものだけ再作成）
    await tx.dayNote.deleteMany({ where: { year, month } })
    const filteredNotes = (notes as any[]).filter(n => (n?.text ?? '').toString().trim() !== '')
    for (const n of filteredNotes) {
      await tx.dayNote.create({ data: { year, month, day: n.day, slot: n.slot, text: n.text } })
    }

    // RouteAssignment
    for (const r of routes) {
      await tx.routeAssignment.upsert({
        where: { year_month_day_route: { year, month, day: r.day, route: r.route } },
        update: { staffId: r.staffId ?? null, special: r.special ?? null },
        create: { year, month, day: r.day, route: r.route, staffId: r.staffId ?? null, special: r.special ?? null }
      })
    }

    // LowerAssignment
    // 月全体を一旦削除し、NULLでないものだけ再作成（ユニーク制約 year,month,day,staffId の衝突回避）
    await tx.lowerAssignment.deleteMany({ where: { year, month } })
    for (const l of lowers as any[]) {
      if (!l || l.staffId == null || `${l.staffId}`.trim() === '') continue
      await tx.lowerAssignment.create({
        data: { year, month, day: l.day, rowIndex: l.rowIndex, staffId: l.staffId }
      })
    }
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('POST /api/schedule error:', e)
    const message = e?.message || 'Internal Error'
    const code = e?.code
    return NextResponse.json({ error: message, code }, { status: 500 })
  }
}


