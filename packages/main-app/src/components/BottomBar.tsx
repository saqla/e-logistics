"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { Menu, MessageSquare, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

function useIsPortrait(): boolean {
  const [isPortrait, setIsPortrait] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(orientation: portrait)')
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches)
    mq.addEventListener?.('change', handler)
    setIsPortrait(mq.matches)
    return () => mq.removeEventListener?.('change', handler)
  }, [])
  return isPortrait
}

const BottomBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [vw, setVw] = useState(0);
  const isPortrait = useIsPortrait();
  const [isSaving, setIsSaving] = useState(false);

  // schedule側のsaving状態を同期
  useEffect(() => {
    const onSaving = (e: Event) => {
      const ce = e as CustomEvent<{ saving: boolean }>
      setIsSaving(!!ce.detail?.saving)
    }
    window.addEventListener('scheduleSavingState', onSaving as EventListener)
    return () => window.removeEventListener('scheduleSavingState', onSaving as EventListener)
  }, [])
  

  // モバイル判定 + 幅の記録
  const onResize = useCallback(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 0
    setIsMobile(w < 768);
    setVw(w);
  }, []);

  useEffect(() => {
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [onResize]);

  // /scheduleでのみ表示（スマホ or タブレット縦）
  const shouldShowBar = pathname === '/schedule' && (isMobile || isPortrait);
  const isTabletPortrait = !isMobile && isPortrait && vw >= 768 && vw < 1200;
  const barHeightPx = isTabletPortrait ? 80 : 60;
  const iconSizeCls = isTabletPortrait ? 'h-6 w-6 mb-1' : 'h-5 w-5 mb-1';
  const labelSizeCls = isTabletPortrait ? 'text-[12px]' : 'text-[10px]';
  const containerGapCls = isTabletPortrait ? 'gap-12' : 'gap-10';

  // スクロール方向で表示/非表示を切り替え（ヒステリシス付きでチラつき防止）
  useEffect(() => {
    if (!shouldShowBar) return;

    let lastY = window.scrollY || 0;
    let timer: any = null;
    const THRESH = 30; // 30px以上の移動で判定
    const IDLE_MS = 120; // スクロール停止後に確定

    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        const diff = y - lastY;
        if (y <= 60) {
          setIsVisible(true);
        } else if (diff > THRESH) {
          setIsVisible(false);
        } else if (diff < -THRESH) {
          setIsVisible(true);
        }
        lastY = y;
      }, IDLE_MS);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [shouldShowBar]);

  // 入力時表示は当面行わないため、フォーカス検知は無効化

  const handleMenu = () => {
    router.push('/');
  };

  const handleRemarks = () => {
    const event = new CustomEvent('openRemarksDialog', { detail: { source: 'BottomBar' } });
    window.dispatchEvent(event);
  };
  const handleSave = () => {
    const event = new CustomEvent('requestScheduleSave', { detail: { source: 'BottomBar' } });
    window.dispatchEvent(event);
  };
  

  if (!shouldShowBar) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 bg-gray-100/90 backdrop-blur-sm transform-gpu will-change-transform transition-transform duration-300 ease-out',
        isVisible ? 'translate-y-0 pointer-events-auto' : 'translate-y-full pointer-events-none',
        isVisible ? 'pb-[env(safe-area-inset-bottom)]' : 'pb-0'
      )}
      style={{ height: `${barHeightPx}px` }}
    >
      <div className={cn('flex items-center h-full px-4 max-w-5xl mx-auto justify-center', containerGapCls)}>
        <Button
          variant="ghost"
          size="icon"
          className="flex flex-col h-11 w-16 text-foreground/80 hover:text-foreground"
          onClick={handleMenu}
        >
          <Menu className={iconSizeCls} />
          <span className={labelSizeCls}>アプリ選択</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="flex flex-col h-11 w-16 text-foreground/80 hover:text-foreground"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <span className="mb-1 inline-block h-5 w-5 border-2 border-current border-r-transparent rounded-full animate-spin" />
          ) : (
            <Save className={iconSizeCls} />
          )}
          <span className={labelSizeCls}>{isSaving ? '保存中' : '保存'}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="flex flex-col h-11 w-16 text-foreground/80 hover:text-foreground"
          onClick={handleRemarks}
        >
          <MessageSquare className={iconSizeCls} />
          <span className={labelSizeCls}>備考/管理</span>
        </Button>
      </div>
    </div>
  );
};

export default BottomBar;
