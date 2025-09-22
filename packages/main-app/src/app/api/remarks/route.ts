import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/remarks
export async function GET() {
  const items = await prisma.remark.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ remarks: items })
}

// POST /api/remarks { title, body }
export async function POST(req: Request) {
  const body = await req.json()
  const title: string = body?.title?.trim()
  const content: string = body?.body?.trim()
  if (!title || !content) return NextResponse.json({ error: 'タイトルと本文は必須です' }, { status: 400 })
  const created = await prisma.remark.create({ data: { title, body: content } })
  return NextResponse.json({ remark: created })
}


