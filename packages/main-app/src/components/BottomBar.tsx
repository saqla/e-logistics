"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { Menu, Save, MessageSquare, X } from 'lucide-react';
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
  const [hasData, setHasData] = useState(false); // 仮のデータ有無フラグ、後で実装時に調整
  const [isMobile, setIsMobile] = useState(false);
  const [vw, setVw] = useState(0);
  const isPortrait = useIsPortrait();

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
  const containerGapCls = isTabletPortrait ? 'gap-8' : 'gap-6';

  // スクロール方向で表示/非表示を切り替え（安定版）
  useEffect(() => {
    if (!shouldShowBar) return;

    const lastYRef = { current: window.scrollY || 0 } as { current: number };
    const tickingRef = { current: false } as { current: boolean };
    const DELTA = 10; // しきい値（小さなスクロールでは反応しない）

    const onScroll = () => {
      const run = () => {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        const prev = lastYRef.current;
        const diff = y - prev;

        if (y <= 60 || Math.abs(diff) < DELTA) {
          setIsVisible(true);
        } else if (diff > 0) {
          setIsVisible(false);
        } else {
          setIsVisible(true);
        }
        lastYRef.current = y;
        tickingRef.current = false;
      };

      if (!tickingRef.current) {
        tickingRef.current = true;
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(run);
        } else {
          setTimeout(run, 16);
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [shouldShowBar]);

  // 入力フォーカス検知 (仮実装、後でフォーム状態と連動)
  useEffect(() => {
    const handleFocus = () => setIsInputFocused(true);
    const handleBlur = () => setIsInputFocused(false);
    
    const nodes = Array.from(document.querySelectorAll('input, textarea')) as HTMLElement[];
    nodes.forEach(el => {
      el.addEventListener('focus', handleFocus);
      el.addEventListener('blur', handleBlur);
    });
    
    return () => {
      nodes.forEach(el => {
        el.removeEventListener('focus', handleFocus);
        el.removeEventListener('blur', handleBlur);
      });
    };
  }, []);

  const handleMenu = () => {
    router.push('/');
  };

  const handleSave = () => {
    const event = new CustomEvent('requestScheduleSave', { detail: { source: 'BottomBar' } });
    window.dispatchEvent(event);
  };

  const handleRemarks = () => {
    const event = new CustomEvent('openRemarksDialog', { detail: { source: 'BottomBar' } });
    window.dispatchEvent(event);
  };

  const handleCancel = () => {
    setIsInputFocused(false);
  };

  const handleDelete = () => {
    // placeholder
  };

  if (!shouldShowBar) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 bg-gray-100/90 backdrop-blur-sm transition-transform duration-300',
        isVisible ? 'translate-y-0' : 'translate-y-full',
        'pb-[env(safe-area-inset-bottom)]'
      )}
      style={{ height: `${barHeightPx}px` }}
    >
      <div className={cn('flex items-center h-full px-4 max-w-5xl mx-auto justify-center', containerGapCls)}>
        {isInputFocused ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="flex flex-col h-11 w-16 text-foreground/80 hover:text-foreground"
              onClick={handleSave}
            >
              <Save className={iconSizeCls} />
              <span className={labelSizeCls}>保存</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="flex flex-col h-11 w-16 text-foreground/80 hover:text-foreground"
              onClick={handleCancel}
            >
              <X className={iconSizeCls} />
              <span className={labelSizeCls}>キャンセル</span>
            </Button>
            {hasData && (
              <Button
                variant="ghost"
                size="icon"
                className="flex flex-col h-11 w-16 text-destructive/80 hover:text-destructive"
                onClick={handleDelete}
              >
                <X className={iconSizeCls} />
                <span className={labelSizeCls}>削除</span>
              </Button>
            )}
          </>
        ) : (
          <>
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
            >
              <Save className={iconSizeCls} />
              <span className={labelSizeCls}>保存</span>
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
          </>
        )}
      </div>
    </div>
  );
};

export default BottomBar;
