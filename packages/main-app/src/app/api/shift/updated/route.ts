import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const latest = await prisma.shiftAssignment.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } })
    return NextResponse.json({ updatedAt: latest?.updatedAt ?? null })
  } catch (e) {
    console.error('GET /api/shift/updated error:', e)
    return NextResponse.json({ updatedAt: null })
  }
}


