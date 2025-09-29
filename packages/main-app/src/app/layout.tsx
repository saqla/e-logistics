import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import DevConsole from '@/components/DevConsole'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'E-Logistics Main App',
  description: 'Main application for E-Logistics system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={inter.className}>
        <Providers>
          <DevConsole />
          {children}
        </Providers>
      </body>
    </html>
  )
}
