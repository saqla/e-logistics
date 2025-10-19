"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { daysInMonth, getDow } from '@/lib/utils'
import { enumToRouteLabel, getCarColor, getRouteColor, ROUTE_LABELS, routeLabelToEnum, CAR_LABELS } from '@/lib/shift-constants'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Assignment = {
  day: number
  staffId: string
  route: string
  carNumber: string | null
  noteBL?: string | null
  noteBR?: string | null
}

export default function ShiftAppPage() {
  const { status, data: session } = useSession()
  const router = useRouter()
  const now = new Date()
  const [isPortrait, setPortrait] = useState(true)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(orientation: portrait)')
    const handler = (e: MediaQueryListEvent) => setPortrait(e.matches)
    setPortrait(mq.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [staffs, setStaffs] = useState<{id: string; name: string;}[]>([])
  const [picker, setPicker] = useState<{open: boolean; staffId: string | null; day: number | null; mode: 'route' | 'car' | 'noteBL' | 'noteBR'}>({ open: false, staffId: null, day: null, mode: 'route' })
  const [tempText, setTempText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setDirty] = useState(false)

  const applyRoute = (staffId: string, day: number, label: typeof ROUTE_LABELS[number]) => {
    const key = `${staffId}-${day}`
    const existing = aMap.get(key)
    const next: Assignment = {
      day,
      staffId,
      route: routeLabelToEnum(label) as any,
      carNumber: existing?.carNumber ?? null,
      noteBL: existing?.noteBL ?? null,
      noteBR: existing?.noteBR ?? null,
    }
    setAssignments(prev => {
      const others = prev.filter(x => !(x.staffId === next.staffId && x.day === next.day))
      return [...others, next]
    })
    setDirty(true)
  }

  const applyCar = (staffId: string, day: number, carLabel: string) => {
    const key = `${staffId}-${day}`
    const existing = aMap.get(key)
    const next: Assignment = {
      day,
      staffId,
      route: existing?.route ?? routeLabelToEnum('産直') as any, // 既存なければ暫定
      carNumber: carLabel === '' ? null : carLabel,
      noteBL: existing?.noteBL ?? null,
      noteBR: existing?.noteBR ?? null,
    }
    setAssignments(prev => {
      const others = prev.filter(x => !(x.staffId === next.staffId && x.day === next.day))
      return [...others, next]
    })
    setDirty(true)
  }

  const applyNote = (staffId: string, day: number, side: 'noteBL' | 'noteBR', text: string) => {
    const key = `${staffId}-${day}`
    const existing = aMap.get(key)
    const next: Assignment = {
      day,
      staffId,
      route: existing?.route ?? routeLabelToEnum('産直') as any,
      carNumber: existing?.carNumber ?? null,
      noteBL: side === 'noteBL' ? (text || null) : (existing?.noteBL ?? null),
      noteBR: side === 'noteBR' ? (text || null) : (existing?.noteBR ?? null),
    }
    setAssignments(prev => {
      const others = prev.filter(x => !(x.staffId === next.staffId && x.day === next.day))
      return [...others, next]
    })
    setDirty(true)
  }

  useEffect(() => {
    const fetchAll = async () => {
      const [aRes, sRes] = await Promise.all([
        fetch(`/api/shift?year=${year}&month=${month}`, { cache: 'no-store' }),
        fetch(`/api/staff?year=${year}&month=${month}`, { cache: 'no-store' }),
      ])
      const aJson = await aRes.json()
      const sJson = await sRes.json()
      setAssignments((aJson?.assignments || []).map((x: any) => ({ day: x.day, staffId: x.staffId, route: x.route, carNumber: x.carNumber ?? null, noteBL: x.noteBL ?? null, noteBR: x.noteBR ?? null })))
      // 表示順は固定：田中→丸山→坂下→伊藤（存在しない場合はスキップ）
      const order = ['田中','丸山','坂下','伊藤']
      const sorted = (sJson?.staffs || [])
        .filter((s: any) => order.includes(s.name))
        .sort((a: any, b: any) => order.indexOf(a.name) - order.indexOf(b.name))
        .map((s: any) => ({ id: s.id, name: s.name }))
      setStaffs(sorted)
    }
    fetchAll()
  }, [year, month])

  const monthDays = useMemo(() => daysInMonth(year, month), [year, month])
  const todayInfo = useMemo(() => {
    const t = new Date()
    const isSameMonth = t.getFullYear() === year && (t.getMonth() + 1) === month
    return { isSameMonth, day: isSameMonth ? t.getDate() : null }
  }, [year, month])

  const aMap = useMemo(() => {
    const m = new Map<string, Assignment>()
    for (const a of assignments) m.set(`${a.staffId}-${a.day}`, a)
    return m
  }, [assignments])

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-7xl mx-auto py-4 px-4">
        <div className="sticky top-0 bg-white border-b z-20">
          <div className="w-full px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between md:justify-center gap-2 md:gap-6">
            <h1 className="text-xl sm:text-2xl font-bold whitespace-nowrap ml-2 sm:ml-3">箱車シフト表</h1>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Button variant="ghost" className="text-base focus-visible:ring-0 focus-visible:ring-offset-0" onClick={() => setMonth(m => (m===1 ? (setYear(y=>y-1), 12) : m-1))}>◀</Button>
              <span className="text-xl sm:text-2xl font-semibold text-center tabular-nums">{year}年 {month}月</span>
              <Button variant="ghost" className="text-base focus-visible:ring-0 focus-visible:ring-offset-0" onClick={() => setMonth(m => (m===12 ? (setYear(y=>y+1), 1) : m+1))}>▶</Button>
              {!isPortrait && ((session as any)?.editorVerified && (typeof document === 'undefined' || !/(?:^|;\s*)editor_disabled=1(?:;|$)/.test(document.cookie || ''))) ? (
                <Button className="ml-2 sm:ml-3 text-base sm:text-lg hidden md:block" disabled={isSaving || !isDirty} onClick={async () => {
                  try {
                    setIsSaving(true)
                    const uniqueMap = new Map<string, Assignment>()
                    for (const a of assignments) {
                      const key = `${a.staffId}-${a.day}`
                      if (!uniqueMap.has(key)) uniqueMap.set(key, a)
                    }
                    const body = {
                      year,
                      month,
                      assignments: Array.from(uniqueMap.values()).map(a => ({
                        day: a.day,
                        staffId: a.staffId,
                        route: a.route,
                        carNumber: a.carNumber ?? null,
                        noteBL: a.noteBL ?? null,
                        noteBR: a.noteBR ?? null,
                      })),
                    }
                    const res = await fetch('/api/shift', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
                    if (!res.ok) {
                      const t = await res.text()
                      throw new Error(t || '保存に失敗しました')
                    }
                    setDirty(false)
                    const aRes = await fetch(`/api/shift?year=${year}&month=${month}`, { cache: 'no-store' })
                    const aJson = await aRes.json()
                    setAssignments((aJson?.assignments || []).map((x: any) => ({ day: x.day, staffId: x.staffId, route: x.route, carNumber: x.carNumber ?? null, noteBL: x.noteBL ?? null, noteBR: x.noteBR ?? null })))
                  } catch (e) {
                    console.error(e)
                    alert('保存に失敗しました。権限やネットワークを確認してください。')
                  } finally {
                    setIsSaving(false)
                  }
                }}>保存</Button>
              ) : null}
              {!isPortrait && (
                <Button className="ml-2 sm:ml-3 text-base sm:text-lg hidden md:block" variant="outline" onClick={() => router.push('/')}>アプリ選択に戻る</Button>
              )}
            </div>
          </div>
        </div>
        <div className="mb-3 mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded ${getRouteColor('産直')}`}>産直</span>
          <span className={`px-2 py-0.5 rounded ${getRouteColor('ドンキ(福岡)')}`}>ドンキ(福岡)</span>
          <span className={`px-2 py-0.5 rounded ${getRouteColor('ドンキ(長崎)')}`}>ドンキ(長崎)</span>
          <span className={`px-2 py-0.5 rounded ${getRouteColor('ユニック')}`}>ユニック</span>
          <span className={`px-2 py-0.5 rounded ${getRouteColor('休み')}`}>休み</span>
          <span className={`px-2 py-0.5 rounded ${getRouteColor('有給')}`}>有給</span>
        </div>
        <div className="overflow-x-auto border rounded-md bg-white">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 bg-white z-30 border-b p-2 text-left">名前</th>
                {Array.from({ length: monthDays }).map((_, i) => {
                  const d = i + 1
                  const dow = getDow(year, month, d)
                  const isToday = todayInfo.isSameMonth && todayInfo.day === d
                  const color = dow === 0 ? 'text-red-600' : dow === 6 ? 'text-blue-600' : 'text-gray-900'
                  return (
                    <th key={i} className={`sticky top-0 z-20 border-b p-2 text-center w-24 bg-white ${isToday ? 'bg-sky-50' : ''} ${color}`}>{d}</th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {staffs.map(st => (
                <tr key={st.id}>
                  <td className="sticky left-0 bg-white z-10 border-r p-2 font-medium">{st.name}</td>
                  {Array.from({ length: monthDays }).map((_, i) => {
                    const d = i+1
                    const a = aMap.get(`${st.id}-${d}`)
                    const label = a ? enumToRouteLabel(a.route) : null
                    const car = a?.carNumber ?? ''
                    const isToday = todayInfo.isSameMonth && todayInfo.day === d
                    const openRoutePicker = () => setPicker({ open: true, staffId: st.id, day: d, mode: 'route' })
                    const openCarPicker = () => setPicker({ open: true, staffId: st.id, day: d, mode: 'car' })
                    const openNoteBL = () => { setTempText(a?.noteBL ?? ''); setPicker({ open: true, staffId: st.id, day: d, mode: 'noteBL' }) }
                    const openNoteBR = () => { setTempText(a?.noteBR ?? ''); setPicker({ open: true, staffId: st.id, day: d, mode: 'noteBR' }) }
                    return (
                      <td key={d} className={`border p-0 align-top ${isToday ? 'bg-sky-50' : ''}`}>
                        <div className="grid grid-cols-2 grid-rows-2 h-16">
                          <button onClick={openRoutePicker} className={`col-span-1 row-span-1 flex items-center justify-center text-xs w-full h-full ${label?getRouteColor(label):''}`}>{label ?? ''}</button>
                          <button onClick={openCarPicker} className={`col-span-1 row-span-1 flex items-center justify-center text-xs w-full h-full ${getCarColor(car)}`}>{car}</button>
                          <button onClick={openNoteBL} className="col-span-1 row-span-1 border-t border-r p-1 text-xs text-gray-700 whitespace-pre-wrap text-left">
                            {a?.noteBL ?? ''}
                          </button>
                          <button onClick={openNoteBR} className="col-span-1 row-span-1 border-t p-1 text-xs text-gray-700 whitespace-pre-wrap text-left">
                            {a?.noteBR ?? ''}
                          </button>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Dialog open={picker.open} onOpenChange={(o) => { if (!o) { setPicker({ open: false, staffId: null, day: null, mode: 'route' }); setTempText('') } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {picker.mode === 'route' ? 'ルートを選択' : picker.mode === 'car' ? '車番を選択' : (picker.mode === 'noteBL' ? '左下セルを編集' : '右下セルを編集')}
              </DialogTitle>
            </DialogHeader>
            {picker.mode === 'route' ? (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ROUTE_LABELS.map(l => (
                  <button key={l} onClick={() => { if (picker.staffId && picker.day) { applyRoute(picker.staffId, picker.day, l); setPicker({ open: false, staffId: null, day: null, mode: 'route' }) } }} className={`px-3 py-2 rounded text-sm ${getRouteColor(l)}`}>{l}</button>
                ))}
              </div>
            ) : (
              picker.mode === 'car' ? (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {CAR_LABELS.map(c => (
                    <button key={c} onClick={() => { if (picker.staffId && picker.day) { applyCar(picker.staffId, picker.day, c); setPicker({ open: false, staffId: null, day: null, mode: 'route' }) } }} className={`px-3 py-2 rounded text-sm ${getCarColor(c)}`}>{c || '空白'}</button>
                  ))}
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <textarea value={tempText} onChange={e => setTempText(e.target.value)} className="w-full h-24 border rounded p-2 text-sm" placeholder="テキストを入力" />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setPicker({ open: false, staffId: null, day: null, mode: 'route' }); setTempText('') }}>キャンセル</Button>
                    <Button onClick={() => { if (picker.staffId && picker.day) { applyNote(picker.staffId, picker.day, picker.mode as ('noteBL'|'noteBR'), tempText); setPicker({ open: false, staffId: null, day: null, mode: 'route' }); setTempText('') } }}>保存</Button>
                  </div>
                </div>
              )
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}


