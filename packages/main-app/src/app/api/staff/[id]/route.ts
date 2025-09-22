import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH /api/staff/:id  { name?, kind? }
export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id
  const body = await _req.json()
  const name: string | undefined = body?.name?.trim()
  const kind: string | undefined = body?.kind

  if (!name && !kind) {
    return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
  }

  if (name) {
    const dup = await prisma.staff.findFirst({ where: { id: { not: id }, name, deletedAt: null } })
    if (dup) {
      return NextResponse.json({ error: '同名のスタッフが既に存在します' }, { status: 409 })
    }
  }

  const updated = await prisma.staff.update({
    where: { id },
    data: { name, kind }
  })
  return NextResponse.json({ staff: updated })
}

// DELETE /api/staff/:id  論理削除（復元可能）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id
  const updated = await prisma.staff.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
  return NextResponse.json({ staff: updated })
}


