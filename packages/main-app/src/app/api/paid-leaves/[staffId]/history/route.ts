import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePaidLeaveColumns, currentPaidLeavePeriod, isDateInPeriod } from '@/lib/paid-leave'

const isPreview = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV !== 'production'

// GET /api/paid-leaves/:staffId/history
// そのスタッフの「今期」の有給使用日一覧
export async function GET(_req: Request, { params }: { params: { staffId: string } }) {
  try {
    await ensurePaidLeaveColumns()
    const staffId = params.staffId

    const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { hireDate: true } })
    if (!staff?.hireDate) return NextResponse.json({ dates: [] })

    const period = currentPaidLeavePeriod(new Date(staff.hireDate))
    const rows = await prisma.shiftRestDay.findMany({
      where: { staffId, kind: 'PAID' },
      select: { year: true, month: true, day: true },
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { day: 'asc' }],
    })
    const dates = rows
      .filter(r => isDateInPeriod(r.year, r.month, r.day, period))
      .map(r => ({ year: r.year, month: r.month, day: r.day }))

    return NextResponse.json({ dates })
  } catch (err) {
    const error = err as Error
    console.error('[GET /api/paid-leaves/:staffId/history] Error:', error)
    return NextResponse.json({ error: isPreview ? error.message : 'Internal Server Error' }, { status: 500 })
  }
}
