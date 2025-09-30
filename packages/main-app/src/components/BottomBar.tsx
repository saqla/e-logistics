"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { Menu, Save, MessageSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const BottomBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [hasData, setHasData] = useState(false); // 仮のデータ有無フラグ、後で実装時に調整
  const [isMobile, setIsMobile] = useState(false);

  // モバイル判定
  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [checkMobile]);

  // /scheduleでのみ表示（モバイル限定）
  const shouldShowBar = pathname === '/schedule' && isMobile;

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

        // 上端付近 or ほとんど動いていない → 表示
        if (y <= 60 || Math.abs(diff) < DELTA) {
          setIsVisible(true);
        } else if (diff > 0) {
          // 下にスクロール → 隠す
          setIsVisible(false);
        } else {
          // 上にスクロール → 表示
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

  // 通常時のメニューアクション
  const handleMenu = () => {
    router.push('/'); // ダッシュボードに戻る
  };

  const handleSave = () => {
    // 保存リクエストをスケジュールページに送信するカスタムイベントを発火
    const event = new CustomEvent('requestScheduleSave', { detail: { source: 'BottomBar' } });
    window.dispatchEvent(event);
    console.log('Save clicked - Triggered requestScheduleSave event');
  };

  const handleRemarks = () => {
    // 備考ダイアログを開くためのカスタムイベントを発火
    const event = new CustomEvent('openRemarksDialog', { detail: { source: 'BottomBar' } });
    window.dispatchEvent(event);
    console.log('Remarks clicked - Triggered openRemarksDialog event');
  };

  // 入力フォーカス時のアクション
  const handleCancel = () => {
    setIsInputFocused(false);
    console.log('Cancel clicked - Placeholder for form reset');
  };

  const handleDelete = () => {
    console.log('Delete clicked - Placeholder for delete action');
  };

  if (!shouldShowBar) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 bg-gray-100/90 backdrop-blur-sm transition-transform duration-300',
        isVisible ? 'translate-y-0' : 'translate-y-full',
        'pb-[env(safe-area-inset-bottom)]'
      )}
      style={{ height: '60px' }}
    >
      <div className="flex justify-between items-center h-full px-4 max-w-5xl mx-auto">
        {isInputFocused ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="flex flex-col h-11 w-16 text-foreground/80 hover:text-foreground"
              onClick={handleSave}
            >
              <Save className="h-5 w-5 mb-1" />
              <span className="text-[10px]">保存</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="flex flex-col h-11 w-16 text-foreground/80 hover:text-foreground"
              onClick={handleCancel}
            >
              <X className="h-5 w-5 mb-1" />
              <span className="text-[10px]">キャンセル</span>
            </Button>
            {hasData && (
              <Button
                variant="ghost"
                size="icon"
                className="flex flex-col h-11 w-16 text-destructive/80 hover:text-destructive"
                onClick={handleDelete}
              >
                <X className="h-5 w-5 mb-1" />
                <span className="text-[10px]">削除</span>
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
              <Menu className="h-5 w-5 mb-1" />
              <span className="text-[10px]">アプリ選択</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="flex flex-col h-11 w-16 text-foreground/80 hover:text-foreground"
              onClick={handleSave}
            >
              <Save className="h-5 w-5 mb-1" />
              <span className="text-[10px]">保存</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="flex flex-col h-11 w-16 text-foreground/80 hover:text-foreground"
              onClick={handleRemarks}
            >
              <MessageSquare className="h-5 w-5 mb-1" />
              <span className="text-[10px]">備考/管理</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default BottomBar;
