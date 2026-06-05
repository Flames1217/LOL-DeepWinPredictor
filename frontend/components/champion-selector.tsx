'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Fuse from 'fuse.js'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getChampionImageUrl, mockChampions } from '@/lib/mock-data'
import { RoleIcon, roleNames } from '@/components/role-icons'
import type { Role, Champion } from '@/lib/types'

interface ChampionSelectorProps {
  role: Role
  selectedChampion: string | null
  onSelect: (champion: string | null) => void
  disabledChampions: string[]
  champions?: Champion[]
  team: 'blue' | 'red'
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase()
}

function championSearchText(champion: Champion) {
  return [
    champion.name,
    champion.en,
    champion.keywords,
    champion.heroId,
  ]
    .filter((item) => item !== undefined && item !== null)
    .join(',')
    .toLocaleLowerCase()
}

export function ChampionSelector({
  role,
  selectedChampion,
  onSelect,
  disabledChampions,
  champions = mockChampions,
  team,
}: ChampionSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 根据位置筛选英雄
  const roleChampions = useMemo(
    () => champions.filter((c) => c.role === role && !c.searchOnly),
    [champions, role]
  )

  const searchableChampions = useMemo(() => {
    const grouped = new Map<string, Champion>()
    champions.forEach((champion) => {
      const existing = grouped.get(champion.en)
      if (!existing || champion.role === role) {
        grouped.set(champion.en, champion)
      }
    })
    return Array.from(grouped.values())
  }, [champions, role])

  // 默认展示当前分路；输入搜索词后改为全英雄搜索，兼容职业赛非常规选角。
  const fuse = useMemo(
    () =>
      new Fuse(searchableChampions, {
        keys: ['name', 'en', 'keywords'],
        isCaseSensitive: false,
        threshold: 0.4,
      }),
    [searchableChampions]
  )

  const filteredChampions = useMemo(() => {
    const query = normalizeSearchText(searchQuery)
    if (!query) return roleChampions
    const directMatches = searchableChampions.filter((champion) => championSearchText(champion).includes(query))
    if (directMatches.length) return directMatches
    return fuse.search(query).map((result) => result.item)
  }, [searchQuery, fuse, roleChampions, searchableChampions])

  const selectedChampionData = useMemo(
    () =>
      champions.find((c) => c.en === selectedChampion && c.role === role) ||
      champions.find((c) => c.en === selectedChampion),
    [champions, role, selectedChampion]
  )

  const getImageUrl = (championKey: string) =>
    champions.find((c) => c.en === championKey)?.imageUrl || getChampionImageUrl(championKey)

  const teamColors = {
    blue: {
      bg: 'bg-primary/10',
      border: 'border-primary/30',
      activeBorder: 'border-primary',
      glow: 'shadow-[0_0_20px_rgba(11,196,227,0.3)]',
    },
    red: {
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
      activeBorder: 'border-destructive',
      glow: 'shadow-[0_0_20px_rgba(232,64,87,0.3)]',
    },
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'relative w-full h-16 rounded-lg border-2 transition-all overflow-hidden group',
            teamColors[team].bg,
            selectedChampion
              ? `${teamColors[team].activeBorder} ${teamColors[team].glow}`
              : teamColors[team].border
          )}
        >
          {selectedChampion && selectedChampionData ? (
            <div className="flex items-center gap-2 p-2 h-full">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-border flex-shrink-0">
                <Image
                  src={getImageUrl(selectedChampion)}
                  alt={selectedChampionData.name}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-champion.png'
                  }}
                />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium text-sm text-foreground truncate">
                  {selectedChampionData.name}
                </p>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <RoleIcon role={role} className="w-3 h-3" />
                  <span className="text-xs">{roleNames[role]}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(null)
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full gap-2">
              <RoleIcon
                role={role}
                className={cn(
                  'w-5 h-5',
                  team === 'blue' ? 'text-primary/50' : 'text-destructive/50'
                )}
              />
              <span className="text-xs text-muted-foreground">
                {roleNames[role]}
              </span>
            </div>
          )}
        </motion.button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="center">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索英雄..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          <AnimatePresence mode="popLayout">
            {filteredChampions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                未找到英雄
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {filteredChampions.map((champion) => {
                  const isDisabled = disabledChampions.includes(champion.en)
                  const isSelected = selectedChampion === champion.en
                  return (
                    <motion.button
                      key={champion.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      disabled={isDisabled}
                      onClick={() => {
                        onSelect(champion.en)
                        setOpen(false)
                        setSearchQuery('')
                      }}
                      className={cn(
                        'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                        isDisabled
                          ? 'opacity-30 cursor-not-allowed grayscale'
                          : 'hover:border-secondary cursor-pointer',
                        isSelected ? 'border-secondary' : 'border-transparent'
                      )}
                      title={champion.name}
                    >
                      <Image
                        src={champion.imageUrl || getChampionImageUrl(champion.en)}
                        alt={champion.name}
                        fill
                        className="object-cover"
                      />
                      {isDisabled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                          <X className="w-6 h-6 text-destructive" />
                        </div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface BanSlotProps {
  champion: string | null
  onSelect: (champion: string | null) => void
  disabledChampions: string[]
  champions?: Champion[]
  team: 'blue' | 'red'
}

const banRoleOptions: Array<Role | 'ALL'> = ['ALL', 'TOP', 'JUN', 'MID', 'ADC', 'SUP']

export function BanSlot({
  champion,
  onSelect,
  disabledChampions,
  champions = mockChampions,
  team,
}: BanSlotProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL')
  const uniqueChampions = useMemo(() => {
    const grouped = new Map<string, Champion>()
    champions.forEach((champion) => {
      const existing = grouped.get(champion.en)
      if (
        !existing ||
        (existing.searchOnly && !champion.searchOnly) ||
        (roleFilter !== 'ALL' && champion.role === roleFilter && !champion.searchOnly)
      ) {
        grouped.set(champion.en, champion)
      }
    })
    return Array.from(grouped.values())
  }, [champions, roleFilter])

  const roleChampions = useMemo(
    () => roleFilter === 'ALL' ? uniqueChampions : uniqueChampions.filter((champion) => champion.role === roleFilter && !champion.searchOnly),
    [roleFilter, uniqueChampions]
  )

  const fuse = useMemo(
    () =>
      new Fuse(roleChampions, {
        keys: ['name', 'en', 'keywords'],
        isCaseSensitive: false,
        threshold: 0.4,
      }),
    [roleChampions]
  )

  const filteredChampions = useMemo(() => {
    const query = normalizeSearchText(searchQuery)
    if (!query) return roleChampions
    const directMatches = roleChampions.filter((champion) => championSearchText(champion).includes(query))
    if (directMatches.length) return directMatches
    return fuse.search(query).map((result) => result.item)
  }, [roleChampions, searchQuery, fuse])

  const championData = champion
    ? champions.find((c) => c.en === champion)
    : null

  const getImageUrl = (championKey: string) =>
    champions.find((c) => c.en === championKey)?.imageUrl || getChampionImageUrl(championKey)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'relative w-12 h-12 rounded-lg border transition-all overflow-hidden',
            champion
              ? 'border-destructive/50'
              : 'border-border bg-muted/30 hover:border-muted-foreground'
          )}
        >
          {champion && championData ? (
            <>
              <Image
                src={getImageUrl(champion)}
                alt={championData.name}
                fill
                className="object-cover grayscale"
              />
              <div className="absolute inset-0 bg-destructive/30 flex items-center justify-center">
                <X className="w-6 h-6 text-destructive" />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs text-muted-foreground">BAN</span>
            </div>
          )}
        </motion.button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="center">
        <div className="p-3 border-b border-border">
          <div className="mb-2 grid grid-cols-6 gap-1">
            {banRoleOptions.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                className={cn(
                  'flex h-8 items-center justify-center rounded-md border text-xs transition',
                  roleFilter === role
                    ? team === 'blue'
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-destructive bg-destructive/15 text-destructive'
                    : 'border-border bg-muted/20 text-muted-foreground hover:text-foreground'
                )}
                title={role === 'ALL' ? '全部分路' : roleNames[role]}
              >
                {role === 'ALL' ? '全' : <RoleIcon role={role} className="h-4 w-4" />}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={roleFilter === 'ALL' ? '搜索英雄...' : `搜索${roleNames[roleFilter]}英雄...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto p-2">
          <div className="grid grid-cols-5 gap-1">
            {filteredChampions.map((c) => {
              const isDisabled = disabledChampions.includes(c.en)
              return (
                <button
                  key={c.id}
                  disabled={isDisabled}
                  onClick={() => {
                    onSelect(c.en)
                    setOpen(false)
                    setSearchQuery('')
                    setRoleFilter('ALL')
                  }}
                  className={cn(
                    'relative aspect-square rounded overflow-hidden border transition-all',
                    isDisabled
                      ? 'opacity-30 cursor-not-allowed grayscale'
                      : 'hover:border-destructive cursor-pointer border-transparent'
                  )}
                  title={c.name}
                >
                  <Image
                    src={c.imageUrl || getChampionImageUrl(c.en)}
                    alt={c.name}
                    fill
                    className="object-cover"
                  />
                </button>
              )
            })}
          </div>
        </div>
        {champion && (
          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive"
              onClick={() => {
                onSelect(null)
                setOpen(false)
                setRoleFilter('ALL')
              }}
            >
              清除禁用
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
