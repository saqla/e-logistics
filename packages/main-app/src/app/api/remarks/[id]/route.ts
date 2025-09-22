import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH /api/remarks/:id { title?, body? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = params.id
  const body = await req.json()
  const data: any = {}
  if (typeof body?.title === 'string') data.title = body.title.trim()
  if (typeof body?.body === 'string') data.body = body.body.trim()
  if (Object.keys(data).length === 0) return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
  const updated = await prisma.remark.update({ where: { id }, data })
  return NextResponse.json({ remark: updated })
}

// DELETE /api/remarks/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id
  await prisma.remark.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}


