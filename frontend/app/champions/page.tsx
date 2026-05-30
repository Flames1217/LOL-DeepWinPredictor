'use client'

import { memo, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  Database,
  GitBranch,
  Globe2,
  LayoutGrid,
  LayoutList,
  Loader2,
  Search,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getChampionImageUrl, getChampionSplashUrl } from '@/lib/mock-data'
import {
  fetchChampionDetail,
  fetchChampionPositionStats,
  fetchHeroLaneStats,
  fetchHeroes,
  fetchTencentChampionPositionStats,
  normalizeChampions,
  type ApiChampionPositionStatsResponse,
} from '@/lib/api'
import { RoleIcon, roleNames } from '@/components/role-icons'
import type { Champion, ChampionDetail, ChampionDetailBuildRow, ChampionDetailRunePage, Role } from '@/lib/types'

const roles: Role[] = ['TOP', 'JUN', 'MID', 'ADC', 'SUP']
const tiers = ['T0', 'T1', 'T2', 'T3', 'T4'] as const
const opggRolePath: Record<Role, string> = {
  TOP: 'top',
  JUN: 'jungle',
  MID: 'mid',
  ADC: 'adc',
  SUP: 'support',
}
const cnLaneByRole: Record<Role | 'ALL', string> = {
  ALL: 'all',
  TOP: 'top',
  JUN: 'jungle',
  MID: 'mid',
  ADC: 'bottom',
  SUP: 'support',
}

const medalUrl = (tier: string) => `https://opgg-static.akamaized.net/images/medals_mini/${tier}.png`
const qqRankIcon = (tier: string) => `https://down.qq.com/lolapp/lol/rankedicons/Season_2022_${tier}.png`

type RegionOption = {
  value: string
  label: string
  nativeSource?: boolean
}

type TierOption = {
  value: string
  label: string
  iconUrl?: string
}

const regionOptions: readonly RegionOption[] = [
  { value: 'global', label: '全球' },
  { value: 'cn', label: '中国', nativeSource: true },
  { value: 'na', label: '北美' },
  { value: 'me', label: '中东' },
  { value: 'euw', label: '西欧' },
  { value: 'eune', label: '北欧与东欧' },
  { value: 'oce', label: '大洋洲' },
  { value: 'kr', label: '韩国' },
  { value: 'jp', label: '日本' },
  { value: 'br', label: '巴西' },
  { value: 'las', label: '拉丁美洲南' },
  { value: 'lan', label: '拉丁美洲北' },
  { value: 'ru', label: '俄罗斯' },
  { value: 'tr', label: '土耳其' },
  { value: 'sea', label: '东南亚' },
  { value: 'tw', label: '中国台湾' },
  { value: 'vn', label: '越南' },
] as const

const opggTierOptions: readonly TierOption[] = [
  { value: 'all', label: '全部段位' },
  { value: 'challenger', label: '最强王者', iconUrl: medalUrl('challenger') },
  { value: 'grandmaster', label: '傲世宗师', iconUrl: medalUrl('grandmaster') },
  { value: 'master_plus', label: '超凡大师+', iconUrl: medalUrl('master') },
  { value: 'master', label: '超凡大师', iconUrl: medalUrl('master') },
  { value: 'diamond_plus', label: '钻石+', iconUrl: medalUrl('diamond') },
  { value: 'diamond', label: '钻石', iconUrl: medalUrl('diamond') },
  { value: 'emerald_plus', label: '翡翠+', iconUrl: medalUrl('emerald') },
  { value: 'emerald', label: '翡翠', iconUrl: medalUrl('emerald') },
  { value: 'platinum_plus', label: '铂金+', iconUrl: medalUrl('platinum') },
  { value: 'platinum', label: '铂金', iconUrl: medalUrl('platinum') },
  { value: 'gold_plus', label: '黄金+', iconUrl: medalUrl('gold') },
  { value: 'gold', label: '黄金', iconUrl: medalUrl('gold') },
  { value: 'silver', label: '白银', iconUrl: medalUrl('silver') },
  { value: 'bronze', label: '青铜', iconUrl: medalUrl('bronze') },
  { value: 'iron', label: '黑铁', iconUrl: medalUrl('iron') },
] as const

const cnTierOptions: readonly TierOption[] = [
  { value: '999', label: '全部段位' },
  { value: '200', label: '铂金及以上' },
  { value: '311', label: '峡谷之巅铂金及以上' },
  { value: '0', label: '王者', iconUrl: qqRankIcon('Challenger') },
  { value: '5', label: '宗师', iconUrl: qqRankIcon('Grandmaster') },
  { value: '6', label: '大师', iconUrl: qqRankIcon('Master') },
  { value: '10', label: '钻石', iconUrl: qqRankIcon('Diamond') },
  { value: '15', label: '翡翠', iconUrl: qqRankIcon('Emerald') },
  { value: '20', label: '铂金', iconUrl: qqRankIcon('Platinum') },
  { value: '30', label: '黄金', iconUrl: qqRankIcon('Gold') },
  { value: '40', label: '白银', iconUrl: qqRankIcon('Silver') },
  { value: '50', label: '黄铜', iconUrl: qqRankIcon('Bronze') },
  { value: '80', label: '黑铁', iconUrl: qqRankIcon('Iron') },
] as const

const opggGameOptions = [
  { value: 'SOLORANKED', label: '单排/双排' },
  { value: 'FLEXRANKED', label: '灵活排位' },
  { value: 'todays_hot', label: '今日推荐' },
] as const

const cnQueueOptions = [
  { value: '888', label: '全部' },
  { value: '420', label: '单双排' },
  { value: '440', label: '灵活组排' },
  { value: '700', label: '冠军杯赛' },
] as const

const defaultVersion = '16.10'
const TABLE_RENDER_LIMIT = 120

type RegionFilter = (typeof regionOptions)[number]['value']
type VersionFilter = string

const tierColors: Record<string, string> = {
  T0: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black',
  T1: 'bg-gradient-to-r from-purple-500 to-violet-400 text-white',
  T2: 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white',
  T3: 'bg-gradient-to-r from-green-500 to-emerald-400 text-white',
  T4: 'bg-gradient-to-r from-gray-500 to-slate-400 text-white',
}

function championIcon(champion: Champion) {
  return champion.imageUrl || getChampionImageUrl(champion.en)
}

function formatRate(rate: number, digits = 2) {
  return `${(rate * 100).toFixed(digits)}%`
}

function formatDetailRate(rate?: number | null, digits = 1) {
  return Number.isFinite(Number(rate)) ? `${Number(rate).toFixed(digits)}%` : '-'
}

function formatCount(value?: number) {
  if (!value) return '-'
  return value.toLocaleString()
}

function formatTimestamp(value?: string | null) {
  if (!value) return '未同步'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function OptionLabel({
  icon,
  iconUrl,
  label,
}: {
  icon?: ReactNode
  iconUrl?: string
  label: string
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {(icon || iconUrl) && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm">
          {iconUrl ? <img src={iconUrl} alt="" className="h-5 w-5 object-contain" /> : icon}
        </span>
      )}
      <span className="truncate">{label}</span>
    </span>
  )
}

function RegionIcon({ region }: { region: string }) {
  return <img src={`/opgg_region_icon/${region}.svg`} alt="" className="h-5 w-5 object-contain" />
}

function WinRateBar({ rate, className }: { rate: number; className?: string }) {
  const color =
    rate >= 0.55 ? 'bg-[#00D563]' : rate >= 0.45 ? 'bg-[#F0C93A]' : 'bg-[#FF4D4D]'

  return (
    <div className={cn('relative h-2 bg-muted rounded-full overflow-hidden', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(rate, 1)) * 100}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={cn('absolute h-full rounded-full', color)}
      />
    </div>
  )
}

function RateCell({ rate }: { rate: number }) {
  return (
    <div className="w-24">
      <WinRateBar rate={rate} />
      <span className="text-xs text-muted-foreground">{formatRate(rate)}</span>
    </div>
  )
}

function CounterList({
  champion,
  onOpenDetail,
}: {
  champion: Champion
  onOpenDetail: (champion: Champion, targetCounter?: string | null) => void
}) {
  const counters = champion.counters || []

  if (!counters.length) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <div className="flex items-center gap-2">
      {counters.slice(0, 3).map((counter, index) => (
        <button
          type="button"
          key={`${counter.heroId || counter.en || counter.name}-${index}`}
          className="group flex w-10 shrink-0 flex-col items-center gap-1 rounded-md text-muted-foreground transition hover:text-foreground"
          title={[
            counter.name,
            counter.winRate !== undefined ? formatRate(counter.winRate) : '',
            counter.games ? `${formatCount(counter.games)} 场` : '',
          ].filter(Boolean).join(' · ')}
          onClick={(event) => {
            event.stopPropagation()
            onOpenDetail(champion, counter.en || counter.name || null)
          }}
        >
          <span className="relative h-8 w-8 overflow-hidden rounded-full border border-border bg-muted transition group-hover:border-primary">
            {counter.imageUrl ? (
              <Image src={counter.imageUrl} alt={counter.name} fill className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs">{counter.name.slice(0, 1)}</span>
            )}
          </span>
          <span className="text-[10px] leading-none">
            {counter.winRate !== undefined ? formatRate(counter.winRate, 1) : '-'}
          </span>
        </button>
      ))}
    </div>
  )
}

function RankCell({
  champion,
  showDelta,
  displayRank,
}: {
  champion: Champion
  showDelta: boolean
  displayRank?: number
}) {
  const delta = champion.rankDelta
  const hasDelta = showDelta && delta !== undefined && Number.isFinite(delta)

  return (
    <div className="flex min-w-16 items-center gap-2">
      <span className="w-6 text-sm font-medium text-foreground">{displayRank || champion.rank || '-'}</span>
      {hasDelta && delta > 0 && <span className="text-xs font-bold text-emerald-400">↑ {delta}</span>}
      {hasDelta && delta < 0 && <span className="text-xs font-bold text-rose-400">↓ {delta}</span>}
      {hasDelta && delta === 0 && <span className="text-xs font-bold text-muted-foreground">=</span>}
    </div>
  )
}

const ChampionTableRow = memo(function ChampionTableRow({
  champion,
  showRankDelta,
  displayRank,
  onOpenDetail,
}: {
  champion: Champion
  showRankDelta: boolean
  displayRank?: number
  onOpenDetail: (champion: Champion, targetCounter?: string | null) => void
}) {
  const winRateColor =
    champion.winRate >= 0.55
      ? 'text-[#00D563]'
      : champion.winRate >= 0.45
        ? 'text-[#F0C93A]'
        : 'text-[#FF4D4D]'

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="p-4">
        <RankCell champion={champion} showDelta={showRankDelta} displayRank={displayRank} />
      </td>
      <td className="p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative h-10 w-10 overflow-hidden rounded-lg border border-border transition hover:border-primary"
            title={`${champion.name} 详情`}
            onClick={() => onOpenDetail(champion)}
          >
            <Image src={championIcon(champion)} alt={champion.name} fill className="object-cover" />
          </button>
          <div>
            <p className="font-medium text-foreground">{champion.name}</p>
            <p className="text-xs text-muted-foreground">{champion.en}</p>
          </div>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <RoleIcon role={champion.role} className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{roleNames[champion.role]}</span>
        </div>
      </td>
      <td className="p-4"><RateCell rate={champion.banRate} /></td>
      <td className="p-4"><RateCell rate={champion.pickRate} /></td>
      <td className="p-4"><RateCell rate={champion.presenceRate ?? champion.banRate + champion.pickRate} /></td>
      <td className="p-4 text-sm text-muted-foreground">
        {champion.roleRate !== undefined ? formatRate(champion.roleRate, 1) : '-'}
      </td>
      <td className="p-4">
        <span className={cn('font-bold', winRateColor)}>{formatRate(champion.winRate)}</span>
        {champion.winRateDelta !== undefined && (
          <span className={cn('ml-2 text-xs', champion.winRateDelta >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {champion.winRateDelta >= 0 ? '+' : ''}{formatRate(champion.winRateDelta, 1)}
          </span>
        )}
      </td>
      <td className="p-4 text-sm text-muted-foreground">{formatCount(champion.games)}</td>
      <td className="p-4 text-muted-foreground">
        <CounterList champion={champion} onOpenDetail={onOpenDetail} />
      </td>
      <td className="p-4">
        {champion.tier && (
          <span className={cn('px-2 py-0.5 rounded text-xs font-bold', tierColors[champion.tier])}>
            {champion.tier}
          </span>
        )}
      </td>
    </tr>
  )
})

function ChampionCard({
  champion,
  onOpenDetail,
}: {
  champion: Champion
  onOpenDetail: (champion: Champion, targetCounter?: string | null) => void
}) {
  const winRateColor =
    champion.winRate >= 0.55
      ? 'text-[#00D563]'
      : champion.winRate >= 0.45
        ? 'text-[#F0C93A]'
        : 'text-[#FF4D4D]'

  return (
    <motion.div whileHover={{ y: -4 }} className="group">
      <Card className="overflow-hidden border-border card-hover-glow">
        <div className="relative h-32 overflow-hidden">
          <Image
            src={getChampionSplashUrl(champion.en)}
            alt={champion.name}
            fill
            className="object-cover object-top transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
          {champion.tier && (
            <span className={cn('absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-bold', tierColors[champion.tier])}>
              {champion.tier}
            </span>
          )}
        </div>
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              className="relative h-10 w-10 overflow-hidden rounded-lg border border-border transition hover:border-primary"
              title={`${champion.name} 详情`}
              onClick={() => onOpenDetail(champion)}
            >
              <Image src={championIcon(champion)} alt={champion.name} fill className="object-cover" />
            </button>
            <div>
              <p className="font-medium text-foreground">{champion.name}</p>
              <div className="flex items-center gap-1 text-muted-foreground">
                <RoleIcon role={champion.role} className="h-3 w-3" />
                <span className="text-xs">{roleNames[champion.role]}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">禁用率</p>
              <p className="text-sm font-medium text-foreground">{formatRate(champion.banRate)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">登场率</p>
              <p className="text-sm font-medium text-foreground">{formatRate(champion.pickRate)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">热度</p>
              <p className="text-sm font-medium text-foreground">{formatRate(champion.presenceRate ?? champion.pickRate + champion.banRate)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">分路占比</p>
              <p className="text-sm font-medium text-foreground">{champion.roleRate !== undefined ? formatRate(champion.roleRate, 1) : '-'}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">样本</p>
              <p className="text-sm font-medium text-foreground">{formatCount(champion.games)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">胜率</p>
              <p className={cn('text-sm font-bold', winRateColor)}>{formatRate(champion.winRate)}</p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function TierList({
  champions,
  onOpenDetail,
}: {
  champions: Champion[]
  onOpenDetail: (champion: Champion, targetCounter?: string | null) => void
}) {
  const tierGroups = useMemo(() => {
    const groups: Record<string, Champion[]> = {}
    tiers.forEach((tier) => {
      groups[tier] = champions.filter((c) => c.tier === tier).slice(0, 5)
    })
    return groups
  }, [champions])

  return (
    <Card className="p-4 border-border">
      <h3 className="mb-4 text-lg font-semibold text-foreground">段位榜摘要</h3>
      <div className="space-y-4">
        {tiers.map((tier) => (
          <div key={tier}>
            <div className="mb-2 flex items-center gap-2">
              <span className={cn('px-2 py-0.5 rounded text-xs font-bold', tierColors[tier])}>
                {tier}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {tierGroups[tier].map((champion) => (
                <button
                  type="button"
                  key={champion.id}
                  className="relative h-10 w-10 overflow-hidden rounded-lg border border-border card-hover-glow"
                  title={champion.name}
                  onClick={() => onOpenDetail(champion)}
                >
                  <Image src={championIcon(champion)} alt={champion.name} fill className="object-cover" />
                </button>
              ))}
              {tierGroups[tier].length === 0 && (
                <span className="text-xs text-muted-foreground">暂无英雄</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function buildEntryKey(entry?: ChampionDetailBuildRow['entries'][number]) {
  return String(entry?.id || entry?.name || '')
}

function BuildRowList({
  rows,
  previousRows,
  emptyText = '暂无数据',
}: {
  rows?: ChampionDetailBuildRow[]
  previousRows?: ChampionDetailBuildRow[]
  emptyText?: string
}) {
  if (!rows?.length) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="space-y-2">
      {rows.slice(0, 5).map((row, index) => {
        const previousRow = previousRows?.[index]
        const changedRate = Boolean(previousRow) && (
          previousRow?.pickRate !== row.pickRate ||
          previousRow?.play !== row.play ||
          previousRow?.winRate !== row.winRate
        )
        return (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-muted/20 p-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {row.entries.map((entry, entryIndex) => {
                const changed = Boolean(previousRow) && buildEntryKey(previousRow?.entries?.[entryIndex]) !== buildEntryKey(entry)
                return (
                  <div
                    key={`${entry.id || entry.name}-${entryIndex}`}
                    className={cn(
                      'relative h-7 w-7 shrink-0 overflow-hidden rounded border bg-muted transition-colors',
                      changed ? 'border-primary shadow-[0_0_0_2px_rgba(11,196,227,0.28)]' : 'border-border'
                    )}
                  >
                    {entry.imageUrl ? (
                      <Image src={entry.imageUrl} alt={entry.name} fill className="object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs">{entry.name.slice(0, 1)}</span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="grid min-w-[9.5rem] shrink-0 grid-cols-3 gap-2 text-right text-xs">
              <span className={cn('text-muted-foreground', changedRate && 'text-primary')}>{formatDetailRate(row.pickRate)}</span>
              <span className={cn('text-muted-foreground', changedRate && 'text-primary')}>{formatCount(row.play)}</span>
              <span className={cn('font-semibold text-emerald-400', changedRate && 'text-primary')}>{formatDetailRate(row.winRate)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CompactStatGrid({ stats }: { stats?: Record<string, string | number | null | undefined> }) {
  if (!stats) return null
  const items = [
    ['样本', stats.games],
    ['胜率', Number.isFinite(Number(stats.winRate)) ? formatDetailRate(Number(stats.winRate)) : undefined],
    ['分路占比', Number.isFinite(Number(stats.roleRate)) ? formatDetailRate(Number(stats.roleRate)) : undefined],
    ['登场率', Number.isFinite(Number(stats.pickRate)) ? formatDetailRate(Number(stats.pickRate)) : undefined],
    ['KDA', stats.kda],
    ['参团率', Number.isFinite(Number(stats.killParticipation)) ? formatDetailRate(Number(stats.killParticipation)) : undefined],
    ['伤害占比', Number.isFinite(Number(stats.damageToChampionShare)) ? formatDetailRate(Number(stats.damageToChampionShare)) : undefined],
    ['场均经济', stats.goldPerGame],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '')

  if (!items.length) return null
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-foreground">分路基础统计</h3>
      <div className="grid gap-2 sm:grid-cols-4">
        {items.map(([label, value]) => (
          <Card key={String(label)} className="border-border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-semibold text-foreground">{typeof value === 'number' ? formatCount(value) : value}</p>
          </Card>
        ))}
      </div>
    </section>
  )
}

function SkillBuildList({ builds }: { builds?: ChampionDetail['skillBuilds'] }) {
  if (!builds?.length) return null
  return (
    <div className="space-y-2">
      {builds.slice(0, 3).map((build, index) => (
        <div key={index} className="rounded-md border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {(build.order || []).map((key, keyIndex) => (
                <Badge key={`${key}-${keyIndex}`} variant="outline">{key}</Badge>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDetailRate(build.pickRate)} · <span className="font-semibold text-emerald-400">{formatDetailRate(build.winRate)}</span>
            </div>
          </div>
          {build.levelOrders?.[0]?.order?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {build.levelOrders[0].order?.map((key, keyIndex) => (
                <span key={`${key}-${keyIndex}`} className="flex h-6 w-6 items-center justify-center rounded bg-background text-xs font-semibold">
                  {key}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function activeRuneNames(page?: ChampionDetailRunePage) {
  const build = page?.builds?.[0]
  const main = (build?.main_runes || [])
    .flat()
    .filter((rune) => rune.isActive)
  const sub = (build?.sub_runes || [])
    .flat()
    .filter((rune) => rune.isActive)
  return [...main, ...sub]
}

function runeKey(rune?: ReturnType<typeof activeRuneNames>[number]) {
  return String(rune?.id || rune?.name || '')
}

function fallbackCountersFromChampion(champion: Champion): ChampionDetail['counters'] {
  return (champion.counters || []).map((counter) => ({
    champion: {
      image_url: counter.imageUrl,
      name: counter.name,
      key: counter.en || counter.name,
    },
    play: counter.games,
    win: counter.wins,
    win_rate: counter.winRate === undefined ? undefined : counter.winRate * 100,
  }))
}

function mergeDetailFallback(detail: ChampionDetail, champion: Champion): ChampionDetail {
  if (detail.counters?.length) return detail
  return {
    ...detail,
    counters: fallbackCountersFromChampion(champion),
  }
}

function ChampionDetailSheet({
  champion,
  detail,
  previousDetail,
  isLoading,
  targetCounter,
  open,
  onOpenChange,
  onCounterSelect,
}: {
  champion: Champion | null
  detail: ChampionDetail | null
  previousDetail?: ChampionDetail | null
  isLoading: boolean
  targetCounter?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCounterSelect?: (counter: ChampionDetail['counters'][number]) => void
}) {
  const primaryRunePage = detail?.runePages?.[0]
  const activeRunes = activeRuneNames(primaryRunePage)
  const normalizedTargetCounter = targetCounter?.toLowerCase()
  const highlightedCounter = detail?.counters.find((counter) => counter.champion.key.toLowerCase() === normalizedTargetCounter)
  const isRefreshing = isLoading && Boolean(detail)
  const hasComparableDetail = Boolean(previousDetail && detail && previousDetail.champion === detail.champion && previousDetail.position === detail.position)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-x-hidden overflow-y-auto border-border bg-card p-0 sm:max-w-[56rem]">
        <SheetHeader className="border-b border-border p-5">
          <div className="flex items-center gap-3">
            {champion && (
              <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-border bg-muted">
                <Image src={championIcon(champion)} alt={champion.name} fill className="object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <SheetTitle className="text-xl">{champion?.name || '英雄详情'}</SheetTitle>
              <SheetDescription>
                {champion ? `${champion.en} · ${roleNames[champion.role]} · OP.GG 详情缓存` : 'OP.GG 详情缓存'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isLoading && !detail && (
          <div className="flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            正在同步详情页数据
          </div>
        )}

        {detail && (
          <div className="space-y-5 p-5">
            {isRefreshing && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在切换对位构筑，先保留当前数据方便对比
                </span>
              </div>
            )}

            <CompactStatGrid stats={detail.laneStats} />

            <div className="grid gap-3 sm:grid-cols-4">
              <Card className="border-border p-3">
                <p className="text-xs text-muted-foreground">对位样本</p>
                <p className="mt-1 text-xl font-bold">{detail.counters.length}</p>
              </Card>
              <Card className="border-border p-3">
                <p className="text-xs text-muted-foreground">符文页</p>
                <p className="mt-1 text-xl font-bold">{detail.runePages.length}</p>
              </Card>
              <Card className="border-border p-3">
                <p className="text-xs text-muted-foreground">出装组</p>
                <p className="mt-1 text-xl font-bold">
                  {(detail.items.starterItems?.length || 0) + (detail.items.boots?.length || 0) + (detail.items.coreItems?.length || 0) + (detail.items.itemStats?.length || 0)}
                </p>
              </Card>
              <Card className="border-border p-3">
                <p className="text-xs text-muted-foreground">技能</p>
                <p className="mt-1 text-xl font-bold">{detail.skills.length}</p>
              </Card>
            </div>

            {highlightedCounter && (
              <Card className="border-primary/50 bg-primary/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full border border-primary">
                    {highlightedCounter.champion.image_url && (
                      <Image src={highlightedCounter.champion.image_url} alt={highlightedCounter.champion.name} fill className="object-cover" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">当前对位：{highlightedCounter.champion.name}</p>
                    <p className="text-xs text-muted-foreground">
                      胜率 {formatDetailRate(highlightedCounter.win_rate)} · {formatCount(highlightedCounter.play)} 场
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {highlightedCounter && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-primary/40 bg-primary/10 p-3">
                  <p className="text-xs text-muted-foreground">对位胜率</p>
                  <p className="mt-1 text-xl font-bold text-emerald-400">{formatDetailRate(highlightedCounter.win_rate)}</p>
                </Card>
                <Card className="border-primary/40 bg-primary/10 p-3">
                  <p className="text-xs text-muted-foreground">对位样本</p>
                  <p className="mt-1 text-xl font-bold">{formatCount(highlightedCounter.play)}</p>
                </Card>
                <Card className="border-primary/40 bg-primary/10 p-3">
                  <p className="text-xs text-muted-foreground">胜 / 负</p>
                  <p className="mt-1 text-xl font-bold">
                    {highlightedCounter.win !== undefined && highlightedCounter.play !== undefined
                      ? `${formatCount(highlightedCounter.win)} / ${formatCount(Math.max((highlightedCounter.play || 0) - (highlightedCounter.win || 0), 0))}`
                      : '-'}
                  </p>
                </Card>
              </div>
            )}

            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">对位情况</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {detail.counters.slice(0, 12).map((counter) => (
                  <button
                    type="button"
                    key={counter.champion.key}
                    onClick={() => onCounterSelect?.(counter)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md border border-border bg-muted/20 p-2 text-left transition hover:border-primary hover:bg-primary/10',
                      counter.champion.key.toLowerCase() === normalizedTargetCounter && 'border-primary bg-primary/10'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                        {counter.champion.image_url && (
                          <Image src={counter.champion.image_url} alt={counter.champion.name} fill className="object-cover" />
                        )}
                      </div>
                      <span className="truncate text-sm">{counter.champion.name}</span>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-semibold text-emerald-400">{formatDetailRate(counter.win_rate)}</p>
                      <p className="text-muted-foreground">{formatCount(counter.play)} 场</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border p-4 transition-colors">
                <h3 className="mb-3 text-sm font-semibold text-foreground">推荐符文</h3>
                {primaryRunePage ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {primaryRunePage.primary_perk_style?.image_url && (
                        <Image src={primaryRunePage.primary_perk_style.image_url} alt={primaryRunePage.primary_perk_style.name} width={28} height={28} />
                      )}
                      <Badge variant="outline">{primaryRunePage.primary_perk_style?.name}</Badge>
                      <Badge variant="outline">{primaryRunePage.perk_sub_style?.name}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDetailRate((primaryRunePage.pick_rate || 0) * 100)} · {formatDetailRate(primaryRunePage.win_rate)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeRunes.map((rune, index) => {
                        const previousRune = previousDetail ? activeRuneNames(previousDetail.runePages?.[0])[index] : undefined
                        const changed = hasComparableDetail && runeKey(previousRune) !== runeKey(rune)
                        return (
                          <span
                            key={rune.id || rune.name}
                            className={cn(
                              'flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs transition-colors',
                              changed ? 'border-primary text-primary shadow-[0_0_0_2px_rgba(11,196,227,0.18)]' : 'border-transparent'
                            )}
                          >
                            {rune.image_url && <Image src={rune.image_url} alt={rune.name} width={20} height={20} />}
                            {rune.name}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无符文数据</p>
                )}
              </Card>

              <Card className="border-border p-4 transition-colors">
                <h3 className="mb-3 text-sm font-semibold text-foreground">召唤师技能</h3>
                <BuildRowList rows={detail.summonerSpells} previousRows={previousDetail?.summonerSpells} />
              </Card>
            </section>

            <section className="grid min-w-0 gap-4 lg:grid-cols-2">
              <Card className="border-border p-4 transition-colors">
                <h3 className="mb-3 text-sm font-semibold text-foreground">起始装备</h3>
                <BuildRowList rows={detail.items.starterItems} previousRows={previousDetail?.items?.starterItems} />
              </Card>
              <Card className="border-border p-4 transition-colors">
                <h3 className="mb-3 text-sm font-semibold text-foreground">鞋子</h3>
                <BuildRowList rows={detail.items.boots} previousRows={previousDetail?.items?.boots} />
              </Card>
              <Card className="border-border p-4 transition-colors lg:col-span-2">
                <h3 className="mb-3 text-sm font-semibold text-foreground">核心出装</h3>
                <BuildRowList rows={detail.items.coreItems} previousRows={previousDetail?.items?.coreItems} />
              </Card>
              <Card className="border-border p-4 transition-colors lg:col-span-2">
                <h3 className="mb-3 text-sm font-semibold text-foreground">单件装备统计</h3>
                <BuildRowList rows={detail.items.itemStats} previousRows={previousDetail?.items?.itemStats} />
              </Card>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">技能与被动</h3>
              <div className="space-y-3">
                {detail.passive && (
                  <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 rounded-md border border-border bg-muted/20 p-2">
                    {detail.passive.image_url && <Image src={detail.passive.image_url} alt="被动" width={32} height={32} className="rounded" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{detail.passive.name || '被动'}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{detail.passive.description}</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {detail.skills.map((skill) => (
                    <div key={skill.key} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-md border border-border bg-muted/20 p-2">
                      {skill.image_url && <Image src={skill.image_url} alt={skill.name} width={32} height={32} className="rounded" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{skill.key}</p>
                        <p className="truncate text-xs text-muted-foreground">{skill.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <SkillBuildList builds={detail.skillBuilds} />
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default function ChampionsPage() {
  const [champions, setChampions] = useState<Champion[]>([])
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('global')
  const [tierFilter, setTierFilter] = useState('all')
  const [version, setVersion] = useState<VersionFilter>(defaultVersion)
  const [versionOptions, setVersionOptions] = useState<string[]>([defaultVersion])
  const [opggGameType, setOpggGameType] = useState('SOLORANKED')
  const [cnQueue, setCnQueue] = useState('420')
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [committedSearchQuery, setCommittedSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(committedSearchQuery)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<ApiChampionPositionStatsResponse | null>(null)
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null)
  const [selectedCounterKey, setSelectedCounterKey] = useState<string | null>(null)
  const [championDetail, setChampionDetail] = useState<ChampionDetail | null>(null)
  const [previousChampionDetail, setPreviousChampionDetail] = useState<ChampionDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const selectedRegion = useMemo(
    () => regionOptions.find((option) => option.value === regionFilter) || regionOptions[0],
    [regionFilter]
  )
  const activeTierOptions = selectedRegion.nativeSource ? cnTierOptions : opggTierOptions
  const selectedTier = useMemo(
    () => activeTierOptions.find((option) => option.value === tierFilter) || activeTierOptions[0],
    [activeTierOptions, tierFilter]
  )
  const activeGameOptions = selectedRegion.nativeSource ? cnQueueOptions : opggGameOptions
  const activeGameValue = selectedRegion.nativeSource ? cnQueue : opggGameType
  const selectedGame = activeGameOptions.find((option) => option.value === activeGameValue) || activeGameOptions[0]
  const displayedVersion = selectedRegion.nativeSource
    ? (meta?.patch || versionOptions[0] || version || defaultVersion)
    : version
  const activeVersionOptions = selectedRegion.nativeSource
    ? [displayedVersion].filter(Boolean)
    : versionOptions
  const showRankDelta = selectedRegion.nativeSource || roleFilter !== 'ALL'

  useEffect(() => {
    if (!activeTierOptions.some((option) => option.value === tierFilter)) {
      setTierFilter(activeTierOptions[0].value)
    }
  }, [activeTierOptions, tierFilter])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setCommittedSearchQuery(searchQuery)
    }, 180)
    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  function openChampionDetail(champion: Champion, targetCounter?: string | null) {
    if (selectedChampion?.id !== champion.id) {
      setChampionDetail(null)
      setPreviousChampionDetail(null)
    }
    setSelectedChampion(champion)
    setSelectedCounterKey(targetCounter ? targetCounter.toLowerCase() : null)
  }

  useEffect(() => {
    if (!selectedChampion) {
      setChampionDetail(null)
      setPreviousChampionDetail(null)
      return
    }

    let alive = true
    setIsDetailLoading(true)
    const canKeepCurrentDetail = championDetail?.champion?.toLowerCase() === selectedChampion.en.toLowerCase()
    if (canKeepCurrentDetail) {
      setPreviousChampionDetail(championDetail)
    } else {
      setChampionDetail(null)
      setPreviousChampionDetail(null)
    }

    fetchChampionDetail({
      champion: selectedChampion.en,
      position: opggRolePath[selectedChampion.role],
      region: selectedRegion.nativeSource ? 'global' : selectedRegion.value,
      tier: selectedRegion.nativeSource ? 'all' : selectedTier.value,
      version: displayedVersion,
      gameType: 'ranked',
      targetChampion: selectedCounterKey,
    })
      .then((detail) => {
        if (alive) setChampionDetail(mergeDetailFallback(detail, selectedChampion))
      })
      .catch(() => {
        if (alive) {
          setChampionDetail({
            source: 'local',
            champion: selectedChampion.en,
            position: opggRolePath[selectedChampion.role],
            patch: displayedVersion,
            cacheFallback: true,
            targetChampion: selectedCounterKey,
            matchupBuild: Boolean(selectedCounterKey),
            counters: fallbackCountersFromChampion(selectedChampion),
            runePages: [],
            summonerSpells: [],
            items: { starterItems: [], boots: [], coreItems: [], itemStats: [] },
            skills: [],
            passive: null,
            skillOrder: [],
          })
        }
      })
      .finally(() => {
        if (alive) setIsDetailLoading(false)
      })

    return () => {
      alive = false
    }
  }, [displayedVersion, selectedChampion, selectedCounterKey, selectedRegion.nativeSource, selectedRegion.value, selectedTier.value])

  useEffect(() => {
    let alive = true

    async function loadChampions() {
      setIsLoading(true)
      setError(null)

      try {
        const [heroes, laneStats, positionStats] = await Promise.all([
          fetchHeroes(),
          fetchHeroLaneStats(),
          selectedRegion.nativeSource
            ? fetchTencentChampionPositionStats(selectedTier.value, cnQueue, cnLaneByRole[roleFilter])
            : fetchChampionPositionStats({
                region: selectedRegion.value,
                tier: selectedTier.value,
                version,
                gameType: opggGameType,
              }),
        ])

        if (!alive) return

        const source = selectedRegion.nativeSource ? 'cn' : 'global'
        const sourceLabel = selectedRegion.nativeSource
          ? '中国 · 101'
          : `${selectedRegion.label} · OP.GG`
        const normalized = normalizeChampions(heroes, positionStats.data || [], laneStats, source)
          .map((champion) => ({
            ...champion,
            sourceLabel,
          }))

        const versionsFromMeta = (positionStats.versions || []).filter(Boolean)
        if (versionsFromMeta.length) {
          setVersionOptions(versionsFromMeta)
          if (!selectedRegion.nativeSource && !versionsFromMeta.includes(version)) {
            setVersion(versionsFromMeta[0])
          }
          if (selectedRegion.nativeSource) {
            setVersion(versionsFromMeta[0])
          }
        }

        setMeta(positionStats)
        setChampions(normalized)
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : '英雄数据加载失败')
      } finally {
        if (alive) setIsLoading(false)
      }
    }

    loadChampions()
    return () => {
      alive = false
    }
  }, [selectedRegion, selectedTier, version, opggGameType, cnQueue, roleFilter])

  const indexedChampions = useMemo(
    () =>
      champions.map((champion) => ({
        champion,
        searchText: [
          champion.name,
          champion.en,
          champion.keywords,
          champion.sourceLabel,
          roleNames[champion.role],
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase(),
      })),
    [champions]
  )

  const filteredChampions = useMemo(() => {
    const query = deferredSearchQuery.trim().toLocaleLowerCase()

    return indexedChampions
      .filter(({ champion, searchText }) => {
        if (!selectedRegion.nativeSource && roleFilter !== 'ALL' && champion.role !== roleFilter) return false
        if (!query) return true
        return searchText.includes(query)
      })
      .map(({ champion }) => champion)
      .sort((a, b) => {
        if (selectedRegion.nativeSource || roleFilter !== 'ALL') {
          const rankA = a.rank || Number.MAX_SAFE_INTEGER
          const rankB = b.rank || Number.MAX_SAFE_INTEGER
          if (rankA !== rankB) return rankA - rankB
        }
        if (a.sortIndex !== undefined && b.sortIndex !== undefined) return a.sortIndex - b.sortIndex
        if (a.sortIndex !== undefined) return -1
        if (b.sortIndex !== undefined) return 1
        return b.winRate - a.winRate
      })
  }, [deferredSearchQuery, indexedChampions, roleFilter, selectedRegion.nativeSource])
  const renderedChampions = useMemo(
    () => filteredChampions.slice(0, TABLE_RENDER_LIMIT),
    [filteredChampions]
  )

  const syncText = selectedRegion.nativeSource
    ? `101 更新：${meta?.updateDate || '未知'}`
    : `同步：${formatTimestamp(meta?.fetchedAt)}`

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mb-2 font-serif text-3xl font-bold text-foreground">英雄数据</h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-4 lg:flex-row"
      >
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:flex-wrap">
          <Select value={regionFilter} onValueChange={(value) => setRegionFilter(value as RegionFilter)}>
            <SelectTrigger className="w-full sm:w-44">
              <OptionLabel icon={<RegionIcon region={selectedRegion.value} />} label={selectedRegion.label} />
            </SelectTrigger>
            <SelectContent>
              {regionOptions.map((region) => (
                <SelectItem key={region.value} value={region.value}>
                  <OptionLabel icon={<RegionIcon region={region.value} />} label={region.label} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <OptionLabel iconUrl={selectedTier.iconUrl} label={selectedTier.label} />
            </SelectTrigger>
            <SelectContent>
              {activeTierOptions.map((tier) => (
                <SelectItem key={tier.value} value={tier.value}>
                  <OptionLabel iconUrl={tier.iconUrl} label={tier.label} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={displayedVersion}
            onValueChange={(value) => setVersion(value as VersionFilter)}
            disabled={selectedRegion.nativeSource}
          >
            <SelectTrigger className="w-full sm:w-44">
                <OptionLabel icon={<GitBranch className="h-4 w-4" />} label={`版本 ${displayedVersion}`} />
            </SelectTrigger>
            <SelectContent>
                {activeVersionOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    <OptionLabel icon={<GitBranch className="h-4 w-4" />} label={`版本 ${item}`} />
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select
            value={activeGameValue}
            onValueChange={(value) => {
              if (selectedRegion.nativeSource) {
                setCnQueue(value)
              } else {
                setOpggGameType(value)
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <OptionLabel label={selectedGame.label} />
            </SelectTrigger>
            <SelectContent>
              {activeGameOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <OptionLabel label={option.label} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as Role | 'ALL')}
            className="hidden lg:block"
          >
            <TabsList>
              <TabsTrigger value="ALL" className="flex items-center gap-1">
                <Globe2 className="h-4 w-4" />
                <span>全部</span>
              </TabsTrigger>
              {roles.map((role) => (
                <TabsTrigger key={role} value={role} className="flex items-center gap-1">
                  <RoleIcon role={role} className="h-4 w-4" />
                  <span className="hidden xl:inline">{roleNames[role]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as Role | 'ALL')}>
            <SelectTrigger className="w-full sm:w-32 lg:hidden">
              {roleFilter === 'ALL' ? (
                <OptionLabel icon={<Globe2 className="h-4 w-4" />} label="全部" />
              ) : (
                <OptionLabel icon={<RoleIcon role={roleFilter} className="h-4 w-4" />} label={roleNames[roleFilter]} />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                <OptionLabel icon={<Globe2 className="h-4 w-4" />} label="全部" />
              </SelectItem>
              {roles.map((role) => (
                <SelectItem key={role} value={role}>
                  <OptionLabel icon={<RoleIcon role={role} className="h-4 w-4" />} label={roleNames[role]} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索英雄..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('table')}
            title="表格视图"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'card' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('card')}
            title="卡片视图"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {isLoading && (
        <Card className="border-border p-10 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          正在加载英雄数据
        </Card>
      )}

      {!isLoading && error && (
        <Card className="border-destructive/40 bg-destructive/10 p-6 flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          {error}
        </Card>
      )}

      {!isLoading && !error && (
        <div className="grid gap-6 lg:grid-cols-[1fr,280px]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Database className="h-4 w-4" />
                当前显示 {filteredChampions.length.toLocaleString()} 条英雄分路数据
                {filteredChampions.length > renderedChampions.length && `，已渲染前 ${renderedChampions.length.toLocaleString()} 条`}
              </span>
              <span className="inline-flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {syncText}
              </span>
            </div>

            {viewMode === 'table' ? (
              <Card className="overflow-hidden border-border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="p-4 text-left text-sm font-medium text-muted-foreground">排名</th>
                        <th className="p-4 text-left text-sm font-medium text-muted-foreground">英雄</th>
                        <th className="p-4 text-left text-sm font-medium text-muted-foreground">位置</th>
                        <th className="p-4 text-left text-sm font-medium text-muted-foreground">禁用率</th>
                        <th className="p-4 text-left text-sm font-medium text-muted-foreground">登场率</th>
                        <th className="p-4 text-left text-sm font-medium text-muted-foreground">热度</th>
                        <th className="p-4 text-left text-sm font-medium text-muted-foreground">分路占比</th>
                        <th className="p-4 text-left text-sm font-medium text-muted-foreground">胜率</th>
                        <th className="p-4 text-left text-sm font-medium text-muted-foreground">样本</th>
                        <th className="p-4 text-left text-sm font-medium text-muted-foreground">对位情况</th>
                        <th className="p-4 text-left text-sm font-medium text-muted-foreground">段位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderedChampions.map((champion, index) => (
                        <ChampionTableRow
                          key={champion.id}
                          champion={champion}
                          showRankDelta={showRankDelta}
                          displayRank={!selectedRegion.nativeSource && roleFilter === 'ALL' ? index + 1 : undefined}
                          onOpenDetail={openChampionDetail}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {renderedChampions.map((champion, index) => (
                  <motion.div
                    key={champion.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.3) }}
                  >
                    <ChampionCard champion={champion} onOpenDetail={openChampionDetail} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="hidden lg:block"
          >
            <TierList champions={filteredChampions} onOpenDetail={openChampionDetail} />
          </motion.div>
        </div>
      )}
      <ChampionDetailSheet
        champion={selectedChampion}
        detail={championDetail}
        previousDetail={previousChampionDetail}
        isLoading={isDetailLoading}
        targetCounter={selectedCounterKey}
        open={Boolean(selectedChampion)}
        onCounterSelect={(counter) => setSelectedCounterKey(counter.champion.key.toLowerCase())}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedChampion(null)
            setSelectedCounterKey(null)
            setPreviousChampionDetail(null)
          }
        }}
      />
    </div>
  )
}
