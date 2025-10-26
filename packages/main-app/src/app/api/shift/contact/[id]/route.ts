import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

async function getPrisma() {
  try {
    const mod = await import('@/lib/prisma')
    return (mod as any).prisma as any
  } catch (_e) {
    return null
  }
}

// PATCH /api/shift/contact/:id { title?, body?, category? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any)
  const cookie = req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }
  const prisma = await getPrisma()
  if (!prisma) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
  const id = params.id
  const body = await req.json()
  const data: any = {}
  if (typeof body?.title === 'string') data.title = body.title.trim() || null
  if (typeof body?.body === 'string') data.body = (body.body ?? '').toString().trim()
  if (typeof body?.category === 'string') data.category = body.category
  if (Object.keys(data).length === 0) return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
  if (data.body != null && data.body === '') return NextResponse.json({ error: '本文は必須です' }, { status: 400 })
  const updated = await prisma.shiftContact.update({ where: { id }, data })
  return NextResponse.json({ item: updated })
}

// DELETE /api/shift/contact/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any)
  const cookie = _req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }
  const prisma = await getPrisma()
  if (!prisma) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
  const id = params.id
  await prisma.shiftContact.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}


