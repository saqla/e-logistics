"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/site-header'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { daysInMonth, getDow, isHoliday } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// 画面の向きを監視してportraitを検知
function useIsPortrait() {
  const [isPortrait, setIsPortrait] = useState<boolean>(false)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(orientation: portrait)')
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches)
    mq.addEventListener?.('change', handler)
    // 初期同期
    setIsPortrait(mq.matches)
    return () => mq.removeEventListener?.('change', handler)
  }, [])
  return isPortrait
}

type Staff = { id: string; name: string; kind: 'ALL'|'UNIC'|'HAKO'|'JIMU'; lowerCount: number }

type Note = { day: number; slot: number; text: string }
type RouteKind = 'EZAKI_DONKI' | 'SANCHOKU' | 'MARUNO_DONKI'
type RouteSpecial = 'CONTINUE' | 'OFF' | null
type RouteAssignment = { day: number; route: RouteKind; staffId: string | null; special: RouteSpecial }
type LowerAssignment = { day: number; rowIndex: number; staffId: string | null; color?: 'WHITE' | 'PINK' }

const ROUTE_LABEL: Record<RouteKind, string> = {
  EZAKI_DONKI: '江D',
  SANCHOKU: '産直',
  MARUNO_DONKI: '丸D'
}

export default function SchedulePage() {
  const { status, data: session } = useSession()
  const router = useRouter()
  const isPortrait = useIsPortrait()
  const [vw, setVw] = useState(0)
  const [vh, setVh] = useState(0)
  useEffect(() => {
    const onResize = () => {
      if (typeof window === 'undefined') return
      setVw(window.innerWidth)
      setVh(window.innerHeight)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const isPhonePortrait = isPortrait && vw > 0 && vw < 768
  const isTabletPortrait = isPortrait && vw >= 768 && vw < 1200
  const isTabletLandscape = !isPortrait && vw >= 768 && vw < 1200
  const isLg = vw >= 1200 && vw < 1440
  const isXl = vw >= 1440 && vw < 1536
  const is2xl = vw >= 1536
  const isLgUp = isLg || isXl || is2xl
  const isPhoneLandscape = !isPortrait && vh > 0 && vh < 500
  const cellPadX = (isPhonePortrait || isTabletPortrait || isPhoneLandscape || isTabletLandscape)
    ? 'px-1'
    : (is2xl ? 'px-1.5' : (isXl ? 'px-3' : (isLg ? 'px-3' : 'px-2')))
  const headerPadY = (isPhoneLandscape || isTabletLandscape)
    ? 'py-1.5 md:py-3'
    : (is2xl ? 'py-2' : (isXl ? 'py-3' : (isLg ? 'py-3' : 'py-2 md:py-3')))
  const headerBarPad = (isPhoneLandscape || isTabletLandscape)
    ? 'px-2 py-1.5 sm:px-4 sm:py-3'
    : (is2xl ? 'px-4 py-2' : (isXl ? 'px-5 py-3' : (isLg ? 'px-5 py-3' : 'px-3 py-2 sm:px-4 sm:py-3')))

  // Note color utility: encode color marker at the start of text
  type NoteColor = 'white' | 'yellow' | 'blue' | 'green' | 'orange'
  const colorToMarker: Record<NoteColor, string> = { white: '[[w]]', yellow: '[[y]]', blue: '[[b]]', green: '[[g]]', orange: '[[o]]' }
  const markerToColor: Record<string, NoteColor> = { '[[w]]': 'white', '[[y]]': 'yellow', '[[b]]': 'blue', '[[g]]': 'green', '[[o]]': 'orange' }
  function parseNoteColor(raw: string | undefined): { color: NoteColor; content: string } {
    if (!raw) return { color: 'white', content: '' }
    for (const m of Object.keys(markerToColor)) {
      if (raw.startsWith(m)) {
        return { color: markerToColor[m], content: raw.slice(m.length) }
      }
    }
    return { color: 'white', content: raw }
  }

  // 認証ガード
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const today = new Date()
  const [ym, setYm] = useState<{year:number, month:number}>({ year: today.getFullYear(), month: today.getMonth()+1 })
  // const days = 31

  const [staffs, setStaffs] = useState<Staff[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [routes, setRoutes] = useState<RouteAssignment[]>([])
  const [lowers, setLowers] = useState<LowerAssignment[]>([])
  const [saving, setSaving] = useState(false)
  const editorVerified = (session as any)?.editorVerified === true
  const [isDirty, setIsDirty] = useState(false)
  const [monthChangeOpen, setMonthChangeOpen] = useState(false)
  const [pendingMove, setPendingMove] = useState<number | null>(null)
  // 入力順トラッキング（セルごとにシーケンス番号を付与）
  const [lowerSeqCounter, setLowerSeqCounter] = useState(0)
  const [cellSeq, setCellSeq] = useState<Record<string, number>>({})
  // BottomBar連携は廃止（備考起動のみ維持）

  // スクロール同期用参照と状態
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scrollContentWidth, setScrollContentWidth] = useState(0)
  const syncingFrom = useRef<"top"|"main"|null>(null)

  // Long-press config and helper
  const LONG_PRESS_MS = 500
  const LONG_PRESS_MOVE_CANCEL_PX = 12
  const makeLongPressHandlers = (onTrigger: () => void) => {
    let timer: any = null
    let startX = 0
    let startY = 0
    let cancelled = false
    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = null }
      cancelled = true
      detachScroll()
    }
    const getPoint = (e: any) => {
      if (e.touches && e.touches[0]) { return { x: e.touches[0].clientX, y: e.touches[0].clientY } }
      if (e.changedTouches && e.changedTouches[0]) { return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } }
      return { x: e.clientX ?? 0, y: e.clientY ?? 0 }
    }
    const onStart = (e: any) => {
      cancelled = false
      const p = getPoint(e)
      startX = p.x
      startY = p.y
      attachScroll()
      timer = setTimeout(() => { if (!cancelled) onTrigger() }, LONG_PRESS_MS)
    }
    const onMove = (e: any) => {
      if (!timer) return
      const p = getPoint(e)
      const dx = p.x - startX
      const dy = p.y - startY
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_CANCEL_PX) {
        cancel()
      }
    }
    const onEnd = () => cancel()
    const onLeave = () => cancel()
    const onCancel = () => cancel()
    const onScroll = () => cancel()
    const attachScroll = () => {
      mainScrollRef.current?.addEventListener('scroll', onScroll, { passive: true })
      topScrollRef.current?.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    }
    const detachScroll = () => {
      mainScrollRef.current?.removeEventListener('scroll', onScroll as any)
      topScrollRef.current?.removeEventListener('scroll', onScroll as any)
      window.removeEventListener('scroll', onScroll as any, true)
    }
    return {
      onMouseDown: onStart,
      onMouseUp: onEnd,
      onMouseLeave: onLeave,
      onTouchStart: onStart,
      onTouchMove: onMove,
      onTouchEnd: onEnd,
      onTouchCancel: onCancel,
    } as const
  }

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
        setLowers((sched.lowers || []).map((l: any) => ({ day: l.day, rowIndex: l.rowIndex, staffId: l.staffId, color: l.color })))
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
  const getLowerColor = (day: number, rowIndex: number): 'WHITE' | 'PINK' => {
    return lowers.find(l => l.day === day && l.rowIndex === rowIndex)?.color || 'WHITE'
  }
  const setLower = (day: number, rowIndex: number, staffId: string | null) => {
    setLowers(prev => {
      const idx = prev.findIndex(p => p.day === day && p.rowIndex === rowIndex)
      const value = { day, rowIndex, staffId, color: idx>=0 ? (prev[idx].color || 'WHITE') : 'WHITE' }
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

  // 下段セルの色（ユーザー選択）: key `${day}-${rowIndex}` -> 'white' | 'pink'
  type LowerColor = 'white' | 'pink'
  const [lowerColorMap, setLowerColorMap] = useState<Record<string, LowerColor>>({})
  const [lowerPickerOpen, setLowerPickerOpen] = useState(false)
  const [lowerPickerKey, setLowerPickerKey] = useState<string | null>(null)
  const applyLowerColor = (color: LowerColor) => {
    if (!lowerPickerKey) return
    setLowerColorMap(prev => ({ ...prev, [lowerPickerKey]: color }))
    // 即時保存のためにlowersにも反映（次の保存APIでDBへ）
    const [dStr, rStr] = lowerPickerKey.split('-')
    const d = Number(dStr), r = Number(rStr)
    setLowers(prev => {
      const idx = prev.findIndex(p => p.day === d && p.rowIndex === r)
      if (idx < 0) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], color: color === 'pink' ? 'PINK' : 'WHITE' }
      return next
    })
    if (editorVerified) setIsDirty(true)
    setLowerPickerOpen(false)
  }

  // 未使用: 全セルの通し順位マップ（必要になったら復元）
  // const lowerKeyRankMap = useMemo(() => {
  //   const entries = Object.entries(cellSeq)
  //   entries.sort((a, b) => a[1] - b[1])
  //   const map: Record<string, number> = {}
  //   entries.forEach(([k], idx) => { map[k] = idx + 1 })
  //   return map
  // }, [cellSeq])

  // スタッフごとの「選択順（通し）」を算出（cellSeqベース）。欠番は除外。
  const perStaffSelectionRankMap = useMemo(() => {
    const seqByStaff = new Map<string, Map<string, number>>()
    lowers.forEach((l) => {
      if (!l.staffId) return
      const key = `${l.day}-${l.rowIndex}`
      const seq = cellSeq[key]
      if (seq === undefined) return
      const existing = seqByStaff.get(l.staffId)
      const inner = existing ? existing : new Map<string, number>()
      inner.set(key, seq)
      if (!existing) seqByStaff.set(l.staffId, inner)
    })
    const rankByStaff = new Map<string, Map<string, number>>()
    seqByStaff.forEach((inner, sid) => {
      const sorted = Array.from(inner.entries()).sort((a: [string, number], b: [string, number]) => a[1] - b[1])
      const rankMap = new Map<string, number>()
      sorted.forEach(([k], idx) => { rankMap.set(k, idx + 1) })
      rankByStaff.set(sid, rankMap)
    })
    return rankByStaff
  }, [lowers, cellSeq])

  // 未使用: 月内選択回数（必要になったら復元）
  // const lowerMonthlyCount = (staffId: string | null) => {
  //   if (!staffId) return 0
  //   return lowers.filter(l => l.staffId === staffId).length
  // }

  // 未使用: 指定セルまでの選択回数（必要になったら復元）
  // const lowerCountUpToCell = (staffId: string | null, day: number, rowIndex: number) => {
  //   if (!staffId) return 0
  //   return lowers.filter(l =>
  //     l.staffId === staffId && (
  //       l.day < day || (l.day === day && l.rowIndex <= rowIndex)
  //     )
  //   ).length
  // }

  // 未使用: 各スタッフの並び順マップ（必要になったら復元）
  // const lowerOrderMap = useMemo(() => {
  //   const byStaff: Record<string, LowerAssignment[]> = {}
  //   for (const l of lowers) {
  //     if (!l.staffId) continue
  //     if (!byStaff[l.staffId]) byStaff[l.staffId] = []
  //     byStaff[l.staffId].push(l)
  //   }
  //   const map = new Map<string, Map<string, number>>()
  //   for (const [sid, arr] of Object.entries(byStaff)) {
  //     arr.sort((a, b) => (a.day - b.day) || (a.rowIndex - b.rowIndex))
  //     const inner = new Map<string, number>()
  //     arr.forEach((l, idx) => inner.set(`${l.day}-${l.rowIndex}`, idx + 1))
  //     map.set(sid, inner)
  //   }
  //   return map
  // }, [lowers])

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
      const data = await res.json().catch(() => ({}))
      if (data?.timings) console.log('schedule save timings', data.timings)
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
        {!compact && (
          <div className="mb-2">
            <div className="font-semibold text-center text-xl">備考</div>
          </div>
        )}
        <RemarkPanel compact={compact} />
      </div>

      <div className="mt-4 md:mt-0">
        <div className="font-semibold text-center text-xl mb-2">管理</div>
        <div className="border rounded-md p-3 w-full break-words">
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => router.push('/staff')}>スタッフ一覧管理</Button>
            <Button variant="outline" onClick={clearAllNotes}>上段メモを全クリア</Button>
            <Button variant="destructive" onClick={clearAllLowers}>下段を全クリア</Button>
          </div>
        </div>
      </div>
    </>
  )

  const headerCell = (day: number) => {
    const dow = getDow(ym.year, ym.month, day)
    const isHol = isHoliday(ym.year, ym.month, day)
    const color = isHol ? 'text-red-600' : (dow === 6 ? 'text-blue-600' : 'text-gray-900')
    const sizeCls = isPhonePortrait ? 'text-lg' : 'text-base md:text-lg'
    return <div className={`flex items-center justify-center ${sizeCls} font-semibold tabular-nums ${color}`}>{day}</div>
  }

  // Note dialog state
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDay, setNoteDay] = useState<number | null>(null)
  const [noteSlot, setNoteSlot] = useState<number>(1)
  const [noteText, setNoteText] = useState('')
  const [noteClipboard, setNoteClipboard] = useState<string | null>(null)
  const [noteMode, setNoteMode] = useState<'view'|'edit'>('edit')
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)
  // color picker state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerDay, setPickerDay] = useState<number | null>(null)
  const [pickerSlot, setPickerSlot] = useState<number>(1)
  const applyColor = (color: NoteColor) => {
    if (!pickerDay) return
    const prev = getNote(pickerDay, pickerSlot)
    const parsed = parseNoteColor(prev)
    const composed = `${colorToMarker[color]}${parsed.content}`
    setNote(pickerDay, pickerSlot, composed)
    setPickerOpen(false)
  }
  const openNote = (day: number, slot: number) => {
    setNoteDay(day)
    setNoteSlot(slot)
    const t = getNote(day, slot)
    const parsed = parseNoteColor(t)
    setNoteText(parsed.content)
    // 権限がなければ常に閲覧モード
    setNoteMode(editorVerified ? (t ? 'view' : 'edit') : 'view')
    setNoteOpen(true)
  }
  const saveNote = () => {
    if (!noteDay) return
    // keep current color marker if any
    const prev = getNote(noteDay, noteSlot)
    const { color } = parseNoteColor(prev)
    const composed = `${colorToMarker[color]}${noteText}`
    setNote(noteDay, noteSlot, composed)
    setNoteOpen(false)
  }
  useEffect(() => {
    if (noteOpen && noteMode === 'edit') {
      // 次フレームでフォーカス
      setTimeout(() => noteTextareaRef.current?.focus(), 0)
    }
  }, [noteOpen, noteMode])
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

  // BottomBar連携のステート通知は撤去

  // BottomBarからのキャンセル/削除要求の受信は撤去

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
    const h = typeof window !== 'undefined' ? window.innerHeight : 0
    // 余白見積り：モバイルは左右パディング(px-2)=16, それ以外は32。main-aside gap=16
    const isMobile = w < 768
    const sidePadding = isMobile ? 16 : 32
    const gap = 16
    const left = 56
    // portraitのmd（タブレット縦）はモバイル相当に扱う
    if (!isMobile && w >= 768 && w < 1200 && isPortrait) {
      const leftMobile = 48
      const visibleDays = 5 // iPad縦もスマホ縦と同等の5日表示に
      const availableForDays = w - sidePadding - leftMobile
      let perDay = Math.floor(availableForDays / visibleDays)
      perDay = Math.max(16, Math.min(perDay, 56))
      setLeftColPx(leftMobile)
      setDayColPx(perDay)
      return
    }
    // スマホ横（landscape）は高さで判定（~500px未満を目安）し、7日表示
    if (!isPortrait && h > 0 && h < 500) {
      const leftMobile = 48
      const visibleDays = 7
      const availableForDays = w - sidePadding - leftMobile
      let perDay = Math.floor(availableForDays / visibleDays)
      perDay = Math.max(16, Math.min(perDay, 56))
      setLeftColPx(leftMobile)
      setDayColPx(perDay)
      return
    }
    if (!isMobile && w >= 768 && w < 1200 && !isPortrait) {
      // iPad横は12日表示
      const aside = 240
      const availableForDays = w - sidePadding - gap - aside - left
      let perDay = Math.floor(availableForDays / 12)
      perDay = Math.max(24, Math.min(perDay, 56))
      setLeftColPx(left)
      setDayColPx(perDay)
    } else if (w >= 1536) {
      // 2xlは20日表示
      const aside = 300
      const availableForDays = w - sidePadding - gap - aside - left
      let perDay = Math.floor(availableForDays / 20)
      perDay = Math.max(24, Math.min(perDay, 56))
      setLeftColPx(left)
      setDayColPx(perDay)
    } else if (w >= 1440) {
      // xlは15日表示（視認性重視）
      const aside = 300
      const availableForDays = w - sidePadding - gap - aside - left
      let perDay = Math.floor(availableForDays / 15)
      perDay = Math.max(28, Math.min(perDay, 56))
      setLeftColPx(left)
      setDayColPx(perDay)
    } else if (w >= 1200) { // lg以上
      const aside = 260
      const availableForDays = w - sidePadding - gap - aside - left
      // lgは12日表示（横スクロールあり）
      let perDay = Math.floor(availableForDays / 12)
      perDay = Math.max(28, Math.min(perDay, 56))
      setLeftColPx(left)
      setDayColPx(perDay)
    } else if (w >= 768) { // md以上（タブレット想定）
      const aside = 240
      const availableForDays = w - sidePadding - gap - aside - left
      // mdも15日表示に固定（横スクロールあり）
      let perDay = Math.floor(availableForDays / 15)
      perDay = Math.max(24, Math.min(perDay, 50))
      setLeftColPx(left)
      setDayColPx(perDay)
    } else {
      // スマホ：1画面に5日分が収まるように計算（asideは非表示）
      const leftMobile = 48
      const visibleDays = 5
      const availableForDays = w - sidePadding - leftMobile
      let perDay = Math.floor(availableForDays / visibleDays)
      // 下限/上限（上限は広めにして1週間表示の変化を確実に反映）
      perDay = Math.max(14, Math.min(perDay, 56))
      setLeftColPx(leftMobile)
      setDayColPx(perDay)
    }
  }, [isPortrait])

  useEffect(() => {
    computeGridCols()
    window.addEventListener('resize', computeGridCols)
    return () => window.removeEventListener('resize', computeGridCols)
  }, [computeGridCols])

  const GRID_TEMPLATE = `${leftColPx}px repeat(31, ${dayColPx}px)`

  // モバイルで右サイドを開くボタン/ダイアログ
  const [asideOpen, setAsideOpen] = useState(false)
  // 検索モーダル
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<'month'|'jump'>('month')
  const [highlightDays, setHighlightDays] = useState<Set<number>>(new Set())
  const [searchResults, setSearchResults] = useState<{ day: number; where: 'note'|'lower'; snippet: string }[]>([])

  // 入力デバイスがタッチかどうか
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => { setIsTouch(typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) }, [])

  // 備考ダイアログをBottomBarから開くためのイベントリスナー
  useEffect(() => {
    const handleOpenRemarks = (event: Event) => {
      console.log('Received openRemarksDialog event', event);
      setAsideOpen(true);
    };
    window.addEventListener('openRemarksDialog', handleOpenRemarks);
    return () => window.removeEventListener('openRemarksDialog', handleOpenRemarks);
  }, []);

  // BottomBar との保存イベント連携を復帰
  const handleSaveRef = useRef(handleSave)
  useEffect(() => { handleSaveRef.current = handleSave }, [handleSave])
  useEffect(() => {
    const onReq = (_e: Event) => { handleSaveRef.current() }
    window.addEventListener('requestScheduleSave', onReq)
    return () => window.removeEventListener('requestScheduleSave', onReq)
  }, [])

  // saving状態をBottomBarへ通知
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ev = new CustomEvent('scheduleSavingState', { detail: { saving } })
    window.dispatchEvent(ev)
  }, [saving])

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
  // フローティングボタン関連のスクロール監視は不要になったため削除
  // useEffect(() => {
  //   const onScroll = () => {
  //     const y = window.scrollY || document.documentElement.scrollTop
  //     setShowFab(y > 48)
  //   }
  //   onScroll()
  //   window.addEventListener('scroll', onScroll, { passive: true })
  //   return () => window.removeEventListener('scroll', onScroll)
  // }, [])

  // 削除: FloatingAsideButton コンポーネント
  // function FloatingAsideButton({ onClick, visible }: { onClick: () => void, visible: boolean }) {
  //   const [mounted, setMounted] = useState(false)
  //   useEffect(() => { setMounted(true) }, [])
  //   if (!mounted || typeof document === 'undefined') return null
  //   return createPortal(
  //     <div className="md:hidden fixed inset-0 z-50 pointer-events-none">
  //       <button
  //         type="button"
  //         onClick={onClick}
  //         className="absolute rounded-full bg-blue-600 text-white px-4 py-3 text-lg sm:text-base shadow-xl hover:bg-blue-700 pointer-events-auto transition-transform duration-300"
  //         style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))', right: 'calc(1rem + env(safe-area-inset-right))' }}
  //         aria-label="備考と管理を開く"
  //         data-visible={visible}
  //       >
  //         備考/管理
  //       </button>
  //     </div>,
  //     document.body
  //   )
  // }

  return (
    <div className={`min-h-screen bg-white text-gray-900 overflow-x-hidden ${(isPhonePortrait || isTabletPortrait || isPhoneLandscape) ? 'pb-24' : ''}`}>
      <SiteHeader appName="月予定表" />
      <div className="sticky top-0 bg-white border-b z-20">
        <div className={`w-full ${headerBarPad} flex items-center justify-between md:justify-center gap-1 sm:gap-2 md:gap-14`}>
          <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
            <Button variant="ghost" className="text-base focus-visible:ring-0 focus-visible:ring-offset-0" onClick={() => move(-1)}>◀</Button>
            <span className="text-xl sm:text-2xl font-semibold text-center whitespace-nowrap">{title}</span>
            <Button variant="ghost" className="text-base focus-visible:ring-0 focus-visible:ring-offset-0" onClick={() => move(1)}>▶</Button>
            {!isPortrait && (
              <Button className="ml-2 sm:ml-4 text-base sm:text-lg hidden md:block" onClick={handleSave} disabled={saving || !editorVerified}>
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></span>
                    保存中...
                  </span>
                ) : (
                  '保存'
                )}
              </Button>
            )}
            {!isPortrait && (
              <Button className="ml-2 sm:ml-3 text-base sm:text-lg hidden md:block" variant="outline" onClick={() => router.push('/')}>アプリ選択に戻る</Button>
            )}
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
                className={`border-b ${i===0 ? 'border-l border-gray-300' : ''} ${cellPadX} ${headerPadY} ${i+1>monthDays? 'bg-gray-50' : ''} ${todayCol && (i+1===todayCol) ? 'bg-sky-50' : ''} ${highlightDays.has(i+1) ? 'ring-2 ring-amber-400' : ''}`}
                >
                  {i+1 <= monthDays ? headerCell(i+1) : null}
                </div>
              ))}
            </div>
            {/* メモ4行（セル結合なし） */}
            <TooltipProvider>
              {Array.from({ length: 4 }).map((_, slotIdx) => (
                <div key={`memo-row-${slotIdx}`} className="grid" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                  <div className={`sticky left-0 bg-white border-r border-gray-300 px-1 h-10 md:h-12 flex items-center justify-center text-center z-10 font-semibold ${slotIdx === 0 || slotIdx === 3 ? 'border-b' : 'border-b-0'}`}>
                    {slotIdx === 0 ? 'メモ' : ''}
                  </div>
                  {Array.from({ length: 31 }).map((_, i) => {
                    const d = i + 1
                    const slot = slotIdx + 1
                    const rawText = getNote(d, slot)
                    const parsed = parseNoteColor(rawText)
                    const text = parsed.content
                    const badgeCls = parsed.color === 'white'
                      ? 'bg-white text-gray-900 border border-gray-300'
                      : parsed.color === 'yellow'
                        ? 'bg-yellow-200 text-yellow-900'
                        : parsed.color === 'blue'
                          ? 'bg-blue-200 text-blue-900'
                          : parsed.color === 'green'
                            ? 'bg-green-200 text-green-900'
                            : 'bg-orange-200 text-orange-900'
                    const plainNoteCls = parsed.color === 'white'
                      ? ''
                      : parsed.color === 'yellow'
                        ? 'bg-yellow-200 text-yellow-900'
                        : parsed.color === 'blue'
                          ? 'bg-blue-200 text-blue-900'
                          : parsed.color === 'green'
                            ? 'bg-green-200 text-green-900'
                            : 'bg-orange-200 text-orange-900'
                    // long-press handlers with movement/scroll cancellation
                    const lpHandlers = makeLongPressHandlers(() => { setPickerDay(d); setPickerSlot(slot); setPickerOpen(true) })
                    return (
                      <Tooltip key={`memo-${slot}-${d}`}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => d <= monthDays && openNote(d, slot)}
                            {...lpHandlers}
                            className={`border-b ${i===0 ? 'border-l border-gray-300' : ''} ${cellPadX} h-11 md:h-12 hover:bg-yellow-50 overflow-hidden flex items-center justify-center ${d>monthDays?'bg-gray-50 cursor-not-allowed':''} ${todayCol && d===todayCol ? 'bg-sky-50' : ''} ${highlightDays.has(d) ? 'ring-2 ring-amber-400' : ''}`}
                          >
                            {text ? (
                              isLgUp ? (
                                <span className={`${plainNoteCls} ${isPhonePortrait ? 'text-base' : 'text-sm md:text-base'} whitespace-nowrap overflow-hidden text-ellipsis text-center`}>{text}</span>
                              ) : (
                                <span className={`inline-block max-w-full ${badgeCls} ${isPhonePortrait ? 'text-base' : 'text-sm md:text-base'} px-2 py-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis text-center`}>{text}</span>
                              )
                            ) : null}
                          </button>
                        </TooltipTrigger>
                        {!isTouch && text ? (
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
              <div className={`sticky left-0 bg-white border-b border-r border-gray-300 ${idx===0 ? 'border-t' : ''} px-1 ${isPhoneLandscape ? 'py-1.5' : 'py-1'} text-center z-10 flex items-center justify-center font-semibold`} style={{lineHeight: 1}}>{ROUTE_LABEL[rk]}</div>
              {Array.from({length: 31}).map((_,i) => {
                const d=i+1
                const r=getRoute(d, rk)
                return (
                  <div key={d} className={`border-b ${idx===0 ? 'border-t' : ''} ${i===0 ? 'border-l border-gray-300' : ''} px-1 h-11 md:h-12 ${d>monthDays?'bg-gray-50':''} ${todayCol && d===todayCol ? 'bg-sky-50' : ''} ${highlightDays.has(d) ? 'ring-2 ring-amber-400' : ''}`}>
                    {d<=monthDays && (
                      <div className="relative h-full">
                        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${isPhonePortrait ? 'text-sm' : 'text-[13px] sm:text-sm md:text-base'} font-medium whitespace-nowrap overflow-hidden text-ellipsis`}>
                          {(() => {
                            if (r?.special === 'CONTINUE') {
                              return (
                                <span aria-hidden="true" className="block w-full border-t border-gray-400" />
                              )
                            }
                            if (r?.special === 'OFF') return <span className="text-xl font-semibold text-red-700">×</span>
                            if (r?.staffId) {
                              return idToName.get(r.staffId) || ''
                            }
                            return ''
                          })()}
                        </div>
                        <select disabled={!editorVerified}
                          className="absolute inset-0 w-full h-full opacity-0 appearance-none bg-transparent outline-none text-sm md:text-base max-sm:text-lg"
                          value={r?.special ? r.special : (r?.staffId || '')}
                          onChange={(e)=>{
                            if (!editorVerified) return
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
                className={`border-b border-gray-300 ${i===0 ? 'border-l border-gray-300' : ''} ${i===30 ? 'border-r border-gray-300' : ''} ${cellPadX} ${headerPadY} ${i+1>monthDays? 'bg-gray-50' : ''} ${todayCol && (i+1===todayCol) ? 'bg-sky-50' : ''} ${highlightDays.has(i+1) ? 'ring-2 ring-amber-400' : ''}`}
              >
                {i+1 <= monthDays ? headerCell(i+1) : null}
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
                const selRank = staffId ? (perStaffSelectionRankMap.get(staffId)?.get(key) || 0) : 0
                const chosen = lowerColorMap[key]
                const persisted = getLowerColor(d, rowIdx+1) === 'PINK' ? 'pink' : 'white'
                const effective = chosen || persisted
                const bg = effective === 'pink' ? 'bg-pink-100' : ''
                const textColorCls = effective === 'pink' ? 'text-pink-900' : 'text-gray-900'
                const lpHandlersLower = editorVerified ? makeLongPressHandlers(() => { setLowerPickerKey(key); setLowerPickerOpen(true) }) : {}
                return (
                  <div
                    key={`l-${rowIdx+1}-${d}`}
                    {...lpHandlersLower}
                    className={`border-b ${i===0 ? 'border-l border-gray-300' : ''} px-1 h-11 md:h-12 ${bg} ${d>monthDays?'bg-gray-50':''} ${todayCol && d===todayCol ? 'bg-sky-50' : ''} ${highlightDays.has(d) ? 'ring-2 ring-amber-400' : ''}`}
                    title={`${staffId ?? ''}#${selRank}`}
                  >
                    {d<=monthDays && (
                      <div className="relative h-full">
                        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${isPhonePortrait ? 'text-base' : 'text-sm md:text-base'} whitespace-nowrap overflow-hidden text-ellipsis ${textColorCls}`}>
                          {(() => {
                            if (!staffId) return ''
                            return idToName.get(staffId) || ''
                          })()}
                        </div>
                        <select disabled={!editorVerified}
                          className="absolute inset-0 w-full h-full opacity-0 appearance-none bg-transparent outline-none text-sm md:text-base max-sm:text-lg"
                          value={staffId || ''}
                          onChange={(e)=>{
                            if (!editorVerified) return
                            const v = e.target.value
                            const sid = v === '' ? null : v
                            // 空選択はそのまま反映
                            if (!sid) { setLower(d, rowIdx+1, null); return }
                            // 同日重複がある場合は置き換え確認
                            if (!canSelectLower(d, sid, rowIdx+1)) {
                              const ok = confirm('同じ日に同じ名前が既に選択されています。置き換えますか？')
                              if (!ok) return
                              const prev = lowers.find(l => l.day === d && l.staffId === sid)
                              if (prev) {
                                setLower(d, prev.rowIndex, null)
                              }
                            }
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
          {!isPortrait && (
            <aside className="hidden md:block flex-none space-y-4 w-[240px] lg:w-[260px] xl:w-[300px]">
              <RightSideContent />
              <div className="border rounded-md p-3 w-full break-words mt-4">
                <Button className="w-full text-base" variant="outline" onClick={()=>setSearchOpen(true)}>検索</Button>
                <div className="mt-4 flex justify-center">
                  <img src="/logo.png" alt="E-Logistics Logo" className="w-[50%] h-auto object-contain" />
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* 削除: モバイル用 フローティングボタン */}
      {/* <FloatingAsideButton onClick={() => setAsideOpen(true)} visible={showFab} /> */}

      {/* 上段メモ 閲覧/編集ダイアログ */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="text-lg bg-white">
          <DialogHeader>
            <DialogTitle>上段メモ入力（{noteDay}日／{noteSlot}）</DialogTitle>
          </DialogHeader>
          {/* 上部ツールバー：左=コピー中テキスト、右=コピー/ペースト */}
          <div className="flex items-start justify-between gap-2 mt-1">
            <div className="text-base text-gray-600 break-words max-w-[60%]">
              {noteClipboard ? (
                <span>コピー中: <span className="font-medium">{noteClipboard}</span></span>
              ) : (
                <span>コピー中のテキストはありません</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button className="text-base"
                variant="secondary"
                onClick={() => copyNoteText(noteText)}
                disabled={!noteText}
                title="内容をコピー"
              >
                コピー
              </Button>
              <Button className="text-base"
                variant="outline"
                onClick={pasteIntoEditor}
                title="クリップボードから貼り付け"
              >
                ペースト
              </Button>
            </div>
          </div>

          {/* 本文（閲覧 or 編集） */}
          {noteMode === 'view' ? (
            <button
              type="button"
              className="w-full min-h-[10rem] border rounded-md p-3 bg-gray-50 whitespace-pre-wrap mt-2 text-left relative"
              onClick={() => editorVerified && setNoteMode('edit')}
              title="タップで編集"
            >
              <span className="absolute right-2 top-2 text-xs text-gray-500">タップで編集</span>
              {noteText || <span className="text-gray-400">（内容なし）</span>}
            </button>
          ) : (
            <textarea
              ref={noteTextareaRef}
              className="w-full h-40 border rounded-md p-2 mt-2 text-sm max-sm:text-lg"
              value={noteText}
              onChange={(e)=>setNoteText(e.target.value)}
            />
          )}

          {/* 下部アクション */}
          {noteMode === 'view' ? (
            <div className="flex items-center justify-end gap-2 mt-2">
              <Button className="text-base" variant="outline" onClick={()=>setNoteOpen(false)}>閉じる</Button>
              {editorVerified ? (
                <Button className="text-base"
                  variant="destructive"
                  onClick={() => { if (noteDay) { setNote(noteDay, noteSlot, ''); setNoteText(''); setNoteOpen(false) } }}
                >
                  削除
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 mt-2">
              <Button className="text-base"
                variant="destructive"
                onClick={() => { if (noteDay) { setNote(noteDay, noteSlot, ''); setNoteText(''); setNoteOpen(false) } }}
              >
                削除
              </Button>
              <Button className="text-base" variant="outline" onClick={()=>setNoteOpen(false)}>キャンセル</Button>
              <Button className="text-base" onClick={saveNote} disabled={!editorVerified}>完了</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* メモ色ピッカー */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">メモの背景色を選択</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            <button className="border rounded p-2 bg-white text-gray-800" onClick={()=>applyColor('white')}>白</button>
            <button className="border rounded p-2 bg-yellow-200 text-yellow-900" onClick={()=>applyColor('yellow')}>黄</button>
            <button className="border rounded p-2 bg-blue-200 text-blue-900" onClick={()=>applyColor('blue')}>青</button>
            <button className="border rounded p-2 bg-green-200 text-green-900" onClick={()=>applyColor('green')}>緑</button>
            <button className="border rounded p-2 bg-orange-200 text-orange-900" onClick={()=>applyColor('orange')}>オレンジ</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 下段 色ピッカー（白/ピンク）: 編集権限がない場合は常に閉 */}
      <Dialog open={editorVerified && lowerPickerOpen} onOpenChange={setLowerPickerOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">セル背景色を選択</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <button className="border rounded p-2 bg-white text-gray-800" onClick={()=>applyLowerColor('white')}>白</button>
            <button className="border rounded p-2 bg-pink-100 text-pink-900" onClick={()=>applyLowerColor('pink')}>ピンク</button>
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
        <DialogContent className={`${isPortrait ? '' : 'md:hidden'} max-w-md bg-white`}>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-center">備考</DialogTitle>
          </DialogHeader>
          {/* compact表示は維持。タップで編集開始は各パネル内部で直接編集UIへ誘導（本実装はスタッフ/メモ側に準拠） */}
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
  const { data: session } = useSession()
  const editorVerified = (session as any)?.editorVerified === true
  const { items, setRefresh } = useRemarks()
  const first3 = items.slice(0,3)
  const rest = items.slice(3)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'create'|'edit'>('create')
  const [target, setTarget] = useState<Remark | undefined>(undefined)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null)

  const openCreate = () => { if (!editorVerified) return; setMode('create'); setTarget(undefined); setTitle(''); setBody(''); setOpen(true) }
  const openEdit = (r: Remark) => { if (!editorVerified) return; setMode('edit'); setTarget(r); setTitle(r.title); setBody(r.body); setOpen(true) }

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

  // ダイアログ表示時に自動フォーカス（新規=タイトル、編集=本文）
  useEffect(() => {
    if (!open) return
    const focusTarget = mode === 'create' ? titleInputRef.current : bodyTextareaRef.current
    // モーダルマウント直後のレイアウト確定後にフォーカス
    const id = setTimeout(() => focusTarget?.focus({ preventScroll: true }), 0)
    return () => clearTimeout(id)
  }, [open, mode])

  return (
    <div>
      <div className="flex justify-end mb-2">
        {editorVerified && <Button size="sm" className="text-base" onClick={openCreate}>新規</Button>}
      </div>
      {!compact ? (
        <div className="space-y-2">
          {first3.map(r => (
            <div key={r.id} className="border rounded p-2 break-words">
              <div className="font-medium text-lg break-words">{r.title}</div>
              <div className="text-base text-gray-700 whitespace-pre-wrap break-words">{r.body}</div>
              {editorVerified && (
                <div className="flex justify-end gap-2 mt-2">
                  <Button size="sm" className="text-base" variant="outline" onClick={()=>openEdit(r)}>編集</Button>
                  <Button size="sm" className="text-base" variant="destructive" onClick={()=>del(r.id)}>削除</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {[...first3, ...rest].map((r) => (
            <div
              key={r.id}
              className="border rounded p-2 break-words"
              onClick={() => editorVerified && openEdit(r)}
            >
              <div className="font-medium text-lg break-words">{r.title}</div>
              <div className="text-base text-gray-700 whitespace-pre-wrap break-words">{r.body}</div>
            </div>
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

      <Dialog open={editorVerified && open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>{mode==='create' ? '備考を追加' : '備考を編集'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="rtitle">タイトル</Label>
              <Input id="rtitle" ref={titleInputRef} value={title} onChange={(e)=>setTitle(e.target.value)} autoFocus={mode==='create'} />
            </div>
            <div>
              <Label htmlFor="rbody">本文</Label>
              <textarea id="rbody" ref={bodyTextareaRef} className="w-full h-40 border rounded-md p-2 text-sm max-sm:text-lg" value={body} onChange={(e)=>setBody(e.target.value)} autoFocus={mode==='edit'} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {mode==='edit' && target && (
              <Button
                variant="destructive"
                onClick={async ()=>{ await del(target.id); setOpen(false) }}
              >
                削除
              </Button>
            )}
            <Button variant="outline" onClick={()=>setOpen(false)}>キャンセル</Button>
            <Button onClick={save} disabled={!editorVerified}>完了</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


