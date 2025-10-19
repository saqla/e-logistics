"use client"

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { SiteHeader } from '@/components/site-header'
import { daysInMonth } from '@/lib/utils'
import { enumToRouteLabel, getCarColor, getRouteColor } from '@/lib/shift-constants'
import { Button } from '@/components/ui/button'

type Assignment = {
  day: number
  staffId: string
  route: string
  carNumber: string | null
  noteBL?: string | null
  noteBR?: string | null
}

export default function ShiftAppPage() {
  const { status } = useSession()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [staffs, setStaffs] = useState<{id: string; name: string;}[]>([])

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

  const aMap = useMemo(() => {
    const m = new Map<string, Assignment>()
    for (const a of assignments) m.set(`${a.staffId}-${a.day}`, a)
    return m
  }, [assignments])

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main className="max-w-7xl mx-auto py-4 px-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-2xl font-bold">箱車シフト表</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setMonth(m => (m===1 ? (setYear(y=>y-1), 12) : m-1))}>前月</Button>
            <div className="text-sm font-medium tabular-nums">{year}年 {month}月</div>
            <Button variant="outline" onClick={() => setMonth(m => (m===12 ? (setYear(y=>y+1), 1) : m+1))}>翌月</Button>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
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
                <th className="sticky left-0 bg-white z-10 border-b p-2 text-left">名前</th>
                {Array.from({ length: monthDays }).map((_, i) => (
                  <th key={i} className="border-b p-2 text-center w-24">{i+1}</th>
                ))}
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
                    return (
                      <td key={d} className="border p-0 align-top">
                        <div className="grid grid-cols-2 grid-rows-2 h-16">
                          <div className={`col-span-1 row-span-1 flex items-center justify-center text-xs ${label?getRouteColor(label):''}`}>{label ?? ''}</div>
                          <div className={`col-span-1 row-span-1 flex items-center justify-center text-xs ${getCarColor(car)}`}>{car}</div>
                          <div className="col-span-1 row-span-1 border-t border-r p-1 text-xs text-gray-700 whitespace-pre-wrap">{a?.noteBL ?? ''}</div>
                          <div className="col-span-1 row-span-1 border-t p-1 text-xs text-gray-700 whitespace-pre-wrap">{a?.noteBR ?? ''}</div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}


