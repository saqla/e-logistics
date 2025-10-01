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

    // データ整形（空値は除外）
    const notesData = (notes as any[])
      .filter(n => (n?.text ?? '').toString().trim() !== '')
      .map(n => ({ year, month, day: Number(n.day), slot: Number(n.slot), text: String(n.text) }))

    const routesData = (routes as any[]).map(r => ({
      year,
      month,
      day: Number(r.day),
      route: r.route, // Prisma enum
      staffId: r.staffId ?? null,
      special: r.special ?? null,
    }))

    const lowersData = (lowers as any[])
      .filter(l => l && l.staffId != null && `${l.staffId}`.trim() !== '')
      .map(l => ({ year, month, day: Number(l.day), rowIndex: Number(l.rowIndex), staffId: String(l.staffId) }))

    // バルク最適化（deleteMany + createMany）
    await prisma.$transaction([
      prisma.dayNote.deleteMany({ where: { year, month } }),
      prisma.routeAssignment.deleteMany({ where: { year, month } }),
      prisma.lowerAssignment.deleteMany({ where: { year, month } }),
      ...(notesData.length > 0 ? [prisma.dayNote.createMany({ data: notesData })] : []),
      ...(routesData.length > 0 ? [prisma.routeAssignment.createMany({ data: routesData })] : []),
      ...(lowersData.length > 0 ? [prisma.lowerAssignment.createMany({ data: lowersData })] : []),
    ])
    const tDone = Date.now()

    const timings = {
      parseMs: tParsed - t0,
      totalMs: tDone - t0,
      counts: { notes: notesData.length, routes: routesData.length, lowers: lowersData.length },
    }

    if (isPreview) {
      return NextResponse.json({ ok: true, timings })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('POST /api/schedule error:', e)
    const message = e?.message || 'Internal Error'
    const code = e?.code
    return NextResponse.json({ error: message, code }, { status: 500 })
  }
}


