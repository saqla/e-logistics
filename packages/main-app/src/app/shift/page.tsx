"use client"

import { useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { daysInMonth, getDow } from '@/lib/utils'
import { getRouteColorByKey } from '@/lib/shift-constants'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SiteHeader } from '@/components/site-header'

type Assignment = {
  day: number
  vehicleId: string
  route: string | null
  driverStaffId: string | null
  noteBL?: string | null
  noteBR?: string | null
}

type Vehicle = { id: string; number: string; order: number; enabled: boolean }
type RestKind = 'PUBLIC' | 'PAID'
type RestDay = { id: string; day: number; staffId: string; kind: RestKind }
type StaffLite = { id: string; name: string }

export default function ShiftAppPage() {
  const { status, data: session } = useSession()
  const router = useRouter()
  // 編集権限（Google編集ログイン、かつ個別ログアウトしていない）を一箇所に集約
  const editorVerified = !!((session as any)?.editorVerified && (typeof document === 'undefined' || !/(?:^|;\s*)editor_disabled=1(?:;|$)/.test(document.cookie || '')))
  const now = new Date()
  const [isPortrait, setPortrait] = useState(true)
  const [vw, setVw] = useState(0)
  const [vh, setVh] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(orientation: portrait)')
    const handler = (e: MediaQueryListEvent) => setPortrait(e.matches)
    setPortrait(mq.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])
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
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [staffs, setStaffs] = useState<StaffLite[]>([])
  const [picker, setPicker] = useState<{ open: boolean; vehicleId: string | null; day: number | null; route: string | null; driverStaffId: string | null; note: string }>({ open: false, vehicleId: null, day: null, route: null, driverStaffId: null, note: '' })
  const [restDays, setRestDays] = useState<RestDay[]>([])
  const [restPicker, setRestPicker] = useState<{ open: boolean; day: number | null; selections: Record<string, RestKind> }>({ open: false, day: null, selections: {} })
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setDirty] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [contacts, setContacts] = useState<{id:string; title:string; body:string; category?:string}[]>([])
  const [cMode, setCMode] = useState<'create'|'edit'>('create')
  const [targetId, setTargetId] = useState<string|undefined>(undefined)
  const [cTitle, setCTitle] = useState('')
  const [cBody, setCBody] = useState('')
  const [cCategory, setCCategory] = useState<'common'|'sanchoku'|'esaki'|'maruno'>('common')
  const [editingVisible, setEditingVisible] = useState(false)
  // ルート一覧（連絡ダイアログ内で表示・簡易編集）
  const [routeItems, setRouteItems] = useState<{id:string; key:string; name:string; order:number; bgClass:string; textClass:string; enabled:boolean}[]>([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeEditId, setRouteEditId] = useState<string | null>(null)
  const [routeEditName, setRouteEditName] = useState('')
  const [routeNewName, setRouteNewName] = useState('')
  // 個人スケジュール・ハイライト（ドライバー選択）
  const [highlightStaffId, setHighlightStaffId] = useState<string>('')
  // 車両一覧（連絡ダイアログ内で表示・追加/編集/並び替え/無効化）
  const [vehicleLoading, setVehicleLoading] = useState(false)
  const [vehicleNewNumber, setVehicleNewNumber] = useState('')
  const [vehicleEditId, setVehicleEditId] = useState<string | null>(null)
  const [vehicleEditNumber, setVehicleEditNumber] = useState('')

  const activeVehicles = useMemo(() => vehicles.filter(v => v.enabled).sort((a, b) => a.order - b.order), [vehicles])

  const applyAssignment = (vehicleId: string, day: number, route: string | null, driverStaffId: string | null, note: string) => {
    const key = `${vehicleId}-${day}`
    const existing = aMap.get(key)
    const next: Assignment = {
      day,
      vehicleId,
      route,
      driverStaffId,
      noteBL: note.trim() === '' ? null : note,
      noteBR: existing?.noteBR ?? null,
    }
    setAssignments(prev => {
      const others = prev.filter(x => !(x.vehicleId === next.vehicleId && x.day === next.day))
      return [...others, next]
    })
    setDirty(true)
  }

  const loadVehicles = async () => {
    setVehicleLoading(true)
    try {
      const r = await fetch('/api/vehicles', { cache: 'no-store' })
      const j = await r.json().catch(()=>({items:[]}))
      const arr = Array.isArray(j.items) ? j.items : []
      arr.sort((a:any,b:any)=> (a.order??0)-(b.order??0))
      setVehicles(arr)
    } finally { setVehicleLoading(false) }
  }

  const loadRestDays = async () => {
    const r = await fetch(`/api/shift/rest?year=${year}&month=${month}`, { cache: 'no-store' })
    const j = await r.json().catch(()=>({items:[]}))
    setRestDays(Array.isArray(j.items) ? j.items : [])
  }

  const loadAssignments = async () => {
    const aRes = await fetch(`/api/shift?year=${year}&month=${month}`, { cache: 'no-store' })
    const aJson = await aRes.json().catch(()=>({assignments:[]}))
    setAssignments((aJson?.assignments || []).map((x: any) => ({ day: x.day, vehicleId: x.vehicleId, route: x.route ?? null, driverStaffId: x.driverStaffId ?? null, noteBL: x.noteBL ?? null, noteBR: x.noteBR ?? null })))
  }

  useEffect(() => {
    const fetchAll = async () => {
      const sRes = await fetch(`/api/staff`, { cache: 'no-store' })
      const sJson = await sRes.json().catch(()=>({staffs:[]}))
      setStaffs((sJson?.staffs || []).map((s: any) => ({ id: s.id, name: s.name })))
    }
    fetchAll()
    loadAssignments()
    loadVehicles()
    loadRestDays()
  }, [year, month])

  const monthDays = useMemo(() => daysInMonth(year, month), [year, month])
  const todayInfo = useMemo(() => {
    const t = new Date()
    const isSameMonth = t.getFullYear() === year && (t.getMonth() + 1) === month
    return { isSameMonth, day: isSameMonth ? t.getDate() : null }
  }, [year, month])

  const aMap = useMemo(() => {
    const m = new Map<string, Assignment>()
    for (const a of assignments) m.set(`${a.vehicleId}-${a.day}`, a)
    return m
  }, [assignments])

  // 「休み」固定行：日ごとに複数人の公休ドライバーを保持
  const restByDay = useMemo(() => {
    const m = new Map<number, RestDay[]>()
    for (const r of restDays) {
      const arr = m.get(r.day) ?? []
      arr.push(r)
      m.set(r.day, arr)
    }
    return m
  }, [restDays])

  // 車両ごとの当月「空車」日数（ルート・ドライバー・備考のいずれも未設定の日をカウント）
  const emptyDaysByVehicle = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of vehicles) {
      let count = 0
      for (let d = 1; d <= monthDays; d++) {
        const a = aMap.get(`${v.id}-${d}`)
        const isEmpty = !a || (!a.route && !a.driverStaffId && !a.noteBL)
        if (isEmpty) count++
      }
      m.set(v.id, count)
    }
    return m
  }, [vehicles, aMap, monthDays])

  // 選択中ドライバーの当月「休み（公休）」日数（休み行のShiftRestDayベース）
  const highlightRestDayCount = useMemo(() => {
    if (!highlightStaffId) return 0
    return restDays.filter(r => r.staffId === highlightStaffId && r.kind !== 'PAID').length
  }, [restDays, highlightStaffId])

  // 選択中ドライバーの当月「有給」日数（休み行のkind==='PAID'ベース）
  const highlightPaidLeaveCount = useMemo(() => {
    if (!highlightStaffId) return 0
    return restDays.filter(r => r.staffId === highlightStaffId && r.kind === 'PAID').length
  }, [restDays, highlightStaffId])

  const staffName = (id: string | null) => id ? (staffs.find(s => s.id === id)?.name ?? '') : ''
  const routeName = (key: string | null) => key ? (routeItems.find(it => it.key === key)?.name ?? key) : null
  const routeColorFor = (key: string | null) => {
    if (!key) return ''
    const it = routeItems.find(x => x.key === key)
    return it ? getRouteColorByKey(it.key, it.bgClass, it.textClass) : ''
  }

  // 週配列（日曜始まり、0はプレースホルダー）
  const weeks: number[][] = useMemo(() => {
    const result: number[][] = []
    const firstDow = new Date(year, month - 1, 1).getDay() // 0=Sun
    const days = monthDays
    let dayPtr = 1
    // 1週目: 先頭の空きを0で埋める
    const w0: number[] = []
    for (let i = 0; i < firstDow; i++) w0.push(0)
    while (w0.length < 7 && dayPtr <= days) { w0.push(dayPtr++ as number) }
    result.push(w0)
    // 2週目以降
    while (dayPtr <= days) {
      const w: number[] = []
      for (let i = 0; i < 7; i++) {
        if (dayPtr <= days) w.push(dayPtr++)
        else w.push(0)
      }
      result.push(w)
    }
    return result
  }, [year, month, monthDays])

  // レスポンシブ列幅（スマホ縦=7日、他は/schedule準拠の考え方）
  const [leftColPx, setLeftColPx] = useState(56)
  const [dayColPx, setDayColPx] = useState(56)
  useEffect(() => {
    const w = vw
    const h = vh
    const isMobile = w < 768
    const sidePadding = isMobile ? 16 : 32
    const left = 56

    // スマホ（縦・横問わず）は1日分を潰さず、最小幅を固定して横スクロールに任せる
    const MOBILE_DAY_COL_MIN = 100
    if (isPortrait && isMobile) {
      setLeftColPx(left)
      setDayColPx(MOBILE_DAY_COL_MIN)
      return
    }

    if (!isPortrait && h > 0 && h < 500) {
      setLeftColPx(left)
      setDayColPx(MOBILE_DAY_COL_MIN)
      return
    }

    if (!isMobile && w >= 768 && w < 1200 && isPortrait) {
      // iPad縦は5日表示
      const leftMobile = 48
      const visibleDays = 5
      const availableForDays = w - sidePadding - leftMobile
      let perDay = Math.floor(availableForDays / visibleDays)
      perDay = Math.max(16, Math.min(perDay, 56))
      setLeftColPx(leftMobile)
      setDayColPx(perDay)
      return
    }

    if (!isMobile && w >= 768 && w < 1200 && !isPortrait) {
      // iPad横は12日表示
      const availableForDays = w - sidePadding - left
      let perDay = Math.floor(availableForDays / 12)
      perDay = Math.max(24, Math.min(perDay, 56))
      setLeftColPx(left)
      setDayColPx(perDay)
      return
    }

    if (w >= 1536) {
      const availableForDays = w - sidePadding - left
      let perDay = Math.floor(availableForDays / 20)
      perDay = Math.max(24, Math.min(perDay, 110))
      setLeftColPx(left)
      setDayColPx(perDay)
      return
    }
    if (w >= 1440) {
      const availableForDays = w - sidePadding - left
      let perDay = Math.floor(availableForDays / 15)
      perDay = Math.max(28, Math.min(perDay, 100))
      setLeftColPx(left)
      setDayColPx(perDay)
      return
    }
    if (w >= 1200) {
      const availableForDays = w - sidePadding - left
      let perDay = Math.floor(availableForDays / 12)
      perDay = Math.max(28, Math.min(perDay, 90))
      setLeftColPx(left)
      setDayColPx(perDay)
      return
    }
    // md（>=768）は15日目安（横スクロール前提）
    if (w >= 768) {
      const availableForDays = w - sidePadding - left
      let perDay = Math.floor(availableForDays / 15)
      perDay = Math.max(24, Math.min(perDay, 80))
      setLeftColPx(left)
      setDayColPx(perDay)
      return
    }
  }, [vw, vh, isPortrait])

  // 保存処理（ヘッダー/ボトム共通）
  const saveAll = async () => {
    try {
      setIsSaving(true)
      const uniqueMap = new Map<string, Assignment>()
      for (const a of assignments) {
        const key = `${a.vehicleId}-${a.day}`
        // 直近の編集を優先して常に上書き
        uniqueMap.set(key, a)
      }
      const body = {
        year,
        month,
        assignments: Array.from(uniqueMap.values()).map(a => ({
          day: a.day,
          vehicleId: a.vehicleId,
          route: a.route,
          driverStaffId: a.driverStaffId,
          noteBL: a.noteBL ?? null,
          noteBR: a.noteBR ?? null,
        })),
      }
      const res = await fetch('/api/shift', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        let msg = '保存に失敗しました'
        try {
          const ct = res.headers.get('content-type') || ''
          if (ct.includes('application/json')) {
            const j = await res.json(); if (j?.error) msg = j.error
          } else {
            const t = await res.text(); if (t) msg = t
          }
          msg += ` (status ${res.status})`
        } catch {}
        throw new Error(msg)
      }
      const j = await res.json().catch(()=>({}))
      const localCount = uniqueMap.size
      if (Array.isArray(j?.assignments)) {
        const serverAssigns = j.assignments.map((x: any) => ({ day: x.day, vehicleId: x.vehicleId, route: x.route ?? null, driverStaffId: x.driverStaffId ?? null, noteBL: x.noteBL ?? null, noteBR: x.noteBR ?? null }))
        setAssignments(serverAssigns)
        // まれに反映が遅延する環境対策でリトライ（サーバ返却が極端に少ない場合のみ）
        if (serverAssigns.length === 0 && localCount > 0) {
          await new Promise(r => setTimeout(r, 300))
          const aRes2 = await fetch(`/api/shift?year=${year}&month=${month}`, { cache: 'no-store' })
          const aJson2 = await aRes2.json().catch(()=>({}))
          if (Array.isArray(aJson2?.assignments) && aJson2.assignments.length > 0) {
            setAssignments(aJson2.assignments.map((x: any) => ({ day: x.day, vehicleId: x.vehicleId, route: x.route ?? null, driverStaffId: x.driverStaffId ?? null, noteBL: x.noteBL ?? null, noteBR: x.noteBR ?? null })))
          }
        }
      } else {
        const aRes = await fetch(`/api/shift?year=${year}&month=${month}`, { cache: 'no-store' })
        const aJson = await aRes.json()
        setAssignments((aJson?.assignments || []).map((x: any) => ({ day: x.day, vehicleId: x.vehicleId, route: x.route ?? null, driverStaffId: x.driverStaffId ?? null, noteBL: x.noteBL ?? null, noteBR: x.noteBR ?? null })))
      }
      setDirty(false)
      alert('保存しました')
    } catch (e: any) {
      console.error(e)
      alert(e?.message || '保存に失敗しました。権限やネットワークを確認してください。')
    } finally {
      setIsSaving(false)
    }
  }

  // BottomBar からの保存要求に応答
  // saveAllは毎レンダーで作り直されるため、依存配列を空にしたままだと
  // マウント時点の古いassignments/year/monthを閉じ込めたsaveAllが呼ばれ続け、
  // スマホでBottomBarから保存すると後から追加した内容が反映されない（保存時に消える）
  // 不具合が起きていた。refで常に最新のsaveAllを参照するようにする。
  const saveAllRef = useRef(saveAll)
  useEffect(() => { saveAllRef.current = saveAll })
  useEffect(() => {
    const onReq = (_e: Event) => { saveAllRef.current() }
    window.addEventListener('requestShiftSave', onReq)
    return () => window.removeEventListener('requestShiftSave', onReq)
  }, [])

  // 連絡（備考扱い）ダイアログのオープンイベント（ポートレート時のみダイアログを開く）
  useEffect(() => {
    const onOpen = (_e: Event) => {
      if (isPortrait) setContactOpen(true)
    }
    window.addEventListener('openShiftContactDialog', onOpen)
    return () => window.removeEventListener('openShiftContactDialog', onOpen)
  }, [isPortrait])

  // 連絡のロード
  useEffect(() => {
    const load = async () => {
      const r = await fetch('/api/shift/contact', { cache: 'no-store' })
      const j = await r.json().catch(()=>({items:[]}))
      setContacts(Array.isArray(j.items)? j.items: [])
    }
    load()
  }, [])

  // ルート一覧のロード
  const loadRouteItems = async () => {
    setRouteLoading(true)
    try {
      const r = await fetch('/api/route-defs', { cache: 'no-store' })
      const j = await r.json().catch(()=>({items:[]}))
      const arr = Array.isArray(j.items) ? j.items : []
      arr.sort((a:any,b:any)=> (a.order??0)-(b.order??0))
      setRouteItems(arr)
    } finally { setRouteLoading(false) }
  }
  useEffect(() => { loadRouteItems() }, [])

  const addRoute = async () => {
    const name = routeNewName.trim()
    if (!name) return
    const r = await fetch('/api/route-defs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    if (!r.ok) { let msg = '追加に失敗しました'; try { const j = await r.json(); if (j?.error) msg = j.error } catch {}; alert(msg); return }
    setRouteNewName('')
    await loadRouteItems()
  }
  const startEditRoute = (id: string) => {
    const it = routeItems.find(x => x.id===id)
    if (!it) return
    setRouteEditId(id)
    setRouteEditName(it.name)
  }
  const cancelEditRoute = () => { setRouteEditId(null); setRouteEditName('') }
  const saveRouteName = async () => {
    if (!routeEditId) return
    const r = await fetch(`/api/route-defs/${routeEditId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: routeEditName }) })
    if (!r.ok) { alert('保存に失敗しました'); return }
    const j = await r.json().catch(()=>({}))
    if (j?.item) setRouteItems(prev => prev.map(x => x.id===routeEditId ? j.item : x))
    cancelEditRoute()
  }
  const deleteRoute = async (id: string) => {
    const r = await fetch(`/api/route-defs/${id}`, { method: 'DELETE' })
    if (!r.ok) { let msg = '削除に失敗しました'; try { const j = await r.json(); if (j?.error) msg = j.error } catch {}; alert(msg); return }
    // サーバー側でこのルートを使っていたセルは空車に戻されているため、カレンダー表示も最新化する
    await Promise.all([loadRouteItems(), loadAssignments()])
  }

  // 車両マスタ操作
  const addVehicle = async () => {
    const number = vehicleNewNumber.trim()
    if (!number) return
    const maxOrder = vehicles.reduce((m, v) => Math.max(m, v.order), 0)
    const r = await fetch('/api/vehicles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number, order: maxOrder + 10 }) })
    if (!r.ok) { let msg = '追加に失敗しました'; try { const j = await r.json(); if (j?.error) msg = j.error } catch {}; alert(msg); return }
    setVehicleNewNumber('')
    await loadVehicles()
  }
  const startEditVehicle = (id: string) => {
    const v = vehicles.find(x => x.id === id)
    if (!v) return
    setVehicleEditId(id)
    setVehicleEditNumber(v.number)
  }
  const cancelEditVehicle = () => { setVehicleEditId(null); setVehicleEditNumber('') }
  const saveVehicleEdit = async () => {
    if (!vehicleEditId) return
    const r = await fetch(`/api/vehicles/${vehicleEditId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: vehicleEditNumber.trim() }) })
    if (!r.ok) { let msg = '保存に失敗しました'; try { const j = await r.json(); if (j?.error) msg = j.error } catch {}; alert(msg); return }
    cancelEditVehicle()
    await loadVehicles()
  }
  const toggleVehicleEnabled = async (id: string, enabled: boolean) => {
    const r = await fetch(`/api/vehicles/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !enabled }) })
    if (!r.ok) { alert('更新に失敗しました'); return }
    await loadVehicles()
  }
  const deleteVehicle = async (id: string) => {
    const r = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' })
    if (!r.ok) { alert('削除に失敗しました'); return }
    await loadVehicles()
  }
  const moveVehicle = async (id: string, direction: -1 | 1) => {
    const sorted = [...vehicles].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(v => v.id === id)
    const swapIdx = idx + direction
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return
    const a = sorted[idx], b = sorted[swapIdx]
    await Promise.all([
      fetch(`/api/vehicles/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: b.order }) }),
      fetch(`/api/vehicles/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: a.order }) }),
    ])
    await loadVehicles()
  }

  // 「休み」固定行：選択差分から追加/削除をまとめて反映
  const openRestPicker = (day: number) => {
    const current = restByDay.get(day) ?? []
    const selections: Record<string, RestKind> = {}
    for (const r of current) selections[r.staffId] = r.kind
    setRestPicker({ open: true, day, selections })
  }
  const closeRestPicker = () => setRestPicker({ open: false, day: null, selections: {} })
  const toggleRestStaff = (staffId: string) => {
    setRestPicker(p => {
      const next = { ...p.selections }
      if (staffId in next) delete next[staffId]
      else next[staffId] = 'PUBLIC'
      return { ...p, selections: next }
    })
  }
  const setRestKind = (staffId: string, kind: RestKind) => {
    setRestPicker(p => ({ ...p, selections: { ...p.selections, [staffId]: kind } }))
  }
  const confirmRestPicker = async () => {
    const day = restPicker.day
    if (!day) { closeRestPicker(); return }
    const current = restByDay.get(day) ?? []
    const selectedIds = Object.keys(restPicker.selections)
    const toRemove = current.filter(r => !(r.staffId in restPicker.selections))
    const results = await Promise.all([
      ...selectedIds.map(async staffId => {
        const r = await fetch('/api/shift/rest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, month, day, staffId, kind: restPicker.selections[staffId] }) })
        if (r.ok) return null
        let msg = `${staffName(staffId)}の保存に失敗しました`
        try { const j = await r.json(); if (j?.error) msg = `${staffName(staffId)}: ${j.error}` } catch {}
        return msg
      }),
      ...toRemove.map(async r => {
        const res = await fetch(`/api/shift/rest/${r.id}`, { method: 'DELETE' })
        if (res.ok) return null
        let msg = `${staffName(r.staffId)}の削除に失敗しました`
        try { const j = await res.json(); if (j?.error) msg = `${staffName(r.staffId)}: ${j.error}` } catch {}
        return msg
      }),
    ])
    const errors = results.filter((m): m is string => m != null)
    await loadRestDays()
    if (errors.length > 0) {
      alert(`一部の保存/削除に失敗しました:\n${errors.join('\n')}\n（編集権限が切れている可能性があります。再ログインしてもう一度お試しください）`)
      return
    }
    closeRestPicker()
  }

  const openCreateContact = () => { setCMode('create'); setTargetId(undefined); setCTitle(''); setCBody(''); setCCategory('common'); setContactOpen(true); setEditingVisible(true) }
  const openEditContact = (id: string) => {
    const t = contacts.find(x => x.id === id)
    if (!t) return
    setCMode('edit'); setTargetId(id); setCTitle(t.title); setCBody(t.body); setCCategory((t.category as any) || 'common'); setContactOpen(true); setEditingVisible(true)
  }
  const saveContact = async () => {
    const payload = { title: cTitle.trim(), body: cBody.trim(), category: cCategory }
    const url = cMode==='create' ? '/api/shift/contact' : `/api/shift/contact/${targetId}`
    const method = cMode==='create' ? 'POST' : 'PATCH'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!r.ok) {
      let msg = '保存に失敗しました'
      try { const t = await r.text(); if (t) msg = t } catch {}
      alert(msg); return
    }
    const j = await r.json().catch(()=>({}))
    if (cMode==='create' && j?.item) setContacts(prev => [...prev, j.item])
    if (cMode==='edit' && j?.item) setContacts(prev => prev.map(x => x.id===j.item.id? j.item: x))
    setEditingVisible(false)
  }
  const deleteContact = async (id: string) => {
    const r = await fetch(`/api/shift/contact/${id}`, { method: 'DELETE' })
    if (!r.ok) { let msg='削除に失敗しました'; try{const t=await r.text(); if(t) msg=t}catch{}; alert(msg); return }
    setContacts(prev => prev.filter(x => x.id !== id))
  }

  // saving状態をBottomBarへ通知
  useEffect(() => {
    const ev = new CustomEvent('shiftSavingState', { detail: { saving: isSaving } })
    window.dispatchEvent(ev)
  }, [isSaving])

  // 車両一覧（管理）本体（連絡ダイアログ/右サイド共通）
  // 注意: これをコンポーネント関数として定義し <VehicleManagementBody /> の形で呼ぶと、
  // 親の再レンダリングのたびに「新しい型」を生成したとReactに解釈され、
  // 内部のinputがアンマウント→再マウントされてフォーカスとスクロール位置が失われる。
  // そのためJSX値としてそのまま埋め込む。
  const vehicleManagementBody = (
    <div className="mt-4">
      <div className="font-semibold text-center text-xl mb-2">車両一覧</div>
      <div className="border rounded-md p-3 w-full break-words">
        {editorVerified && (
          <div className="flex gap-2 mb-3">
            <input className="flex-1 border rounded h-9 px-2 text-sm" placeholder="車番を入力（例: 0514, ユニック）" value={vehicleNewNumber} onChange={e=>setVehicleNewNumber(e.target.value)} />
            <Button size="sm" onClick={addVehicle}>追加</Button>
          </div>
        )}
        {vehicleLoading ? (
          <div className="text-sm text-gray-600">読み込み中…</div>
        ) : (
          <div className="grid grid-cols-1 divide-y">
            {vehicles.sort((a,b)=>a.order-b.order).map(v => (
              <div key={v.id} className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 py-2 ${!v.enabled ? 'opacity-50' : ''}`}>
                <div className="flex flex-col">
                  {editorVerified && (
                    <>
                      <button className="text-xs px-1" onClick={()=>moveVehicle(v.id, -1)}>▲</button>
                      <button className="text-xs px-1" onClick={()=>moveVehicle(v.id, 1)}>▼</button>
                    </>
                  )}
                </div>
                <div>
                  {vehicleEditId===v.id ? (
                    <input className="w-full border rounded h-9 px-2 text-sm" value={vehicleEditNumber} onChange={e=>setVehicleEditNumber(e.target.value)} />
                  ) : (
                    <div>
                      <span>{v.number}{!v.enabled ? '（無効）' : ''}</span>
                      <div className="text-xs text-gray-500">空車: {emptyDaysByVehicle.get(v.id) ?? 0}日</div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  {editorVerified && (
                    vehicleEditId===v.id ? (
                      <>
                        <Button size="sm" variant="outline" onClick={cancelEditVehicle}>キャンセル</Button>
                        <Button size="sm" onClick={saveVehicleEdit}>保存</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEditVehicle(v.id)}>編集</Button>
                        <Button size="sm" variant="outline" onClick={() => toggleVehicleEnabled(v.id, v.enabled)}>{v.enabled ? '無効化' : '有効化'}</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteVehicle(v.id)}>削除</Button>
                      </>
                    )
                  )}
                </div>
              </div>
            ))}
            {vehicles.length === 0 && (
              <div className="text-sm text-gray-500 py-4">車両が登録されていません</div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  // 連絡パネル本体（ダイアログ/右サイド共通）。VehicleManagementBodyと同じ理由でJSX値として保持する。
  const contactBody = (
    <div className="pr-1">
      {/* 個人スケジュール・ハイライト（ドライバー選択） */}
      <div className="mb-4">
        <div className="font-semibold text-center text-xl mb-2">ドライバー選択</div>
        <div className="border rounded-md p-3 w-full">
          <select
            className="w-full border rounded h-9 px-2 text-sm"
            value={highlightStaffId}
            onChange={e => setHighlightStaffId(e.target.value)}
          >
            <option value="">未選択（通常表示）</option>
            {staffs.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {highlightStaffId && (
            <>
              <div className="mt-2 text-sm font-semibold text-gray-800">
                今月の休み: {highlightRestDayCount}日 / 有給: {highlightPaidLeaveCount}日
              </div>
              <div className="mt-1 text-xs text-gray-600">
                休みの日は赤、出勤しているセルはオレンジの枠、有給のセルは紫の太枠でハイライトしています。
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { key:'common', title:'共通' },
          { key:'sanchoku', title:'産直' },
          { key:'esaki', title:'江D' },
          { key:'maruno', title:'丸D' },
        ].map(g => (
          <div key={g.key} className="border rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-lg">{g.title}</div>
            </div>
            <div className="space-y-2">
              {contacts.filter(c => (c.category||'common')===g.key).map(c => (
                <div
                  key={c.id}
                  className={`border rounded p-2 break-words ${editorVerified ? 'cursor-pointer' : ''}`}
                  onClick={editorVerified ? () => openEditContact(c.id) : undefined}
                >
                  <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">{c.body}</div>
                </div>
              ))}
              {contacts.filter(c => (c.category||'common')===g.key).length === 0 && (
                <div className="text-sm text-gray-500">（項目なし）</div>
              )}
            </div>
          </div>
        ))}
      </div>
      {editorVerified && !editingVisible && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" className="text-base" onClick={openCreateContact}>新規</Button>
        </div>
      )}
      {editingVisible && (
        <div className="mt-2">
          <div className="grid grid-cols-1 gap-2">
            <textarea className="border rounded p-2 text-base h-28" placeholder="本文" value={cBody} onChange={e=>setCBody(e.target.value)} />
            <select className="border rounded p-2 text-base" value={cCategory} onChange={e=>setCCategory(e.target.value as any)}>
              <option value="common">共通</option>
              <option value="sanchoku">産直</option>
              <option value="esaki">江D</option>
              <option value="maruno">丸D</option>
            </select>
            <div className="flex justify-end gap-2">
              {cMode==='edit' && targetId && (
                <Button variant="destructive" onClick={()=>deleteContact(targetId)}>削除</Button>
              )}
              <Button variant="outline" onClick={()=>{ setEditingVisible(false) }}>キャンセル</Button>
              <Button onClick={saveContact}>完了</Button>
            </div>
          </div>
        </div>
      )}

      {/* ルート一覧 */}
      <div className="mt-4">
        <div className="font-semibold text-center text-xl mb-2">ルート一覧</div>
        <div className="border rounded-md p-3 w-full break-words">
          {editorVerified && (
            <div className="flex gap-2 mb-3">
              <input className="flex-1 border rounded h-9 px-2 text-sm" placeholder="ルート名を入力" value={routeNewName} onChange={e=>setRouteNewName(e.target.value)} />
              <Button size="sm" onClick={addRoute}>追加</Button>
            </div>
          )}
          {routeLoading ? (
            <div className="text-sm text-gray-600">読み込み中…</div>
          ) : (
            <div className="grid grid-cols-1 divide-y">
              <div className="grid grid-cols-[1fr_auto] text-sm text-gray-500 py-2">
                <div>ルート名</div>
                <div>操作</div>
              </div>
              {routeItems.map(it => (
                <div key={it.id} className="grid grid-cols-[1fr_auto] items-center py-2 gap-2">
                  <div className="min-w-0">
                    {routeEditId===it.id ? (
                      <input className="w-full border rounded h-9 px-2 text-sm" value={routeEditName} onChange={e=>setRouteEditName(e.target.value)} />
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`shrink-0 px-2 py-0.5 rounded text-xs ${getRouteColorByKey(it.key, it.bgClass, it.textClass)}`}>表示例</span>
                        <span className="truncate">{it.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 justify-end">
                    {editorVerified && (
                      routeEditId===it.id ? (
                        <>
                          <Button size="sm" variant="outline" onClick={cancelEditRoute}>キャンセル</Button>
                          <Button size="sm" onClick={saveRouteName}>保存</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => startEditRoute(it.id)}>編集</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteRoute(it.id)}>削除</Button>
                        </>
                      )
                    )}
                  </div>
                </div>
              ))}
              {routeItems.length === 0 && (
                <div className="text-sm text-gray-500 py-4">データがありません</div>
              )}
            </div>
          )}
        </div>
      </div>

      {vehicleManagementBody}
    </div>
  )

  const closePicker = () => setPicker({ open: false, vehicleId: null, day: null, route: null, driverStaffId: null, note: '' })

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <SiteHeader
        appName="箱車シフト表"
        year={year}
        month={month}
        onPrev={() => setMonth(m => (m===1 ? (setYear(y=>y-1), 12) : m-1))}
        onNext={() => setMonth(m => (m===12 ? (setYear(y=>y+1), 1) : m+1))}
        onSave={editorVerified ? saveAll : undefined}
        saveDisabled={isSaving || !isDirty}
        showSave={!isPortrait}
        onBack={() => router.push('/')}
        showBack={!isPortrait}
        containerClassName="max-w-full mx-auto px-2"
        extraAction={editorVerified ? { label: '有給管理', onClick: () => router.push('/paid-leaves') } : undefined}
      />
      <main className="max-w-full mx-auto py-4 px-2">
        <div className="mb-3 mt-3 flex flex-wrap items-center gap-2 text-xs">
          {routeItems.filter(it => it.enabled).map(it => (
            <span key={it.id} className={`px-2 py-0.5 rounded ${getRouteColorByKey(it.key, it.bgClass, it.textClass)}`}>{it.name}</span>
          ))}
          <span className="px-2 py-0.5 rounded border border-dashed border-gray-300 text-gray-500">空車</span>
        </div>
        {(() => {
          // セル1つ分の中身：田の字4分割（左上=ルート／右上=ドライバー／下段=備考、横結合）。
          // JSXコンポーネントとして定義すると親の再レンダリングごとに新しい型として
          // 扱われアンマウントされるため、ただの関数として呼び出す。
          const renderCell = (vehicleId: string, day: number) => {
            const a = aMap.get(`${vehicleId}-${day}`)
            const label = routeName(a?.route ?? null)
            const driver = staffName(a?.driverStaffId ?? null)
            const note = a?.noteBL ?? ''
            const isEmpty = !label && !driver && !note
            const isHighlighted = highlightStaffId !== '' && a?.driverStaffId === highlightStaffId
            const highlightRing = isHighlighted ? 'ring-4 ring-inset ring-amber-400' : ''
            const open = () => setPicker({ open: true, vehicleId, day, route: a?.route ?? null, driverStaffId: a?.driverStaffId ?? null, note })
            if (isEmpty) {
              return (
                <button disabled={!editorVerified} onClick={open} className="w-full h-20 flex items-center justify-center text-sm sm:text-base text-gray-400 border-2 border-dashed border-gray-300 disabled:cursor-default">空車</button>
              )
            }
            // 備考が空なら下段を消し、ルート／ドライバーを上下2段いっぱいに広げる（可変レイアウト）
            if (!note) {
              return (
                <button disabled={!editorVerified} onClick={open} className={`w-full h-20 flex flex-col text-left disabled:cursor-default ${highlightRing}`}>
                  <span className={`flex-1 flex items-center justify-center border-b-2 px-1 truncate text-sm sm:text-base font-semibold ${routeColorFor(a?.route ?? null)}`}>{label ?? ''}</span>
                  <span className="flex-1 flex items-center justify-center px-1 truncate text-sm sm:text-base text-gray-800">{driver}</span>
                </button>
              )
            }
            return (
              <button disabled={!editorVerified} onClick={open} className={`w-full h-20 grid grid-cols-2 grid-rows-2 text-left disabled:cursor-default ${highlightRing}`}>
                <span className={`flex items-center justify-center border-b-2 border-r-2 px-1 truncate text-sm sm:text-base font-semibold ${routeColorFor(a?.route ?? null)}`}>{label ?? ''}</span>
                <span className="flex items-center justify-center border-b-2 px-1 truncate text-sm sm:text-base text-gray-800">{driver}</span>
                <span className="col-span-2 flex items-center px-1 truncate text-xs sm:text-sm text-gray-600">{note}</span>
              </button>
            )
          }

          // 「休み」固定行のセル：ルートは無く、その日の公休ドライバー（複数可）を表示
          const renderRestCell = (day: number) => {
            const entries = restByDay.get(day) ?? []
            const labels = entries.map(r => {
              const name = staffName(r.staffId)
              return name ? `${name}${r.kind === 'PAID' ? '（有給）' : ''}` : ''
            }).filter(Boolean)
            const kinds = new Set(entries.map(r => r.kind))
            const uniformKind = kinds.size === 1 ? Array.from(kinds)[0] : null
            const highlightedEntry = highlightStaffId !== '' ? entries.find(r => r.staffId === highlightStaffId) : undefined
            const open = () => openRestPicker(day)
            const baseClass = uniformKind === 'PAID'
              ? 'bg-purple-100 text-purple-800'
              : uniformKind === 'PUBLIC'
              ? 'bg-red-100 text-red-800'
              : entries.length ? 'bg-gray-100 text-gray-800' : 'text-gray-300 border-2 border-dashed border-gray-300'
            const highlightRing = highlightedEntry
              ? (highlightedEntry.kind === 'PAID' ? 'ring-4 ring-inset ring-purple-600 font-bold' : 'ring-4 ring-inset ring-red-500 font-bold')
              : ''
            return (
              <button disabled={!editorVerified} onClick={open} className={`w-full h-20 flex items-center justify-center text-center text-sm sm:text-base p-1 disabled:cursor-default ${baseClass} ${highlightRing}`}>
                <span className="line-clamp-3 break-words">{labels.length ? labels.join('、') : '—'}</span>
              </button>
            )
          }

          // 週ごとの縦連結テーブルを共通化（同上の理由でJSX値として保持）
          const weeklyTable = (
            <div className="overflow-x-auto border rounded-md bg-white">
              <table className="w-full text-sm table-fixed">
                <thead>
                  {/* 曜日行：7列 */}
                  <tr>
                    <th className="bg-white border-b p-1 text-center text-xs" style={{ width: leftColPx }}>曜</th>
                    {Array.from({ length: 7 }).map((_, i) => {
                      const wd = ['日','月','火','水','木','金','土'][i]
                      const color = i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-gray-900'
                      return (
                        <th key={`wd-${i}`} className={`border-b p-1 text-center text-xs ${color}`} style={{ width: dayColPx }}>{wd}</th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <Fragment key={`wkblk-${wi}`}>
                      {/* 週のヘッダー（日付行） */}
                      <tr>
                        <td className="sticky left-0 bg-white z-20 border-b p-2 text-left" style={{ width: leftColPx }}></td>
                        {week.map((d, i) => {
                          const isToday = d ? (todayInfo.isSameMonth && todayInfo.day === d) : false
                          const color = i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-gray-900'
                          return (
                            <td key={`date-${wi}-${i}`} className={`border-b p-2 text-center ${isToday ? 'bg-blue-50' : ''} ${color}`} style={{ width: dayColPx }}>
                              {d ? (
                                isToday ? (
                                  <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded-full bg-blue-600 text-white font-semibold">{month}/{d}</span>
                                ) : `${month}/${d}`
                              ) : ''}
                            </td>
                          )
                        })}
                      </tr>
                      {/* 週の明細（車番×7日） */}
                      {activeVehicles.map(v => (
                        <tr key={`row-${wi}-${v.id}`}>
                          <td className="sticky left-0 bg-white z-10 border-r p-2 font-medium" style={{ width: leftColPx }}>{v.number}</td>
                          {week.map((d, i) => {
                            const isToday = d ? (todayInfo.isSameMonth && todayInfo.day === d) : false
                            return (
                              <td key={`cell-${wi}-${v.id}-${i}`} className={`border-2 p-0 align-top ${isToday ? 'bg-blue-50' : ''}`} style={{ width: dayColPx }}>
                                {d ? renderCell(v.id, d) : <div className="h-16" />}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      {/* 「休み」固定行：一番下に常設 */}
                      <tr key={`rest-${wi}`} className="bg-gray-50">
                        <td className="sticky left-0 bg-gray-50 z-10 border-r p-2 font-medium" style={{ width: leftColPx }}>休み</td>
                        {week.map((d, i) => {
                          const isToday = d ? (todayInfo.isSameMonth && todayInfo.day === d) : false
                          return (
                            <td key={`rest-cell-${wi}-${i}`} className={`border-2 p-0 align-top ${isToday ? 'bg-blue-50' : ''}`} style={{ width: dayColPx }}>
                              {d ? renderRestCell(d) : <div className="h-16" />}
                            </td>
                          )
                        })}
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )

          if (isPortrait && vw > 0 && vw < 768) {
            // スマホ縦: 週ごとに縦連結のみ
            return weeklyTable
          }
          if (!isPortrait) {
            // 非ポートレート: 左に週テーブル、右に連絡パネル
            return (
              <div className="flex gap-4 items-stretch">
                <div className="flex-1 min-w-0">
                  {weeklyTable}
                </div>
                <div className="w-[360px] shrink-0 border rounded-md bg-white p-3 overflow-y-auto">
                  <div className="font-semibold text-lg mb-2">連絡</div>
                  {contactBody}
                </div>
              </div>
            )
          }
          // それ以外（タブレット縦など）は従来の横長テーブル
          return (
            <div className="overflow-x-auto border rounded-md bg-white">
              <table className="min-w-[900px] w-full text-sm table-fixed">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 bg-white z-30 border-b p-2 text-left" style={{ width: leftColPx }}>車番</th>
                    {Array.from({ length: monthDays }).map((_, i) => {
                      const d = i + 1
                      const dow = getDow(year, month, d)
                      const isToday = todayInfo.isSameMonth && todayInfo.day === d
                      const color = dow === 0 ? 'text-red-600' : dow === 6 ? 'text-blue-600' : 'text-gray-900'
                      return (
                        <th key={i} className={`sticky top-0 z-20 border-b p-2 text-center bg-white ${isToday ? 'bg-blue-50' : ''} ${color}`} style={{ width: dayColPx }}>
                          {isToday ? (
                            <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded-full bg-blue-600 text-white font-semibold">{month}/{d}</span>
                          ) : `${month}/${d}`}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activeVehicles.map(v => (
                    <tr key={v.id}>
                      <td className="sticky left-0 bg-white z-10 border-r p-2 font-medium" style={{ width: leftColPx }}>{v.number}</td>
                      {Array.from({ length: monthDays }).map((_, i) => {
                        const d = i+1
                        const isToday = todayInfo.isSameMonth && todayInfo.day === d
                        return (
                          <td key={d} className={`border-2 p-0 align-top ${isToday ? 'bg-blue-50' : ''}`} style={{ width: dayColPx }}>
                            {renderCell(v.id, d)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {/* 「休み」固定行：一番下に常設 */}
                  <tr className="bg-gray-50">
                    <td className="sticky left-0 bg-gray-50 z-10 border-r p-2 font-medium" style={{ width: leftColPx }}>休み</td>
                    {Array.from({ length: monthDays }).map((_, i) => {
                      const d = i+1
                      const isToday = todayInfo.isSameMonth && todayInfo.day === d
                      return (
                        <td key={d} className={`border-2 p-0 align-top ${isToday ? 'bg-blue-50' : ''}`} style={{ width: dayColPx }}>
                          {renderRestCell(d)}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })()}

        {/* 共有BottomBarを使用するためローカルのボトムメニューは撤去 */}

        <Dialog open={picker.open} onOpenChange={(o) => { if (!o) closePicker() }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ルート・ドライバー・備考を選択</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <div className="text-sm text-gray-600 mb-1">ルート</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPicker(p => ({ ...p, route: null }))}
                    className={`px-3 py-2 rounded text-sm border border-dashed ${picker.route === null ? 'ring-2 ring-blue-500' : ''}`}
                  >未設定</button>
                  {routeItems.filter(it => it.enabled).map(it => (
                    <button
                      key={it.id}
                      onClick={() => setPicker(p => ({ ...p, route: it.key }))}
                      className={`px-3 py-2 rounded text-sm ${getRouteColorByKey(it.key, it.bgClass, it.textClass)} ${picker.route === it.key ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                    >{it.name}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">ドライバー</div>
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                  <button
                    onClick={() => setPicker(p => ({ ...p, driverStaffId: null }))}
                    className={`px-3 py-2 rounded text-sm border ${picker.driverStaffId === null ? 'ring-2 ring-blue-500' : ''}`}
                  >未割当</button>
                  {staffs.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setPicker(p => ({ ...p, driverStaffId: s.id }))}
                      className={`px-3 py-2 rounded text-sm border ${picker.driverStaffId === s.id ? 'bg-blue-600 text-white border-blue-600' : ''}`}
                    >{s.name}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">備考（時間など）</div>
                <textarea
                  value={picker.note}
                  onChange={e => setPicker(p => ({ ...p, note: e.target.value }))}
                  className="w-full h-16 border rounded p-2 text-sm"
                  placeholder="例: 8:00発"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closePicker}>キャンセル</Button>
                <Button onClick={() => {
                  if (picker.vehicleId && picker.day) applyAssignment(picker.vehicleId, picker.day, picker.route, picker.driverStaffId, picker.note)
                  closePicker()
                }}>確定</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 「休み」固定行：公休ドライバーの複数選択ダイアログ */}
        <Dialog open={restPicker.open} onOpenChange={(o) => { if (!o) closeRestPicker() }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>休みのドライバーを選択（複数可・公休/有給）</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
              {staffs.map(s => {
                const kind = restPicker.selections[s.id]
                const selected = kind != null
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRestStaff(s.id)}
                      className={`flex-1 px-3 py-2 rounded text-sm border text-left ${selected ? 'bg-blue-600 text-white border-blue-600' : ''}`}
                    >{s.name}</button>
                    {selected && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setRestKind(s.id, 'PUBLIC')}
                          className={`px-2 py-2 rounded text-xs border ${kind === 'PUBLIC' ? 'bg-red-100 border-red-500 text-red-800 font-semibold' : ''}`}
                        >公休</button>
                        <button
                          onClick={() => setRestKind(s.id, 'PAID')}
                          className={`px-2 py-2 rounded text-xs border ${kind === 'PAID' ? 'bg-purple-100 border-purple-500 text-purple-800 font-semibold' : ''}`}
                        >有給</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={closeRestPicker}>キャンセル</Button>
              <Button onClick={confirmRestPicker}>確定</Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>

      {/* 連絡ダイアログ（ポートレート時） */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-3xl bg-white max-h-[85vh]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>連絡</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[70vh]">
            {contactBody}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
