import { prisma } from '@/lib/prisma'

// 有給休暇の法定付与スケジュール（労基法の一般的な付与日数）。
// 入社から6ヶ月で初回付与、以降1年ごとに次の付与。6年6ヶ月以降は毎年20日。
const STATUTORY_GRANT_DAYS = [10, 11, 12, 14, 16, 18, 20] as const

// staffs テーブルに有給管理用の列が無ければ追加（先行デプロイ分との互換）
export async function ensurePaidLeaveColumns() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "staffs" ADD COLUMN IF NOT EXISTS "hireDate" TIMESTAMP(3);`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "staffs" ADD COLUMN IF NOT EXISTS "paidLeaveTotalDays" INTEGER;`)
    // 先行デプロイでDEFAULT 0付きで列が作られていた場合、以後の新規行がnull（自動計算扱い）になるようデフォルトを外す
    await prisma.$executeRawUnsafe(`ALTER TABLE "staffs" ALTER COLUMN "paidLeaveTotalDays" DROP DEFAULT;`)
  } catch {}
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function grantDaysForIndex(index: number): number {
  return STATUTORY_GRANT_DAYS[Math.min(index, STATUTORY_GRANT_DAYS.length - 1)]
}

// index=0は入社6ヶ月後、index=1は1年6ヶ月後、以降12ヶ月ごと
function grantDateForIndex(hireDate: Date, index: number): Date {
  return addMonths(hireDate, 6 + 12 * index)
}

export type PaidLeavePeriod = {
  grantIndex: number | null  // 現在の期の付与回数（0始まり）。初回付与前はnull
  statutoryTotalDays: number // このタイミングでの法定付与日数（初回付与前は0）
  periodStart: Date | null   // 今期の開始日（直近の付与日）。初回付与前はnull
  periodEnd: Date | null     // 今期の終了日（次回付与日、この日は含まない）。初回付与前はnull
  nextGrantDate: Date        // 次回（または初回）の付与日
  tenureYears: number        // 参考表示用の満年数（hireDateからの経過年数）
}

// hireDateを基準に、指定日(today)時点で「今期」に該当する期間と法定付与日数を返す
export function currentPaidLeavePeriod(hireDate: Date, today: Date = new Date()): PaidLeavePeriod {
  const tenureYears = Math.max(0, today.getFullYear() - hireDate.getFullYear() -
    (today.getMonth() < hireDate.getMonth() || (today.getMonth() === hireDate.getMonth() && today.getDate() < hireDate.getDate()) ? 1 : 0))

  let index = -1
  while (grantDateForIndex(hireDate, index + 1).getTime() <= today.getTime()) {
    index++
  }

  if (index < 0) {
    return {
      grantIndex: null,
      statutoryTotalDays: 0,
      periodStart: null,
      periodEnd: null,
      nextGrantDate: grantDateForIndex(hireDate, 0),
      tenureYears,
    }
  }

  const periodStart = grantDateForIndex(hireDate, index)
  const periodEnd = grantDateForIndex(hireDate, index + 1)
  return {
    grantIndex: index,
    statutoryTotalDays: grantDaysForIndex(index),
    periodStart,
    periodEnd,
    nextGrantDate: periodEnd,
    tenureYears,
  }
}

// 次回付与年月を "YYYY年M月" 形式で返す
export function formatNextGrantMonth(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

// 指定の(year,month,day)が今期 [periodStart, periodEnd) に含まれるか（初回付与前は常にfalse）
export function isDateInPeriod(year: number, month: number, day: number, period: PaidLeavePeriod): boolean {
  if (!period.periodStart || !period.periodEnd) return false
  const d = new Date(year, month - 1, day)
  return d.getTime() >= period.periodStart.getTime() && d.getTime() < period.periodEnd.getTime()
}

// 今期の付与日数を解決する（実使用日数・残り日数の計算に使う）：
// 管理者が手動で上書きしていればその値、無ければ法定スケジュールの自動計算値
export function resolveTotalDays(override: number | null | undefined, period: PaidLeavePeriod): number {
  return override != null ? override : period.statutoryTotalDays
}

// 次回付与日に付与される予定の法定日数（表示専用のプレビュー値。手動上書きの対象外）
export function nextGrantDays(period: PaidLeavePeriod): number {
  const nextIndex = period.grantIndex == null ? 0 : period.grantIndex + 1
  return grantDaysForIndex(nextIndex)
}
