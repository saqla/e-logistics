import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePaidLeaveColumns, currentPaidLeavePeriod, formatNextGrantMonth, isDateInPeriod, resolveTotalDays, nextGrantDays as computeNextGrantDays } from '@/lib/paid-leave'

export const dynamic = 'force-dynamic'

const isPreview = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV !== 'production'

// GET /api/paid-leaves
// 有効スタッフごとの有給管理サマリー（継続年数・次回付与年月・総付与日数・実使用日数・残日数）
export async function GET() {
  try {
    await ensurePaidLeaveColumns()

    const staffs = await prisma.staff.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, hireDate: true, paidLeaveTotalDays: true },
    })

    const paidRows = staffs.length > 0
      ? await prisma.shiftRestDay.findMany({
          where: { staffId: { in: staffs.map(s => s.id) }, kind: 'PAID' },
          select: { staffId: true, year: true, month: true, day: true },
        })
      : []

    const today = new Date()
    const items = staffs.map(s => {
      if (!s.hireDate) {
        const currentPeriodTotalDays = s.paidLeaveTotalDays ?? 0
        return {
          staffId: s.id,
          name: s.name,
          hireDate: null,
          tenureYears: null,
          nextGrantMonth: null,
          nextGrantDays: null,
          currentPeriodTotalDays,
          totalDaysIsOverride: s.paidLeaveTotalDays != null,
          usedDays: 0,
          remainingDays: currentPeriodTotalDays,
        }
      }
      const period = currentPaidLeavePeriod(new Date(s.hireDate), today)
      const usedDays = paidRows.filter(r => r.staffId === s.id && isDateInPeriod(r.year, r.month, r.day, period)).length
      // 今期の付与日数（上書きがあればそれ、無ければ法定値）＝ 実使用日数・残り日数の計算に使う内部値
      const currentPeriodTotalDays = resolveTotalDays(s.paidLeaveTotalDays, period)
      // 「総付与日数」として画面に表示するのは次回付与日の予定日数（常に法定スケジュール、上書き対象外）
      const nextGrantDaysValue = computeNextGrantDays(period)
      return {
        staffId: s.id,
        name: s.name,
        hireDate: s.hireDate,
        tenureYears: period.tenureYears,
        nextGrantMonth: formatNextGrantMonth(period.nextGrantDate),
        nextGrantDays: nextGrantDaysValue,
        currentPeriodTotalDays,
        totalDaysIsOverride: s.paidLeaveTotalDays != null,
        usedDays,
        remainingDays: currentPeriodTotalDays - usedDays,
      }
    })

    return NextResponse.json({ items })
  } catch (err) {
    const error = err as Error
    console.error('[GET /api/paid-leaves] Error:', error)
    return NextResponse.json({ error: isPreview ? error.message : 'Internal Server Error' }, { status: 500 })
  }
}
