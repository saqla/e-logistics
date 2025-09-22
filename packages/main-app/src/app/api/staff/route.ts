import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/staff?year=2025&month=9
// アクティブスタッフ一覧（名前昇順）と、指定年月の下段表示数を返す
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year')) || null
  const month = Number(searchParams.get('month')) || null

  const staffs = await prisma.staff.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' }
  })

  if (!year || !month) {
    return NextResponse.json({ staffs: staffs.map(s => ({ ...s, lowerCount: 0 })) })
  }

  const counts = await prisma.lowerAssignment.groupBy({
    by: ['staffId'],
    where: { year, month, staffId: { not: null } },
    _count: { staffId: true }
  })

  const map = new Map<string, number>()
  counts.forEach(c => { if (c.staffId) map.set(c.staffId, c._count.staffId) })

  const result = staffs.map(s => ({ ...s, lowerCount: map.get(s.id) || 0 }))
  return NextResponse.json({ staffs: result })
}

// POST /api/staff  { name, kind }
export async function POST(req: Request) {
  const body = await req.json()
  const name: string = body?.name?.trim()
  const kind: string = body?.kind

  if (!name || !kind) {
    return NextResponse.json({ error: '名前と種別は必須です' }, { status: 400 })
  }

  const exists = await prisma.staff.findFirst({ where: { name, deletedAt: null } })
  if (exists) {
    return NextResponse.json({ error: '同名のスタッフが既に存在します' }, { status: 409 })
  }

  const created = await prisma.staff.create({ data: { name, kind } })
  return NextResponse.json({ staff: created })
}


