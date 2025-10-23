import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const latest = await prisma.shiftAssignment.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } })
    return NextResponse.json({ updatedAt: latest?.updatedAt ?? null })
  } catch (e) {
    // DB未作成やテーブル未作成時でもビルドを通すため、null を返す
    return NextResponse.json({ updatedAt: null })
  }
}


