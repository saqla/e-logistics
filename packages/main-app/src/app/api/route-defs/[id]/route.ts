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
  try {
    const target = await prisma.routeDefinition.findUnique({ where: { id }, select: { key: true } })
    if (!target) return NextResponse.json({ error: '対象のルートが見つかりません' }, { status: 404 })

    // このルートを使っているシフト割当は「未割り当て（空車）」に戻してから削除する
    await prisma.$transaction([
      prisma.shiftAssignment.updateMany({ where: { route: target.key }, data: { route: null } }),
      prisma.routeDefinition.delete({ where: { id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: '対象のルートが見つかりません' }, { status: 404 })
    return NextResponse.json({ error: e?.message || '削除に失敗しました' }, { status: 500 })
  }
}


