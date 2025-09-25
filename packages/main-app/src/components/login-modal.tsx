"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LoginForm } from "@/components/login-form"

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: () => void
}

export function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const handleLoginSuccess = () => {
    onLoginSuccess()
    onClose()
  }

  const handleLoginError = (error: string) => {
    // エラーハンドリング（トーストなどで表示）
    alert(error)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-white text-gray-900 border border-gray-200 shadow-lg">
        <DialogHeader>
          <DialogTitle>ログイン</DialogTitle>
          <DialogDescription>
            ユーザーIDとパスワードを入力してログインしてください。
          </DialogDescription>
        </DialogHeader>
        <LoginForm
          onSuccess={handleLoginSuccess}
          onError={handleLoginError}
        />
      </DialogContent>
    </Dialog>
  )
}