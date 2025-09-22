import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/staff/deleted  論理削除済みの一覧
export async function GET() {
  const items = await prisma.staff.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { name: 'asc' }
  })
  return NextResponse.json({ staffs: items })
}

// POST /api/staff/deleted  { id } -> 復元
export async function POST(req: Request) {
  const body = await req.json()
  const id: string | undefined = body?.id
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // 復元時の同名衝突チェック
  const target = await prisma.staff.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const dup = await prisma.staff.findFirst({ where: { name: target.name, deletedAt: null } })
  if (dup) return NextResponse.json({ error: '同名のアクティブスタッフが存在します' }, { status: 409 })

  const restored = await prisma.staff.update({ where: { id }, data: { deletedAt: null } })
  return NextResponse.json({ staff: restored })
}


