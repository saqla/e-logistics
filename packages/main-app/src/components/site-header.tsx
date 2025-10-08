"use client"

import Image from "next/image"
import { useSession, signOut, signIn } from "next-auth/react"
import { useEffect, useState } from "react"

function useViewportInfo() {
  const [vw, setVw] = useState(0)
  const [vh, setVh] = useState(0)
  const [isPortrait, setPortrait] = useState(true)
  useEffect(() => {
    const onResize = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 0
      const h = typeof window !== 'undefined' ? window.innerHeight : 0
      setVw(w); setVh(h); setPortrait(h >= w)
    }
    onResize();
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return { vw, vh, isPortrait }
}

export function SiteHeader() {
  const { data: session, status } = useSession()
  const { vw, isPortrait } = useViewportInfo()
  const isPhonePortrait = isPortrait && vw > 0 && vw < 768
  const isTabletPortrait = isPortrait && vw >= 768 && vw < 1200
  const showCompactHeader = isPhonePortrait || isTabletPortrait
  const isAuthed = status === 'authenticated'
  const [editorDisabled, setEditorDisabled] = useState(false)
  useEffect(() => {
    const read = () => {
      if (typeof document === 'undefined') return
      setEditorDisabled(/(?:^|;\s*)editor_disabled=1(?:;|$)/.test(document.cookie || ''))
    }
    read()
    document.addEventListener('visibilitychange', read)
    return () => document.removeEventListener('visibilitychange', read)
  }, [])

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-1">
            <Image
              src="/logo.png"
              alt="E-Logistics Logo"
              width={120}
              height={40}
              className="w-[120px] h-[40px] object-contain"
              priority
            />
            <span className="text-lg font-semibold text-gray-900">Eロジスティクス</span>
          </div>
          <div className="flex items-center space-x-4">
            {showCompactHeader ? (
              // 縦表示: ヘッダーはロゴ+社名とバージョンのみ
              <VersionBadge />
            ) : isAuthed ? (
              // 非縦かつ認証済み: ヘッダーに集約
              <div className="flex items-center gap-3">
                <span className="max-w-[30vw] truncate text-sm text-gray-600">
                  ようこそ、{session?.user?.name || session?.user?.email}
                </span>
                {/* Google認証済みかつ無効化されていなければ個別ログアウト、無効化中なら編集ログイン */}
                {(session as any)?.editorVerified && !editorDisabled ? (
                  <button
                    onClick={() => { document.cookie = 'editor_disabled=1; Path=/; Max-Age=31536000; SameSite=Lax'; window.location.reload() }}
                    className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600"
                  >
                    個別ログアウト
                  </button>
                ) : (
                  <button
                    onClick={() => { document.cookie = 'editor_disabled=; Path=/; Max-Age=0; SameSite=Lax'; signIn('google') }}
                    className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                  >
                    編集ログイン
                  </button>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="px-3 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  ログアウト
                </button>
                <VersionBadge />
              </div>
            ) : (
              // 非縦かつ未認証: バージョンのみ
              <VersionBadge />
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function VersionBadge() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION
  const sha = process.env.NEXT_PUBLIC_GIT_SHA
  const showSha = (process.env.NEXT_PUBLIC_SHOW_SHA || 'false') === 'true'
  const shortSha = sha ? sha.substring(0, 7) : ''
  const label = showSha && shortSha ? `v${version}+${shortSha}` : `v${version}`
  return (
    <span className="text-sm text-gray-500" title={showSha && sha ? sha : undefined}>{label}</span>
  )
}


