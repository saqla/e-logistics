"use client"

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type SiteHeaderProps = {
  appName?: string
  year: number
  month: number
  onPrev: () => void
  onNext: () => void
  onSave?: () => void
  saveDisabled?: boolean
  showSave?: boolean
  onBack?: () => void
  showBack?: boolean
}

export function SiteHeader({
  appName = 'Eロジスティクス',
  year,
  month,
  onPrev,
  onNext,
  onSave,
  saveDisabled = false,
  showSave = true,
  onBack,
  showBack = true,
}: SiteHeaderProps) {
  const router = useRouter()
  const back = () => (onBack ? onBack() : router.push('/'))

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-3">
          <div className="text-lg font-semibold text-gray-900">{appName}</div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            {/* 年月（矢印含む） */}
            <Button variant="ghost" className="text-base focus-visible:ring-0 focus-visible:ring-offset-0" onClick={onPrev}>◀</Button>
            <span className="text-xl sm:text-2xl font-semibold text-center whitespace-nowrap">{year}年 {month}月</span>
            <Button variant="ghost" className="text-base focus-visible:ring-0 focus-visible:ring-offset-0" onClick={onNext}>▶</Button>
            {/* 保存 */}
            {onSave && showSave ? (
              <Button className="ml-1 text-base sm:text-lg" onClick={onSave} disabled={saveDisabled}>保存</Button>
            ) : null}
            {/* アプリ選択に戻る */}
            {showBack ? (
              <Button className="text-base sm:text-lg" variant="outline" onClick={back}>アプリ選択に戻る</Button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

