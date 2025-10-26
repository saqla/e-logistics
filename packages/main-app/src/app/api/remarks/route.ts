import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'

async function getPrisma() {
  try {
    const mod = await import('@/lib/prisma')
    return (mod as any).prisma as any
  } catch (_e) {
    return null
  }
}

// remarks.category 列が存在するか（互換対応）
let hasRemarkCategoryColumnCache: boolean | null = null
async function hasRemarkCategoryColumn(prisma: any): Promise<boolean> {
  if (hasRemarkCategoryColumnCache != null) return hasRemarkCategoryColumnCache
  try {
    const rows = await prisma.$queryRawUnsafe(
      "select 1 from information_schema.columns where table_name='remarks' and column_name='category' and table_schema = current_schema() limit 1"
    ) as any[]
    hasRemarkCategoryColumnCache = Array.isArray(rows) && rows.length > 0
  } catch {
    hasRemarkCategoryColumnCache = false
  }
  return hasRemarkCategoryColumnCache
}

// GET /api/remarks
export async function GET() {
  try {
    const prisma = await getPrisma()
    if (!prisma) return NextResponse.json({ remarks: [] })
    const items = await prisma.remark.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ remarks: items })
  } catch (e: any) {
    const message = e?.message || 'Internal Error'
    const code = e?.code
    return NextResponse.json({ error: message, code }, { status: 500 })
  }
}

// POST /api/remarks { title, body }
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions as any)
    const cookie = req.headers.get('cookie') || ''
    const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
    if (!(session as any)?.editorVerified || disabled) {
      return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
    }
    const prisma = await getPrisma()
    if (!prisma) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
    const body = await req.json()
    const title: string = body?.title?.trim()
    const content: string = body?.body?.trim()
    if (!title || !content) return NextResponse.json({ error: 'タイトルと本文は必須です' }, { status: 400 })
    // 後方互換: すべての環境で確実に通るよう、常にraw insert（列を明示）
    const id = randomUUID()
    const createdAt = new Date()
    const updatedAt = createdAt
    await prisma.$executeRaw`INSERT INTO "remarks" ("id","title","body","createdAt","updatedAt") VALUES (${id}, ${title}, ${content}, ${createdAt}, ${updatedAt})`
    const created = await prisma.remark.findUnique({ where: { id } })
    return NextResponse.json({ remark: created })
  } catch (e: any) {
    const message = e?.message || 'Internal Error'
    const code = e?.code
    return NextResponse.json({ error: message, code }, { status: 500 })
  }
}


