import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { StaffKind } from '@prisma/client'

const isPreview = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV !== 'production'

// GET /api/staff?year=2025&month=9
// アクティブスタッフ一覧（名前昇順）と、指定年月の下段表示数を返す
export async function GET(req: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set')
    }
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
  } catch (err) {
    const error = err as Error
    console.error('[GET /api/staff] Error:', error)
    return NextResponse.json({ error: isPreview ? error.message : 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/staff  { name, kind }
export async function POST(req: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set')
    }
    let body: any
    try {
      body = await req.json()
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const name: string = body?.name?.trim()
    const kind: string = body?.kind

    if (!name || !kind) {
      return NextResponse.json({ error: '名前と種別は必須です' }, { status: 400 })
    }

    const exists = await prisma.staff.findFirst({ where: { name, deletedAt: null } })
    if (exists) {
      return NextResponse.json({ error: '同名のスタッフが既に存在します' }, { status: 409 })
    }

    const upper = String(kind).toUpperCase()
    if (!Object.values(StaffKind).includes(upper as StaffKind)) {
      return NextResponse.json({ error: '種別kindが不正です' }, { status: 400 })
    }

    const created = await prisma.staff.create({ data: { name, kind: upper as StaffKind } })
    return NextResponse.json({ staff: created })
  } catch (err) {
    const error = err as Error
    console.error('[POST /api/staff] Error:', error)
    return NextResponse.json({ error: isPreview ? error.message : 'Internal Server Error' }, { status: 500 })
  }
}


