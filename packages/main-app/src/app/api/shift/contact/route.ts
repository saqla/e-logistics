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

// GET /api/shift/contact
export async function GET() {
  const prisma = await getPrisma()
  if (!prisma) return NextResponse.json({ items: [] })
  const items = await prisma.shiftContact.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ items })
}

// POST /api/shift/contact { title, body, category? }
export async function POST(req: Request) {
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
  const category: string | undefined = typeof body?.category === 'string' ? body.category : undefined
  if (!title || !content) return NextResponse.json({ error: 'タイトルと本文は必須です' }, { status: 400 })
  const created = await prisma.shiftContact.create({ data: { title, body: content, category } })
  return NextResponse.json({ item: created })
}


