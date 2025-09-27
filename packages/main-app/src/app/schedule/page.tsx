"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { daysInMonth, getDow, isHoliday } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type Staff = { id: string; name: string; kind: 'ALL'|'UNIC'|'HAKO'|'JIMU'; lowerCount: number }

type Note = { day: number; slot: number; text: string }
type RouteKind = 'EZAKI_DONKI' | 'SANCHOKU' | 'MARUNO_DONKI'
type RouteSpecial = 'CONTINUE' | 'OFF' | null
type RouteAssignment = { day: number; route: RouteKind; staffId: string | null; special: RouteSpecial }
type LowerAssignment = { day: number; rowIndex: number; staffId: string | null }

const ROUTE_LABEL: Record<RouteKind, string> = {
  EZAKI_DONKI: '江ドンキ',
  SANCHOKU: '産直',
  MARUNO_DONKI: '丸ドンキ'
}

export default function SchedulePage() {
  const { status } = useSession()
  const router = useRouter()

  // 認証ガード
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const today = new Date()
  const [ym, setYm] = useState<{year:number, month:number}>({ year: today.getFullYear(), month: today.getMonth()+1 })
  const days = 31

  const [staffs, setStaffs] = useState<Staff[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [routes, setRoutes] = useState<RouteAssignment[]>([])
  const [lowers, setLowers] = useState<LowerAssignment[]>([])
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [monthChangeOpen, setMonthChangeOpen] = useState(false)
  const [pendingMove, setPendingMove] = useState<number | null>(null)
  // 入力順トラッキング（セルごとにシーケンス番号を付与）
  const [lowerSeqCounter, setLowerSeqCounter] = useState(0)
  const [cellSeq, setCellSeq] = useState<Record<string, number>>({})

  // スクロール同期用参照と状態
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scrollContentWidth, setScrollContentWidth] = useState(0)
  const syncingFrom = useRef<"top"|"main"|null>(null)

  // data load
  const loadAll = async () => {
    // JSON以外（HTMLエラー等）でも落ちないように安全に読み取る
    const readJsonSafe = async (res: Response): Promise<any> => {
      try {
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('application/json')) {
          const t = await res.text()
          console.warn('Non-JSON response', res.status, t.slice(0, 200))
          return { __nonJson: true, status: res.status, text: t }
        }
        return await res.json()
      } catch (e) {
        console.warn('JSON parse failed', res.status, e)
        return { __parseError: true, status: res.status }
      }
    }

    try {
      const [staffRes, schedRes] = await Promise.all([
        fetch(`/api/staff?year=${ym.year}&month=${ym.month}`, { cache: 'no-store' }),
        fetch(`/api/schedule?year=${ym.year}&month=${ym.month}`, { cache: 'no-store' })
      ])

      const staffData = await readJsonSafe(staffRes)
      if (staffRes.ok && !staffData.__nonJson && !staffData.__parseError) {
        setStaffs(staffData.staffs || [])
      } else {
        setStaffs([])
      }

      const sched = await readJsonSafe(schedRes)
      if (schedRes.ok && !sched.__nonJson && !sched.__parseError) {
        setNotes((sched.notes || []).map((n: any) => ({ day: n.day, slot: n.slot, text: n.text || '' })))
        setRoutes((sched.routes || []).map((r: any) => ({ day: r.day, route: r.route, staffId: r.staffId, special: r.special })))
        setLowers((sched.lowers || []).map((l: any) => ({ day: l.day, rowIndex: l.rowIndex, staffId: l.staffId })))
      } else {
        setNotes([])
        setRoutes([])
        setLowers([])
      }

      setIsDirty(false)
    } catch (e) {
      console.warn('loadAll failed', e)
      setStaffs([])
      setNotes([])
      setRoutes([])
      setLowers([])
    }
  }

  useEffect(() => { loadAll() }, [ym])

  const title = useMemo(() => `${ym.year}年${ym.month}月`, [ym])
  const proceedMove = (d: number) => {
    const date = new Date(ym.year, ym.month - 1 + d, 1)
    setYm({ year: date.getFullYear(), month: date.getMonth() + 1 })
  }
  const move = (d: number) => {
    if (isDirty) {
      setPendingMove(d)
      setMonthChangeOpen(true)
      return
    }
    proceedMove(d)
  }

  // 上側・下側スクロールの相互同期
  const handleTopScroll = () => {
    if (syncingFrom.current === 'main') return
    syncingFrom.current = 'top'
    const top = topScrollRef.current
    const main = mainScrollRef.current
    if (top && main) {
      main.scrollLeft = top.scrollLeft
    }
    syncingFrom.current = null
  }

  const handleMainScroll = () => {
    if (syncingFrom.current === 'top') return
    syncingFrom.current = 'main'
    const top = topScrollRef.current
    const main = mainScrollRef.current
    if (top && main) {
      top.scrollLeft = main.scrollLeft
    }
    syncingFrom.current = null
  }

  // helpers
  const getNote = (day: number, slot: number) => notes.find(n => n.day === day && n.slot === slot)?.text || ''
  const setNote = (day: number, slot: number, text: string) => {
    setNotes(prev => {
      const idx = prev.findIndex(p => p.day === day && p.slot === slot)
      if (idx >= 0) { const next = [...prev]; next[idx] = { day, slot, text }; return next }
      return [...prev, { day, slot, text }]
    })
    setIsDirty(true)
  }

  const getRoute = (day: number, route: RouteKind): RouteAssignment | undefined => routes.find(r => r.day === day && r.route === route)
  const setRoute = (day: number, route: RouteKind, staffId: string | null, special: RouteSpecial) => {
    setRoutes(prev => {
      const idx = prev.findIndex(p => p.day === day && p.route === route)
      const value = { day, route, staffId, special }
      if (idx >= 0) { const next = [...prev]; next[idx] = value; return next }
      return [...prev, value]
    })
    setIsDirty(true)
  }

  const getLower = (day: number, rowIndex: number) => lowers.find(l => l.day === day && l.rowIndex === rowIndex)?.staffId || null
  const setLower = (day: number, rowIndex: number, staffId: string | null) => {
    setLowers(prev => {
      const idx = prev.findIndex(p => p.day === day && p.rowIndex === rowIndex)
      const value = { day, rowIndex, staffId }
      if (idx >= 0) { const next = [...prev]; next[idx] = value; return next }
      return [...prev, value]
    })
    // シーケンス付与（再選択でも新しい番号を採番。未選択に戻したら削除）
    const key = `${day}-${rowIndex}`
    if (staffId) {
      setLowerSeqCounter(prevCnt => {
        const next = prevCnt + 1
        setCellSeq(prev => ({ ...prev, [key]: next }))
        return next
      })
    } else {
      setCellSeq(prev => {
        if (prev[key] === undefined) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
    setIsDirty(true)
  }

  // duplicate prevention in lowers (same day must be unique)
  const canSelectLower = (day: number, staffId: string | null, rowIndex: number) => {
    if (!staffId) return true
    const exists = lowers.find(l => l.day === day && l.staffId === staffId && l.rowIndex !== rowIndex)
    return !exists
  }

  // ピンク強調の閾値（この回数以上で強調）。必要に応じて変更してください。
  const LOWER_PINK_THRESHOLD = 9

  // 現在選択されているセル全体の「通し順位」（1始まり）を算出
  const lowerKeyRankMap = useMemo(() => {
    const entries = Object.entries(cellSeq)
    // 通し番号の小さい順に並べ、現在残っているものだけで順位を再計算
    entries.sort((a, b) => a[1] - b[1])
    const map: Record<string, number> = {}
    entries.forEach(([k], idx) => { map[k] = idx + 1 })
    return map
  }, [cellSeq])

  const lowerMonthlyCount = (staffId: string | null) => {
    if (!staffId) return 0
    return lowers.filter(l => l.staffId === staffId).length
  }

  // 指定セルまでの同スタッフの選択回数（同日内は rowIndex で順序付け）
  const lowerCountUpToCell = (staffId: string | null, day: number, rowIndex: number) => {
    if (!staffId) return 0
    return lowers.filter(l =>
      l.staffId === staffId && (
        l.day < day || (l.day === day && l.rowIndex <= rowIndex)
      )
    ).length
  }

  // 各スタッフごとの並び順を事前計算（day→rowIndex）
  const lowerOrderMap = useMemo(() => {
    const byStaff: Record<string, LowerAssignment[]> = {}
    for (const l of lowers) {
      if (!l.staffId) continue
      if (!byStaff[l.staffId]) byStaff[l.staffId] = []
      byStaff[l.staffId].push(l)
    }
    const map = new Map<string, Map<string, number>>()
    for (const [sid, arr] of Object.entries(byStaff)) {
      arr.sort((a, b) => (a.day - b.day) || (a.rowIndex - b.rowIndex))
      const inner = new Map<string, number>()
      arr.forEach((l, idx) => inner.set(`${l.day}-${l.rowIndex}`, idx + 1))
      map.set(sid, inner)
    }
    return map
  }, [lowers])

  const clearAllNotes = () => {
    if (!confirm('上段メモを全てクリアします。よろしいですか？')) return
    setNotes([])
    setIsDirty(true)
  }

  const handleSave = async (): Promise<boolean> => {
    setSaving(true)
    try {
      const payload = {
        year: ym.year,
        month: ym.month,
        notes,
        routes,
        lowers
      }
      const res = await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert(e.error || '保存に失敗しました')
        return false
      }
      alert('保存しました')
      setIsDirty(false)
      return true
    } finally {
      setSaving(false)
    }
  }

  const clearAllLowers = () => {
    if (!confirm('下段の全ての名前をクリアします。よろしいですか？')) return
    const arr: LowerAssignment[] = []
    for (let d = 1; d <= 31; d++) {
      for (let r = 1; r <= 13; r++) {
        arr.push({ day: d, rowIndex: r, staffId: null })
      }
    }
    setLowers(arr)
    // 採番もリセット
    setLowerSeqCounter(0)
    setCellSeq({})
    setIsDirty(true)
  }

  // 右サイドの共通内容
  const RightSideContent = ({ compact = false }: { compact?: boolean }) => (
    <>
      <div className="border rounded-md p-3 w-full break-words">
        <div className="mb-2">
          <div className="font-semibold text-center text-xl">備考</div>
        </div>
        <RemarkPanel compact={compact} />
      </div>

      <div className="border rounded-md p-3 w-full break-words mt-4 md:mt-0">
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => router.push('/staff')}>スタッフ一覧管理</Button>
          <Button variant="outline" onClick={clearAllNotes}>上段メモを全クリア</Button>
          <Button variant="destructive" onClick={clearAllLowers}>下段を全クリア</Button>
        </div>
      </div>
    </>
  )

  const headerCell = (day: number) => {
    const dow = getDow(ym.year, ym.month, day)
    const isHol = isHoliday(ym.year, ym.month, day)
    const color = isHol ? 'text-red-600' : (dow === 6 ? 'text-blue-600' : 'text-gray-900')
    return <div className={`flex items-center justify-center text-base font-semibold tabular-nums ${color}`}>{day}</div>
  }

  // Note dialog state
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDay, setNoteDay] = useState<number | null>(null)
  const [noteSlot, setNoteSlot] = useState<number>(1)
  const [noteText, setNoteText] = useState('')
  const [noteClipboard, setNoteClipboard] = useState<string | null>(null)
  const openNote = (day: number, slot: number) => { setNoteDay(day); setNoteSlot(slot); setNoteText(getNote(day, slot)); setNoteOpen(true) }
  const saveNote = () => { if (noteDay) setNote(noteDay, noteSlot, noteText); setNoteOpen(false) }
  const copyNoteText = async (text: string) => {
    if (!text) return
    setNoteClipboard(text)
    try { await (navigator as any)?.clipboard?.writeText?.(text) } catch {}
  }
  const pasteIntoEditor = async () => {
    if (noteClipboard) { setNoteText(noteClipboard); setIsDirty(true); return }
    try {
      const t = await (navigator as any)?.clipboard?.readText?.()
      if (typeof t === 'string') { setNoteText(t); setIsDirty(true) }
    } catch {}
  }

  const monthDays = daysInMonth(ym.year, ym.month)
  const todayCol = useMemo(() => {
    if (ym.year === today.getFullYear() && ym.month === (today.getMonth() + 1)) {
      return today.getDate()
    }
    return null
  }, [ym])

  // 月変更時は採番リセット
  useEffect(() => {
    setLowerSeqCounter(0)
    setCellSeq({})
  }, [ym])

  // 未保存データがある場合、ページ離脱時に警告
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // コンテンツ幅の監視（内容変化やリサイズに追従）
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const updateWidth = () => setScrollContentWidth(el.scrollWidth)
    updateWidth()
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateWidth())
      ro.observe(el)
    }
    const onResize = () => updateWidth()
    window.addEventListener('resize', onResize)
    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // レスポンシブ列幅
  const [leftColPx, setLeftColPx] = useState(64)
  const [dayColPx, setDayColPx] = useState(56)
  const computeGridCols = useCallback(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 0
    // 余白見積り：左右パディング(px-4)=32, main-aside gap=16
    const sidePadding = 32
    const gap = 16
    const left = 56
    if (w >= 1440) {
      const aside = 300
      const availableForDays = w - sidePadding - gap - aside - left
      // xlは31日表示（従来どおり）
      let perDay = Math.floor(availableForDays / 31)
      perDay = Math.max(30, Math.min(perDay, 56))
      setLeftColPx(left)
      setDayColPx(perDay)
    } else if (w >= 1200) { // lg以上
      const aside = 260
      const availableForDays = w - sidePadding - gap - aside - left
      // lgは20日表示に固定（横スクロールあり）
      let perDay = Math.floor(availableForDays / 20)
      perDay = Math.max(24, Math.min(perDay, 56))
      setLeftColPx(left)
      setDayColPx(perDay)
    } else if (w >= 768) { // md以上（タブレット想定）
      const aside = 240
      const availableForDays = w - sidePadding - gap - aside - left
      // mdも20日表示に固定（横スクロールあり）
      let perDay = Math.floor(availableForDays / 20)
      perDay = Math.max(18, Math.min(perDay, 40))
      setLeftColPx(left)
      setDayColPx(perDay)
    } else {
      // スマホ：1画面に7日分が収まるように計算（asideは非表示）
      const leftMobile = 52
      const visibleDays = 7
      const availableForDays = w - sidePadding - leftMobile
      let perDay = Math.floor(availableForDays / visibleDays)
      // 下限/上限（上限は広めにして1週間表示の変化を確実に反映）
      perDay = Math.max(12, Math.min(perDay, 56))
      setLeftColPx(leftMobile)
      setDayColPx(perDay)
    }
  }, [])

  useEffect(() => {
    computeGridCols()
    window.addEventListener('resize', computeGridCols)
    return () => window.removeEventListener('resize', computeGridCols)
  }, [computeGridCols])

  const GRID_TEMPLATE = `${leftColPx}px repeat(31, ${dayColPx}px)`

  // モバイルで右サイドを開くボタン/ダイアログ
  const [asideOpen, setAsideOpen] = useState(false)
  const [showFab, setShowFab] = useState(false)
  // 検索モーダル
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<'month'|'jump'>('month')
  const [highlightDays, setHighlightDays] = useState<Set<number>>(new Set())
  const [searchResults, setSearchResults] = useState<{ day: number; where: 'note'|'lower'; snippet: string }[]>([])

  const idToName = useMemo(() => new Map(staffs.map(s => [s.id, s.name])), [staffs])
  const scrollToDay = (day: number) => {
    const main = mainScrollRef.current
    const top = topScrollRef.current
    if (!main) return
    const offset = Math.max(0, leftColPx + dayColPx * (day - 1) - dayColPx * 2)
    main.scrollLeft = offset
    if (top) top.scrollLeft = offset
  }
  const runSearch = () => {
    const q = searchQuery.trim().toLowerCase()
    const days = new Set<number>()
    const results: { day: number; where: 'note'|'lower'; snippet: string }[] = []
    if (!q) { setSearchResults([]); setHighlightDays(new Set()); return }
    // 上段メモ本文
    for (const n of notes) {
      const text = (n.text || '')
      if (text.toLowerCase().includes(q)) {
        days.add(n.day)
        results.push({ day: n.day, where: 'note', snippet: text })
      }
    }
    // 下段の担当者名
    for (const l of lowers) {
      const name = l.staffId ? (idToName.get(l.staffId) || '') : ''
      if (name && name.toLowerCase().includes(q)) {
        days.add(l.day)
        results.push({ day: l.day, where: 'lower', snippet: name })
      }
    }
    setSearchResults(results)
    if (searchScope === 'month') {
      setHighlightDays(days)
    } else {
      if (results.length > 0) {
        const first = Math.min(...results.map(r => r.day))
        setHighlightDays(new Set([first]))
        scrollToDay(first)
      } else {
        setHighlightDays(new Set())
      }
      setSearchOpen(false)
    }
  }
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop
      setShowFab(y > 48)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function FloatingAsideButton({ onClick, visible }: { onClick: () => void, visible: boolean }) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])
    if (!mounted || typeof document === 'undefined') return null
    return createPortal(
      <div className="md:hidden fixed inset-0 z-50 pointer-events-none">
        <button
          type="button"
          onClick={onClick}
          className="absolute rounded-full bg-blue-600 text-white px-4 py-3 shadow-xl hover:bg-blue-700 pointer-events-auto transition-transform duration-300"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))', right: 'calc(1rem + env(safe-area-inset-right))' }}
          aria-label="備考と管理を開く"
          data-visible={visible}
          
        >
          備考/管理
        </button>
      </div>,
      document.body
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="sticky top-0 bg-white border-b z-20">
        <div className="w-full px-4 py-3 flex items-center justify-center gap-14">
          <h1 className="text-lg sm:text-base font-bold">月予定表</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="focus-visible:ring-0 focus-visible:ring-offset-0" onClick={() => move(-1)}>◀</Button>
            <span className="text-2xl font-semibold w-40 text-center">{title}</span>
            <Button variant="ghost" className="focus-visible:ring-0 focus-visible:ring-offset-0" onClick={() => move(1)}>▶</Button>
            <Button className="ml-4 text-base" onClick={handleSave} disabled={saving}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></span>
                  保存中...
                </span>
              ) : (
                '保存'
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="w-full flex gap-4 items-start">
          {/* 左: テーブル本体 + 上側スクロールバー */}
          <div className="flex-1 min-w-0">
            {/* 上側スクロールバー（メインと同期） */}
            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              className="overflow-x-auto border border-gray-200 rounded-md mb-2 bg-white"
              style={{ height: 14 }}
              aria-label="スケジュール上部スクロール"
            >
              <div style={{ width: `${scrollContentWidth}px`, height: 1 }} />
            </div>
            {/* メインスクロールコンテナ */}
            <div
              ref={mainScrollRef}
              onScroll={handleMainScroll}
              className="overflow-x-auto border border-gray-200 rounded-md bg-white"
            >
              <div ref={contentRef}>
            {/* ヘッダー行（31日ぶん） */}
            <div className="grid" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
              <div className="sticky left-0 bg-gray-50 border-b border-r border-gray-300 px-1 py-2 font-semibold text-center z-10"></div>
            {Array.from({length: 31}).map((_, i) => (
                <div
                  key={i}
                  className={`border-b ${i===0 ? 'border-l border-gray-300' : ''} px-2 py-2 ${i+1>monthDays? 'bg-gray-50' : ''} ${todayCol && (i+1===todayCol) ? 'bg-sky-50' : ''} ${highlightDays.has(i+1) ? 'ring-2 ring-amber-400' : ''}`}
                >
                  {headerCell(i+1)}
                </div>
              ))}
            </div>
            {/* メモ4行（セル結合なし） */}
            <TooltipProvider>
              {Array.from({ length: 4 }).map((_, slotIdx) => (
                <div key={`memo-row-${slotIdx}`} className="grid" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                  <div className={`sticky left-0 bg-white border-r border-gray-300 px-1 h-10 flex items-center justify-center text-center z-10 ${slotIdx === 0 || slotIdx === 3 ? 'border-b' : 'border-b-0'}`}>
                    {slotIdx === 0 ? 'メモ' : ''}
                  </div>
                  {Array.from({ length: 31 }).map((_, i) => {
                    const d = i + 1
                    const slot = slotIdx + 1
                    const text = getNote(d, slot)
                    return (
                      <Tooltip key={`memo-${slot}-${d}`}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => d <= monthDays && openNote(d, slot)}
                            className={`border-b ${i===0 ? 'border-l border-gray-300' : ''} px-2 h-10 hover:bg-yellow-50 overflow-hidden flex items-center justify-center ${d>monthDays?'bg-gray-50 cursor-not-allowed':''} ${todayCol && d===todayCol ? 'bg-sky-50' : ''} ${highlightDays.has(d) ? 'ring-2 ring-amber-400' : ''}`}
                          >
                            {text ? (
                              <span className="inline-block max-w-full bg-yellow-200 text-yellow-900 text-xs px-2 py-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis text-center">{text}</span>
                            ) : null}
                          </button>
                        </TooltipTrigger>
                        {text ? (
                          <TooltipContent
                            side={slotIdx >= 2 ? 'top' : 'bottom'}
                            align="center"
                            sideOffset={12}
                            alignOffset={0}
                            avoidCollisions={false}
                            collisionPadding={8}
                            className="max-w-sm whitespace-pre-wrap shadow-lg border bg-white z-50"
                          >
                            {text}
                          </TooltipContent>
                        ) : null}
                      </Tooltip>
                    )
                  })}
                </div>
              ))}
            </TooltipProvider>

            {/* ルート行（江ドンキ / 産直 / 丸ドンキ） */}
            {(['EZAKI_DONKI','SANCHOKU','MARUNO_DONKI'] as RouteKind[]).map((rk, idx) => (
              <div key={rk} className="grid" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
              <div className={`sticky left-0 bg-white border-b border-r border-gray-300 ${idx===0 ? 'border-t' : ''} px-1 py-2 text-center z-10 font-medium ${rk==='EZAKI_DONKI' || rk==='MARUNO_DONKI' ? 'text-xs' : ''}`}>{ROUTE_LABEL[rk]}</div>
              {Array.from({length: 31}).map((_,i) => {
                const d=i+1
                const r=getRoute(d, rk)
                return (
                  <div key={d} className={`border-b ${idx===0 ? 'border-t' : ''} ${i===0 ? 'border-l border-gray-300' : ''} px-1 py-2 ${d>monthDays?'bg-gray-50':''} ${todayCol && d===todayCol ? 'bg-sky-50' : ''} ${highlightDays.has(d) ? 'ring-2 ring-amber-400' : ''}`}>
                    {d<=monthDays && (
                      <div className="relative h-5">
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm font-medium">
                          {(() => {
                            if (r?.special === 'CONTINUE') return '―'
                            if (r?.special === 'OFF') return <span className="text-xl font-semibold text-red-700">×</span>
                            if (r?.staffId) {
                              const m = new Map(staffs.map(s => [s.id, s.name]))
                              return m.get(r.staffId) || ''
                            }
                            return ''
                          })()}
                        </div>
                        <select
                          className="absolute inset-0 w-full h-full opacity-0 appearance-none bg-transparent outline-none"
                          value={r?.special ? r.special : (r?.staffId || '')}
                          onChange={(e)=>{
                            const v = e.target.value
                            if (v === '') { setRoute(d, rk, null, null); return }
                            if (v === 'CONTINUE' || v === 'OFF') { setRoute(d, rk, null, v as RouteSpecial); return }
                            setRoute(d, rk, v, null)
                          }}
                        >
                          <option value=""></option>
                          <option value="CONTINUE">―</option>
                          <option value="OFF">×</option>
                          {staffs.filter(s=> s.kind==='ALL' || s.kind==='HAKO').map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {d>monthDays && <span></span>}
                  </div>
                )
              })}
              </div>
            ))}

            {/* 下段ヘッダー（日付再掲） */}
            <div className="grid" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
            <div className="sticky left-0 bg-gray-50 border-b border-r border-gray-300 px-1 py-2 font-semibold text-center z-10"></div>
            {Array.from({length: 31}).map((_,i) => (
              <div
                key={`lower-h-${i}`}
                className={`border-b border-gray-300 ${i===0 ? 'border-l border-gray-300' : ''} ${i===30 ? 'border-r border-gray-300' : ''} px-2 py-2 ${i+1>monthDays? 'bg-gray-50' : ''} ${todayCol && (i+1===todayCol) ? 'bg-sky-50' : ''} ${highlightDays.has(i+1) ? 'ring-2 ring-amber-400' : ''}`}
              >
                {headerCell(i+1)}
              </div>
            ))}
            </div>

            {/* 下段13行 */}
            {Array.from({length: 13}).map((_,rowIdx) => (
              <div key={rowIdx} className="grid" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
              <div className="sticky left-0 bg-white border-b border-r border-gray-300 px-1 py-2 text-center z-10">{rowIdx+1}</div>
              {Array.from({length: 31}).map((_,i) => {
                const d=i+1
                const staffId = getLower(d, rowIdx+1)
                const key = `${d}-${rowIdx+1}`
                const rank = staffId ? (lowerKeyRankMap[key] || 0) : 0
                const bg = rank >= LOWER_PINK_THRESHOLD ? 'bg-pink-100' : ''
                return (
                  <div key={`l-${rowIdx+1}-${d}`} className={`border-b ${i===0 ? 'border-l border-gray-300' : ''} px-1 py-2 ${bg} ${d>monthDays?'bg-gray-50':''} ${todayCol && d===todayCol ? 'bg-sky-50' : ''} ${highlightDays.has(d) ? 'ring-2 ring-amber-400' : ''}`} title={`${staffId ?? ''}#${rank}`}>
                    {d<=monthDays && (
                      <div className="relative h-5">
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm">
                          {(() => {
                            if (!staffId) return ''
                            const m = new Map(staffs.map(s => [s.id, s.name]))
                            return m.get(staffId) || ''
                          })()}
                        </div>
                        <select
                          className="absolute inset-0 w-full h-full opacity-0 appearance-none bg-transparent outline-none"
                          value={staffId || ''}
                          onChange={(e)=>{
                            const v = e.target.value
                            const sid = v === '' ? null : v
                            if (!canSelectLower(d, sid, rowIdx+1)) { alert('同じ日に同じ名前は選べません'); return }
                            setLower(d, rowIdx+1, sid)
                          }}
                        >
                          <option value=""></option>
                          {staffs.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
            ))}
              </div>
            </div>
          </div>

          {/* 右サイド：備考パネル + 管理ボタン */}
          <aside className="hidden md:block flex-none space-y-4 w-[240px] lg:w-[260px] xl:w-[300px]">
            <RightSideContent />
            <div className="border rounded-md p-3 w-full break-words mt-4">
              <Button className="w-full text-base" variant="outline" onClick={()=>setSearchOpen(true)}>検索</Button>
            </div>
          </aside>
        </div>
      </div>

      {/* モバイル用 フローティングボタン（常に画面右下） */}
      <FloatingAsideButton onClick={() => setAsideOpen(true)} visible={showFab} />

      {/* 上段メモ 編集ダイアログ */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上段メモ入力（{noteDay}日／{noteSlot}）</DialogTitle>
          </DialogHeader>
          <textarea
            className="w-full h-40 border rounded-md p-2"
            value={noteText}
            onChange={(e)=>setNoteText(e.target.value)}
          />
          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => copyNoteText(noteText)}
                disabled={!noteText}
                title="エディタの内容をコピー"
              >
                コピー
              </Button>
              <Button
                variant="outline"
                onClick={pasteIntoEditor}
                title="クリップボードから貼り付け"
              >
                ペースト
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => { if (noteDay) { setNote(noteDay, noteSlot, ''); setNoteText(''); setNoteOpen(false) } }}
              >
                削除
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={()=>setNoteOpen(false)}>キャンセル</Button>
                <Button onClick={saveNote}>保存</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 月変更 確認ダイアログ */}
      <Dialog open={monthChangeOpen} onOpenChange={setMonthChangeOpen}>
        <DialogContent className="bg-amber-50 text-amber-900 border border-amber-200 shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              未保存の変更があります
            </DialogTitle>
            <DialogDescription>
              月を変更すると未保存の編集内容は破棄されます。続行しますか？
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setMonthChangeOpen(false)} disabled={saving}>キャンセル</Button>
            <Button
              variant="secondary"
              onClick={async () => {
                if (pendingMove !== null) {
                  const ok = await handleSave()
                  if (ok) {
                    setMonthChangeOpen(false)
                    proceedMove(pendingMove)
                    setPendingMove(null)
                  }
                }
              }}
              disabled={saving}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"></span>
                  保存中...
                </span>
              ) : (
                '保存してから移動'
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingMove !== null) {
                  setMonthChangeOpen(false)
                  setIsDirty(false)
                  proceedMove(pendingMove)
                  setPendingMove(null)
                }
              }}
              disabled={saving}
            >
              変更を破棄して移動
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* モバイル用 右サイド ダイアログ */}
      <Dialog open={asideOpen} onOpenChange={setAsideOpen}>
        <DialogContent className="md:hidden max-w-md">
          <DialogHeader>
            <DialogTitle>備考・管理</DialogTitle>
          </DialogHeader>
          <RightSideContent compact />
          <div className="mt-3">
            <Button className="w-full" variant="outline" onClick={()=>{ setAsideOpen(false); setSearchOpen(true) }}>検索</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 検索ダイアログ */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>スケジュール検索</DialogTitle>
            <DialogDescription>キーワードで当月または全体から検索します。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="q">キーワード</Label>
              <Input id="q" value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="名前 / メモ / × / ― など" />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="scope" checked={searchScope==='month'} onChange={()=>setSearchScope('month')} /> 当月をハイライト
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="scope" checked={searchScope==='jump'} onChange={()=>setSearchScope('jump')} /> 全体から最初の一致へジャンプ
              </label>
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-64 overflow-auto border rounded p-2 bg-white">
                <div className="text-sm text-gray-600 mb-1">{searchResults.length}件ヒット</div>
                <ul className="space-y-1">
                  {searchResults.map((r, idx) => (
                    <li key={idx}>
                      <button
                        className="w-full text-left text-sm underline hover:text-blue-700"
                        onClick={() => { setSearchOpen(false); setHighlightDays(new Set([r.day])); scrollToDay(r.day) }}
                      >
                        {r.day}日 [{r.where==='note' ? '上段メモ' : '下段'}] — {r.snippet}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setSearchOpen(false)}>閉じる</Button>
              <Button onClick={runSearch}>検索</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 備考エリア コンポーネント（簡易実装）
type Remark = { id: string; title: string; body: string }

function useRemarks() {
  const [items, setItems] = useState<Remark[]>([])
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    fetch('/api/remarks', { cache: 'no-store' }).then(r=>r.json()).then(d=> setItems(d.remarks || []))
  }, [refresh])
  return { items, refresh, setRefresh }
}

function RemarkPanel({ compact = false }: { compact?: boolean }) {
  const { items, setRefresh } = useRemarks()
  const first3 = items.slice(0,3)
  const rest = items.slice(3)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'create'|'edit'>('create')
  const [target, setTarget] = useState<Remark | undefined>(undefined)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const openCreate = () => { setMode('create'); setTarget(undefined); setTitle(''); setBody(''); setOpen(true) }
  const openEdit = (r: Remark) => { setMode('edit'); setTarget(r); setTitle(r.title); setBody(r.body); setOpen(true) }

  const save = async () => {
    const payload = { title: title.trim(), body: body.trim() }
    const url = mode==='create' ? '/api/remarks' : `/api/remarks/${target!.id}`
    const method = mode==='create' ? 'POST' : 'PATCH'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { alert('保存に失敗しました'); return }
    setOpen(false); setRefresh(v=>v+1)
  }

  const del = async (id: string) => {
    const res = await fetch(`/api/remarks/${id}`, { method: 'DELETE' })
    if (!res.ok) { alert('削除に失敗しました'); return }
    setRefresh(v=>v+1)
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button size="sm" className="text-base" onClick={openCreate}>新規</Button>
      </div>
      {!compact ? (
        <div className="space-y-2">
          {first3.map(r => (
            <div key={r.id} className="border rounded p-2 break-words">
              <div className="font-medium text-lg break-words">{r.title}</div>
              <div className="text-base text-gray-700 whitespace-pre-wrap break-words">{r.body}</div>
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" className="text-base" variant="outline" onClick={()=>openEdit(r)}>編集</Button>
                <Button size="sm" className="text-base" variant="destructive" onClick={()=>del(r.id)}>削除</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {[...first3, ...rest].map((r) => (
            <button
              key={r.id}
              className="block w-full text-left underline break-words whitespace-normal text-base"
              onClick={() => openEdit(r)}
            >
              {r.title}
            </button>
          ))}
        </div>
      )}

      {!compact && rest.length > 0 && (
        <div className="mt-3">
          <div className="text-sm text-gray-600 mb-1">その他（タイトルのみ）</div>
          <div className="space-y-1">
            {rest.map((r) => (
              <button
                key={r.id}
                className="block w-full text-left underline break-words whitespace-normal text-base"
                onClick={() => openEdit(r)}
              >
                {r.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode==='create' ? '備考を追加' : '備考を編集'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="rtitle">タイトル</Label>
              <Input id="rtitle" value={title} onChange={(e)=>setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rbody">本文</Label>
              <textarea id="rbody" className="w-full h-40 border rounded-md p-2" value={body} onChange={(e)=>setBody(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={()=>setOpen(false)}>キャンセル</Button>
            <Button onClick={save}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


