'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Trophy,
  Swords,
  Shield,
  User,
  Calendar,
  BrainCircuit,
  Menu,
  PlugZap,
  X,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/', icon: Trophy, asset: '/legacy/lol.png', label: '胜率预测', description: '主页' },
  { href: '/champions', icon: Swords, asset: '/opgg-champion-list.svg', label: '英雄数据', description: '统计分析' },
  { href: '/teams', icon: Shield, asset: '/opgg_esports_favicon.ico', label: '战队数据', description: '战绩排名' },
  { href: '/players', icon: User, label: '选手数据', description: '个人数据' },
  { href: '/schedule', icon: Calendar, label: '职业赛程', description: '比赛日程' },
  { href: '/ai-provider', icon: PlugZap, label: 'AI 提供商', description: '模型配置' },
  { href: '/model-lab', icon: BrainCircuit, label: '模型实验室', description: '训练诊断' },
]

function normalizePath(pathname: string | null) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '')
}

export function Sidebar() {
  const pathname = usePathname()
  const currentPath = normalizePath(pathname)
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-40 transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-primary to-secondary flex-shrink-0">
          <Image src="/legacy/logo.png" alt="DeepWin" fill className="object-cover" priority />
        </div>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="overflow-hidden"
          >
            <h1 className="truncate font-serif text-sm font-bold text-foreground">LOL-DeepWinPredictor</h1>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentPath === item.href
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 4 }}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all group card-hover-glow',
                  isActive
                    ? 'bg-sidebar-accent border border-primary/50 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border border-transparent'
                )}
              >
                {item.asset ? (
                  <span className="relative w-5 h-5 flex-shrink-0">
                    <img src={item.asset} alt="" className="h-5 w-5 object-contain" />
                  </span>
                ) : (
                  <item.icon
                    className={cn(
                      'w-5 h-5 flex-shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-secondary'
                    )}
                  />
                )}
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                )}
                {!isCollapsed && isActive && (
                  <ChevronRight className="w-4 h-4 text-primary" />
                )}
              </motion.div>
            </Link>
          )
        })}
      </nav>

      {/* Collapse Button */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full justify-center"
        >
          <ChevronRight
            className={cn(
              'w-5 h-5 transition-transform',
              isCollapsed ? 'rotate-0' : 'rotate-180'
            )}
          />
        </Button>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const pathname = usePathname()
  const currentPath = normalizePath(pathname)
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-sidebar/95 backdrop-blur-lg border-b border-sidebar-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-primary to-secondary">
            <Image src="/legacy/logo.png" alt="DeepWin" fill className="object-cover" priority />
          </div>
          <span className="font-serif text-sm font-bold text-foreground">LOL-DeepWinPredictor</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 20 }}
              className="absolute left-0 top-16 bottom-0 w-72 bg-sidebar border-r border-sidebar-border p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <nav className="space-y-2">
                {navItems.map((item) => {
                  const isActive = currentPath === item.href
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
                      <div
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                          isActive
                            ? 'bg-sidebar-accent border border-primary/50 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border border-transparent'
                        )}
                      >
                        {item.asset ? (
                          <span className="relative w-5 h-5 flex-shrink-0">
                            <img src={item.asset} alt="" className="h-5 w-5 object-contain" />
                          </span>
                        ) : (
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-sidebar/95 backdrop-blur-lg border-t border-sidebar-border flex items-center justify-around px-2">
        {navItems.slice(0, 5).map((item) => {
          const isActive = currentPath === item.href
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div
                className={cn(
                  'flex flex-col items-center justify-center py-2 rounded-lg transition-all',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {item.asset ? (
                  <span className="relative w-5 h-5">
                    <img src={item.asset} alt="" className="h-5 w-5 object-contain" />
                  </span>
                ) : (
                  <item.icon className="w-5 h-5" />
                )}
                <span className="text-[10px] mt-1 truncate max-w-full px-1">{item.label}</span>
              </div>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
