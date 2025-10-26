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
  if (body?.name != null) data.name = (body.name||'').toString()
  if (body?.order != null) data.order = Number(body.order)
  if (body?.bgClass != null) data.bgClass = (body.bgClass||'').toString()
  if (body?.textClass != null) data.textClass = (body.textClass||'').toString()
  if (body?.enabled != null) data.enabled = !!body.enabled
  if (Object.keys(data).length === 0) return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
  const updated = await prisma.routeDefinition.update({ where: { id }, data })
  return NextResponse.json({ item: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any)
  const cookie = _req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }
  const id = params.id
  await prisma.routeDefinition.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}


