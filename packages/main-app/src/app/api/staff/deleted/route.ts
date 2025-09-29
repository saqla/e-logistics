import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const isPreview = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV !== 'production'

// GET /api/staff/deleted  論理削除済みの一覧
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set')
    }
    const items = await prisma.staff.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json({ staffs: items })
  } catch (err) {
    const error = err as Error
    console.error('[GET /api/staff/deleted] Error:', error)
    return NextResponse.json({ error: isPreview ? error.message : 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/staff/deleted  { id } -> 復元
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
    const id: string | undefined = body?.id
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // 復元時の同名衝突チェック
    const target = await prisma.staff.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const dup = await prisma.staff.findFirst({ where: { name: target.name, deletedAt: null } })
    if (dup) return NextResponse.json({ error: '同名のアクティブスタッフが存在します' }, { status: 409 })

    const restored = await prisma.staff.update({ where: { id }, data: { deletedAt: null } })
    return NextResponse.json({ staff: restored })
  } catch (err) {
    const error = err as Error
    console.error('[POST /api/staff/deleted] Error:', error)
    return NextResponse.json({ error: isPreview ? error.message : 'Internal Server Error' }, { status: 500 })
  }
}


