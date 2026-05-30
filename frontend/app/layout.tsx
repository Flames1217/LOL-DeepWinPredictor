import type { Metadata, Viewport } from 'next'
import { Sidebar, MobileNav, ExportButton } from '@/components/navigation'
import './globals.css'

export const metadata: Metadata = {
  title: 'LOL-DeepWinPredictor - 英雄联盟职业赛事胜率预测',
  description: '基于 BiLSTM 深度学习、职业赛事数据和英雄统计的 LOL 胜率预测平台。',
  keywords: ['英雄联盟', 'LOL', 'LPL', '胜率预测', '电竞', '深度学习', 'BiLSTM'],
  icons: {
    icon: '/legacy/logo.ico',
    shortcut: '/legacy/logo.ico',
    apple: '/legacy/logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0E1A',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="bg-background">
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-background hexagon-pattern">
          <Sidebar />
          <MobileNav />

          {/* Main Content */}
          <main className="lg:pl-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
            <div className="p-4 lg:p-8">
              {children}
            </div>
          </main>

          <ExportButton />
        </div>
      </body>
    </html>
  )
}
