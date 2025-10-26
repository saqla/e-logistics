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

// PATCH /api/remarks/:id { title?, body? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
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
    if (typeof body?.title === 'string') data.title = body.title.trim()
    if (typeof body?.body === 'string') data.body = body.body.trim()
    // 後方互換のため category の更新は無効化（将来スキーマ導入時に再検討）
    if (Object.keys(data).length === 0) return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
    // 後方互換: raw UPDATEで列を限定
    if (Object.prototype.hasOwnProperty.call(data, 'title') || Object.prototype.hasOwnProperty.call(data, 'body')) {
      const titleVal = typeof data.title === 'string' ? data.title : undefined
      const bodyVal = typeof data.body === 'string' ? data.body : undefined
      if (titleVal != null && bodyVal != null) {
        await prisma.$executeRaw`UPDATE "remarks" SET "title"=${titleVal}, "body"=${bodyVal}, "updatedAt"=${new Date()} WHERE "id"=${id}`
      } else if (titleVal != null) {
        await prisma.$executeRaw`UPDATE "remarks" SET "title"=${titleVal}, "updatedAt"=${new Date()} WHERE "id"=${id}`
      } else if (bodyVal != null) {
        await prisma.$executeRaw`UPDATE "remarks" SET "body"=${bodyVal}, "updatedAt"=${new Date()} WHERE "id"=${id}`
      }
      const rows = await prisma.$queryRaw`SELECT "id","title","body","createdAt","updatedAt" FROM "remarks" WHERE "id"=${id} LIMIT 1` as any[]
      const updated = rows?.[0] || { id, title: titleVal, body: bodyVal }
      return NextResponse.json({ remark: updated })
    }
    const rows = await prisma.$queryRaw`SELECT "id","title","body","createdAt","updatedAt" FROM "remarks" WHERE "id"=${id} LIMIT 1` as any[]
    const updated = rows?.[0] || null
    return NextResponse.json({ remark: updated })
  } catch (e: any) {
    const message = e?.message || 'Internal Error'
    const code = e?.code
    return NextResponse.json({ error: message, code }, { status: 500 })
  }
}

// DELETE /api/remarks/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions as any)
    // DELETEのときもcookie判定
    const cookie = _req.headers.get('cookie') || ''
    const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
    if (!(session as any)?.editorVerified || disabled) {
      return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
    }
    const prisma = await getPrisma()
    if (!prisma) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
    const id = params.id
    await prisma.remark.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const message = e?.message || 'Internal Error'
    const code = e?.code
    return NextResponse.json({ error: message, code }, { status: 500 })
  }
}


