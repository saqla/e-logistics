import { prisma } from '@/lib/prisma'

// 有給休暇の「今期」計算ロジック。
// 入社日を基準にした直近の付与アニバーサリー日〜次のアニバーサリー日前日を1期間とする
// （日本の一般的な有給付与サイクルに合わせる）。

// staffs テーブルに有給管理用の列が無ければ追加（先行デプロイ分との互換）
export async function ensurePaidLeaveColumns() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "staffs" ADD COLUMN IF NOT EXISTS "hireDate" TIMESTAMP(3);`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "staffs" ADD COLUMN IF NOT EXISTS "paidLeaveTotalDays" INTEGER DEFAULT 0;`)
  } catch {}
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + years)
  return d
}

export type PaidLeavePeriod = {
  tenureYears: number   // 継続年数（直近アニバーサリー時点での満年数）
  periodStart: Date     // 今期の開始日（直近アニバーサリー）
  periodEnd: Date       // 今期の終了日（次回アニバーサリー、この日は含まない）
}

// hireDateを基準に、指定日(today)時点で「今期」に該当する期間を返す
export function currentPaidLeavePeriod(hireDate: Date, today: Date = new Date()): PaidLeavePeriod {
  let years = today.getFullYear() - hireDate.getFullYear()
  let anniversary = addYears(hireDate, years)
  if (anniversary.getTime() > today.getTime()) {
    years -= 1
    anniversary = addYears(hireDate, years)
  }
  const periodStart = anniversary
  const periodEnd = addYears(hireDate, years + 1)
  return { tenureYears: years, periodStart, periodEnd }
}

// 次回付与年月（"次のアニバーサリー"の年月）を "YYYY年M月" 形式で返す
export function formatNextGrantMonth(periodEnd: Date): string {
  return `${periodEnd.getFullYear()}年${periodEnd.getMonth() + 1}月`
}

// 指定の(year,month,day)が期間 [periodStart, periodEnd) に含まれるか
export function isDateInPeriod(year: number, month: number, day: number, period: PaidLeavePeriod): boolean {
  const d = new Date(year, month - 1, day)
  return d.getTime() >= period.periodStart.getTime() && d.getTime() < period.periodEnd.getTime()
}
