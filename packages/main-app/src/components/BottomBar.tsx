"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Menu, Save, MessageSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const BottomBar: React.FC = () => {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [hasData, setHasData] = useState(false); // 仮のデータ有無フラグ、後で実装時に調整
  const [lastScrollY, setLastScrollY] = useState(0);

  // スクロール方向で表示/非表示を切り替え
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setIsVisible(false); // 下スクロールで隠す
      } else {
        setIsVisible(true); // 上スクロールで表示
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // 入力フォーカス検知 (仮実装、後でフォーム状態と連動)
  useEffect(() => {
    const handleFocus = () => setIsInputFocused(true);
    const handleBlur = () => setIsInputFocused(false);
    
    document.querySelectorAll('input, textarea').forEach(el => {
      el.addEventListener('focus', handleFocus);
      el.addEventListener('blur', handleBlur);
    });
    
    return () => {
      document.querySelectorAll('input, textarea').forEach(el => {
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
    // 保存ロジック、後でフォームと連動
    console.log('Save clicked');
  };

  const handleRemarks = () => {
    // 備考/管理、後でページ別遷移先に調整
    console.log('Remarks clicked');
  };

  // 入力フォーカス時のアクション
  const handleCancel = () => {
    // キャンセル、後でフォームリセットと連動
    setIsInputFocused(false);
    console.log('Cancel clicked');
  };

  const handleDelete = () => {
    // 削除、後でデータ有無と連動
    console.log('Delete clicked');
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm transition-transform duration-300',
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
              <span className="text-[10px]">Menu</span>
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
              <span className="text-[10px]">備考/</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default BottomBar;
