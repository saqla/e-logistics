import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any)
  const cookie = req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }
  const id = params.id
  const body = await req.json().catch(() => ({}))
  const data: any = {}
  if (body?.number != null) data.number = (body.number || '').toString().trim()
  if (body?.order != null) data.order = Number(body.order)
  if (body?.enabled != null) data.enabled = !!body.enabled
  if (Object.keys(data).length === 0) return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
  try {
    const updated = await prisma.vehicle.update({ where: { id }, data })
    return NextResponse.json({ item: updated })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: '同じ車番が既に存在します' }, { status: 409 })
    return NextResponse.json({ error: e?.message || '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any)
  const cookie = _req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }
  const id = params.id
  await prisma.vehicle.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
