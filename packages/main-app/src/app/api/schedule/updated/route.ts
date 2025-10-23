import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const [dn, ra, la] = await Promise.all([
      prisma.dayNote.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      prisma.routeAssignment.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      prisma.lowerAssignment.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    ])

    const dates = [dn?.updatedAt, ra?.updatedAt, la?.updatedAt].filter(Boolean) as Date[]
    const latest = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null

    return NextResponse.json({ updatedAt: latest ? latest.toISOString() : null })
  } catch (e) {
    console.error('GET /api/schedule/updated error:', e)
    return NextResponse.json({ updatedAt: null }, { status: 200 })
  }
}


