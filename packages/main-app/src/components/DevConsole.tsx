'use client'

import { useEffect } from 'react'

function loadEruda() {
  if (typeof window === 'undefined') return
  // 二重初期化防止
  if ((window as any).__ERUDA_LOADED__) return
  ;(window as any).__ERUDA_LOADED__ = true
  const script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/npm/eruda'
  script.onload = () => {
    // @ts-ignore
    if (typeof (window as any).eruda !== 'undefined') {
      // @ts-ignore
      ;(window as any).eruda.init()
    }
  }
  document.body.appendChild(script)
}

export default function DevConsole() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const shouldEnable = url.searchParams.get('debug') === '1'
      if (shouldEnable) {
        loadEruda()
        // グローバルエラーロガー（原因特定用）
        const onError = (event: ErrorEvent) => {
          // Safari だと stack が空なことがあるため、可能な限り情報を出す
          console.log('[GlobalError]', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: (event.error && (event.error as any).stack) || null,
            error: event.error || null,
          })
        }
        const onRejection = (event: PromiseRejectionEvent) => {
          const reason: any = event.reason
          console.log('[UnhandledRejection]', {
            name: reason && reason.name,
            message: reason && reason.message,
            stack: reason && reason.stack,
            reason,
          })
        }
        window.addEventListener('error', onError)
        window.addEventListener('unhandledrejection', onRejection)
        return () => {
          window.removeEventListener('error', onError)
          window.removeEventListener('unhandledrejection', onRejection)
        }
      }
    } catch (_) {
      // 何もしない
    }
  }, [])
  return null
}


