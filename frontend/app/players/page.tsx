'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { AlertCircle, Database, ExternalLink, Loader2, Search, TrendingUp, Trophy, X } from 'lucide-react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { fetchPlayerDetail, fetchPlayerStats, normalizePlayers, type ApiPlayer, type ApiPlayerProfile, type ApiProLeague, type ApiProStatsResponse } from '@/lib/api'
import { RoleIcon, roleNames } from '@/components/role-icons'
import type { Player } from '@/lib/types'

const DEFAULT_LEAGUE = 'LPL'
const rankingMetrics = [
  { key: 'kda', label: 'KDA' },
  { key: 'avgDamage', label: 'DPM' },
  { key: 'goldPerMinute', label: 'GPM' },
  { key: 'winRate', label: '胜率' },
  { key: 'killParticipation', label: '参团率' },
  { key: 'mvpVotes', label: 'MVP 积分' },
] as const

type RankingMetric = (typeof rankingMetrics)[number]['key']

function getLeagueIconUrl(league: ApiProLeague) {
  return league.imageUrlColor || league.imageUrl?.replace('@black.', '.') || league.imageUrlDarkMode || league.imageUrl
}

function LeagueIcon({ league }: { league: ApiProLeague }) {
  const iconUrl = getLeagueIconUrl(league)

  if (!iconUrl) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/15 text-[11px] font-bold text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]">
        {(league.shortName || league.name || '?').slice(0, 1)}
      </span>
    )
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/15 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]">
      <img
        src={iconUrl}
        alt=""
        className="h-6 w-6 object-contain [filter:drop-shadow(0_0_2px_rgba(255,255,255,0.65))_drop-shadow(0_1px_1px_rgba(0,0,0,0.85))]"
      />
    </span>
  )
}

function LeagueOptionLabel({ league }: { league: ApiProLeague }) {
  const shortName = league.shortName || league.name || 'UNKNOWN'
  const name = league.name && league.name !== shortName ? ` · ${league.name}` : ''

  return (
    <span className="flex min-w-0 items-center gap-2">
      <LeagueIcon league={league} />
      <span className="truncate">{shortName}{name}</span>
    </span>
  )
}

function formatRate(rate?: number, digits = 0) {
  return `${((rate || 0) * 100).toFixed(digits)}%`
}

function formatNumber(value?: number, digits = 1) {
  if (!Number.isFinite(value)) return '-'
  return Number(value).toFixed(digits)
}

function rankingValue(player: Player, metric: RankingMetric) {
  return Number(player[metric] || 0)
}

function rankingDisplay(player: Player, metric: RankingMetric) {
  const value = rankingValue(player, metric)
  if (metric === 'winRate' || metric === 'killParticipation') return formatRate(value)
  if (metric === 'avgDamage' || metric === 'goldPerMinute') return formatNumber(value, 0)
  return formatNumber(value, 2)
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

function StatCard({
  label,
  value,
  color = 'default',
}: {
  label: string
  value: string | number
  color?: 'default' | 'green' | 'blue' | 'yellow'
}) {
  const colorClasses = {
    default: 'text-foreground',
    green: 'text-[#00D563]',
    blue: 'text-primary',
    yellow: 'text-secondary',
  }

  return (
    <div className="rounded-md bg-muted/30 p-4 text-center">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold', colorClasses[color])}>{value}</p>
    </div>
  )
}

function PlayerAvatar({ player, size = 'md' }: { player: Player; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'
  const avatar = player.avatar || player.opggAvatar
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-full border border-border bg-muted', sizeClass)}>
      {avatar ? (
        <Image src={avatar} alt={player.name} fill className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-bold text-foreground">
          {player.name.slice(0, 1)}
        </span>
      )}
    </div>
  )
}

function TeamLogo({ player }: { player: Player }) {
  const logo = player.teamLogo || player.opggTeamLogo
  if (!logo) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold text-foreground">
        {player.team.slice(0, 1)}
      </span>
    )
  }
  return (
    <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded bg-muted">
      <Image src={logo} alt={player.team} fill className="object-contain p-0.5" />
    </span>
  )
}

function PlayerLinks({ player }: { player: Player }) {
  const links = [
    ['直播', player.stream],
    ['YouTube', player.youtube],
    ['X', player.twitter],
    ['Facebook', player.facebook],
    ['Instagram', player.instagram],
    ['Discord', player.discord],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))

  if (!links.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {links.map(([label, href]) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          {label}
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  )
}

function meaningfulSeriesList(series?: ApiPlayerProfile['series']) {
  const seen = new Set<string>()
  return (series || []).filter((item) => {
    const name = item.name?.trim()
    if (!name || name === '-') return false
    const key = `${name}:${item.year || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function meaningfulCareerList(profile: ApiPlayerProfile) {
  const currentTeamId = String(profile.currentTeam?.id || '')
  const seen = new Set<string>()
  return (profile.careers || []).filter((career) => {
    const teamId = String(career.team?.id || '')
    const teamName = career.team?.acronym || career.team?.name
    const hasRange = Boolean(career.beginAt || career.endAt)
    if (!teamName) return false
    if (!hasRange && currentTeamId && teamId === currentTeamId) return false
    const key = `${teamId || teamName}:${career.beginAt || ''}:${career.endAt || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function countryFlagUrl(code?: string) {
  const normalized = code?.trim().toLowerCase()
  if (!normalized || normalized.length !== 2) return null
  return `https://flagcdn.com/${normalized}.svg`
}

function PlayerProfileBlocks({ profile, isLoading }: { profile: ApiPlayerProfile | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        正在同步 OP.GG 档案
      </div>
    )
  }
  if (!profile) return null

  const socials = Object.entries(profile.socials || {}).filter(([, href]) => Boolean(href)) as [string, string][]
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
  const recentSeries = meaningfulSeriesList(profile.series)
  const wonSeries = meaningfulSeriesList(profile.wonSeries)
  const careers = meaningfulCareerList(profile)
  const flagUrl = countryFlagUrl(profile.nationality)

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">OP.GG 档案</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md border border-border p-3">
          <p className="text-muted-foreground">真实姓名</p>
          <p className="mt-1 font-semibold text-foreground">{name || '-'}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-muted-foreground">国籍</p>
          <p className="mt-1 flex items-center gap-2 font-semibold text-foreground">
            {flagUrl && <img src={flagUrl} alt="" className="h-4 w-5 rounded-sm object-cover" />}
            {profile.nationality || '-'}
          </p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-muted-foreground">生日</p>
          <p className="mt-1 font-semibold text-foreground">{profile.birthday || '-'}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-muted-foreground">当前战队</p>
          <p className="mt-1 flex items-center gap-2 font-semibold text-foreground">
            {profile.currentTeam?.logo && <img src={profile.currentTeam.logo} alt="" className="h-5 w-5 object-contain" />}
            {profile.currentTeam?.acronym || profile.currentTeam?.name || '-'}
          </p>
        </div>
      </div>
      {socials.length ? (
        <div className="flex flex-wrap gap-2">
          {socials.map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary">
              {label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {recentSeries.length ? (
          <div className="rounded-md border border-border p-3">
            <p className="mb-2 text-sm font-medium text-foreground">近期赛事</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              {recentSeries.slice(0, 6).map((series) => (
                <p key={String(series.id || series.name)} className="truncate">{series.name || '-'} {series.year ? `· ${series.year}` : ''}</p>
              ))}
            </div>
          </div>
        ) : null}
        {wonSeries.length ? (
          <div className="rounded-md border border-border p-3">
            <p className="mb-2 text-sm font-medium text-foreground">冠军记录</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              {wonSeries.slice(0, 6).map((series) => (
                <p key={String(series.id || series.name)} className="truncate">{series.name || '-'} {series.year ? `· ${series.year}` : ''}</p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {careers.length ? (
        <div className="rounded-md border border-border p-3">
          <p className="mb-2 text-sm font-medium text-foreground">历史战队</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {careers.slice(0, 8).map((career, index) => (
              <div key={`${career.team?.id || career.team?.name}-${index}`} className="flex items-center gap-2 rounded bg-muted/20 p-2 text-xs">
                {career.team?.logo && <img src={career.team.logo} alt="" className="h-6 w-6 object-contain" />}
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{career.team?.acronym || career.team?.name || '-'}</p>
                  <p className="text-muted-foreground">{career.beginAt || '-'} - {career.endAt || '至今'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PlayerDetailPanel({ player, profile, isProfileLoading, onClose }: { player: Player; profile: ApiPlayerProfile | null; isProfileLoading: boolean; onClose: () => void }) {
  const trendData = [
    { name: 'KDA', value: player.kda },
    { name: 'KP', value: (player.killParticipation || 0) * 10 },
    { name: 'DPM', value: (player.avgDamage || 0) / 100 },
    { name: 'Vision', value: (player.avgVision || 0) / 10 },
    { name: 'MVP', value: player.mvpCount || 0 },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex items-start justify-between border-b border-border p-4">
        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="lg" />
          <div>
            <h2 className="text-xl font-bold text-foreground">{player.name}</h2>
            {player.realName && <p className="text-xs text-muted-foreground">{player.realName}</p>}
            <div className="mt-1 flex items-center gap-2">
              <TeamLogo player={player} />
              <span className="text-sm font-medium text-primary">{player.team}</span>
              <RoleIcon role={player.role} className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{roleNames[player.role]}</span>
            </div>
            {player.teamFullName && <p className="mt-1 text-xs text-muted-foreground">{player.teamFullName}</p>}
            {profile?.profileUrl && (
              <a
                href={profile.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                选手主页
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-4">
          <PlayerLinks player={player} />
          <PlayerProfileBlocks profile={profile} isLoading={isProfileLoading} />

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="KDA" value={formatNumber(player.kda, 2)} color="green" />
            <StatCard label="DPM" value={formatNumber(player.avgDamage, 0)} color="blue" />
            <StatCard label="GPM" value={formatNumber(player.goldPerMinute, 0)} color="yellow" />
            <StatCard label="参团率" value={formatRate(player.killParticipation)} color="default" />
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Trophy className="h-4 w-4 text-secondary" />
              赛季累计
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">击杀</p>
                <p className="font-bold text-foreground">{player.kills}</p>
              </div>
              <div className="rounded-md bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">助攻</p>
                <p className="font-bold text-foreground">{player.assists}</p>
              </div>
              <div className="rounded-md bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">死亡</p>
                <p className="font-bold text-foreground">{player.deaths}</p>
              </div>
              <div className="rounded-md bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">胜场</p>
                <p className="font-bold text-foreground">{player.wins || '-'}</p>
              </div>
              <div className="rounded-md bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">负场</p>
                <p className="font-bold text-foreground">{player.losses || '-'}</p>
              </div>
              <div className="rounded-md bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">胜率</p>
                <p className="font-bold text-foreground">{formatRate(player.winRate)}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              关键指标
            </h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <XAxis dataKey="name" tick={{ fill: '#8B8D91', fontSize: 12 }} axisLine={{ stroke: '#2A3041' }} />
                  <YAxis tick={{ fill: '#8B8D91', fontSize: 12 }} axisLine={{ stroke: '#2A3041' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F1422',
                      border: '1px solid #2A3041',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#E8E6E3' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#0BC4E3" strokeWidth={2} dot={{ fill: '#0BC4E3', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground">伤害占比</p>
              <p className="mt-1 font-semibold text-foreground">{formatRate(player.damageShare)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground">经济占比</p>
              <p className="mt-1 font-semibold text-foreground">{formatRate(player.goldShare)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground">分钟承伤</p>
              <p className="mt-1 font-semibold text-foreground">{formatNumber(player.avgDamageTaken, 0)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground">伤害/经济</p>
              <p className="mt-1 font-semibold text-foreground">{formatNumber(player.damagePerGold, 2)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground">场均补刀</p>
              <p className="mt-1 font-semibold text-foreground">{formatNumber(player.csPerGame, 1)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground">分钟补刀</p>
              <p className="mt-1 font-semibold text-foreground">{formatNumber(player.csPerMinute, 2)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground">插眼 / 排眼</p>
              <p className="mt-1 font-semibold text-foreground">{formatNumber(player.wardPlacedPerGame, 1)} / {formatNumber(player.wardKilledPerGame, 1)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground">一血 / 一塔</p>
              <p className="mt-1 font-semibold text-foreground">{formatNumber(player.firstBloodPerGame, 2)} / {formatNumber(player.firstTowerPerGame, 2)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground">MVP 积分</p>
              <p className="mt-1 font-semibold text-foreground">{formatNumber(player.mvpVotes, 1)}{player.opScoreGrade ? ` · ${player.opScoreGrade}` : ''}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground">场均经济</p>
              <p className="mt-1 font-semibold text-foreground">{formatNumber(player.goldPerGame, 0)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground">经济差</p>
              <p className="mt-1 font-semibold text-foreground">{formatNumber(player.goldGapPerGame, 0)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground">视野差</p>
              <p className="mt-1 font-semibold text-foreground">{formatNumber(player.visionScoreGapPerGame, 1)}</p>
            </div>
          </div>

          {player.championPool.length ? (
            <div>
              <h3 className="mb-3 text-sm font-medium text-foreground">常用英雄</h3>
              <div className="grid gap-2">
                {player.championPool.slice(0, 8).map((champion) => (
                  <div key={champion.champion} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {champion.imageUrl && <img src={champion.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{champion.champion}</p>
                        <p className="text-xs text-muted-foreground">{champion.games} 场 · KDA {formatNumber(champion.kda, 2)}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <p className="font-semibold text-emerald-400">{formatRate(champion.winRate)}</p>
                      <p className="text-muted-foreground">BP {formatRate(champion.bpRate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </motion.div>
  )
}

function PlayerDetailSheet({
  player,
  profile,
  isProfileLoading,
  onOpenChange,
}: {
  player: Player | null
  profile: ApiPlayerProfile | null
  isProfileLoading: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={Boolean(player)} onOpenChange={onOpenChange}>
      <SheetContent className="h-dvh max-h-dvh w-full overflow-hidden border-border bg-card p-0 sm:max-w-[42rem]">
        {player && <PlayerDetailPanel player={player} profile={profile} isProfileLoading={isProfileLoading} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [meta, setMeta] = useState<ApiProStatsResponse<ApiPlayer> | null>(null)
  const [leagueFilter, setLeagueFilter] = useState(DEFAULT_LEAGUE)
  const [leagueOptions, setLeagueOptions] = useState<ApiProLeague[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>('kda')
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<ApiPlayerProfile | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const deferredSearchQuery = useDeferredValue(searchQuery)

  useEffect(() => {
    let alive = true
    async function loadPlayers() {
      setIsLoading(true)
      setError(null)
      try {
        const payload = await fetchPlayerStats({ league: leagueFilter })
        if (!alive) return
        setMeta(payload)
        if (payload.leagues?.length) setLeagueOptions(payload.leagues)
        setPlayers(normalizePlayers(payload.data || []))
        setSelectedPlayer(null)
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : '选手数据加载失败')
      } finally {
        if (alive) setIsLoading(false)
      }
    }
    loadPlayers()
    return () => {
      alive = false
    }
  }, [leagueFilter])

  useEffect(() => {
    if (!selectedPlayer) {
      setSelectedProfile(null)
      setIsProfileLoading(false)
      return
    }

    const player = selectedPlayer
    let alive = true
    async function loadProfile() {
      setIsProfileLoading(true)
      try {
        const profile = await fetchPlayerDetail({
          playerId: player.opggPlayerId || player.id,
          nickName: player.name,
        })
        if (alive) setSelectedProfile(profile)
      } catch {
        if (alive) setSelectedProfile(null)
      } finally {
        if (alive) setIsProfileLoading(false)
      }
    }
    loadProfile()
    return () => {
      alive = false
    }
  }, [selectedPlayer])

  const filteredPlayers = useMemo(() => {
    const query = deferredSearchQuery.trim().toLocaleLowerCase()
    const result = players.filter((player) => {
      if (!query) return true
      return [player.name, player.team, roleNames[player.role]]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query)
    })
    return result.sort((a, b) => rankingValue(b, rankingMetric) - rankingValue(a, rankingMetric) || b.kda - a.kda)
  }, [deferredSearchQuery, players, rankingMetric])
  const displayLeagueOptions = useMemo(() => {
    const byShortName = new Map<string, ApiProLeague>()
    leagueOptions.forEach((league) => {
      if (league.shortName) byShortName.set(league.shortName, league)
    })
    if (!byShortName.has(leagueFilter)) {
      byShortName.set(leagueFilter, { shortName: leagueFilter, name: leagueFilter })
    }
    const sourceOrder = new Map(leagueOptions.map((league, index) => [league.shortName, index]))
    return Array.from(byShortName.values()).sort((a, b) => {
      if (a.shortName === DEFAULT_LEAGUE) return -1
      if (b.shortName === DEFAULT_LEAGUE) return 1
      return (sourceOrder.get(a.shortName) ?? Number.MAX_SAFE_INTEGER) -
        (sourceOrder.get(b.shortName) ?? Number.MAX_SAFE_INTEGER)
    })
  }, [leagueFilter, leagueOptions])

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)]">
      <div className="h-full">
        <div className="flex h-full flex-col">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h1 className="mb-2 font-serif text-3xl font-bold text-foreground">选手数据</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Database className="h-4 w-4" />
                {meta?.season?.name || `${leagueFilter} 最新赛事`}
              </span>
              <span>更新：{formatTimestamp(meta?.fetchedAt)}</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Select value={leagueFilter} onValueChange={setLeagueFilter}>
                <SelectTrigger className="w-full max-w-[34rem] sm:w-[30rem]">
                  <SelectValue placeholder="选择赛区" />
                </SelectTrigger>
                <SelectContent>
                  {displayLeagueOptions.map((league) => (
                    <SelectItem key={league.shortName} value={league.shortName}>
                      <LeagueOptionLabel league={league} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rankingMetric} onValueChange={(value) => setRankingMetric(value as RankingMetric)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="排行指标" />
                </SelectTrigger>
                <SelectContent>
                  {rankingMetrics.map((metric) => (
                    <SelectItem key={metric.key} value={metric.key}>{metric.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索选手、战队或位置..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
              />
            </div>
          </motion.div>

          {isLoading && (
            <Card className="flex flex-1 items-center justify-center gap-3 border-border text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              正在加载 {leagueFilter} 选手数据
            </Card>
          )}

          {!isLoading && error && (
            <Card className="flex flex-1 items-center justify-center gap-3 border-destructive/40 bg-destructive/10 p-6 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {error}
            </Card>
          )}

          {!isLoading && !error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex-1 overflow-hidden">
              <Card className="h-full border-border">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <div className="mb-3 hidden grid-cols-[4rem_minmax(220px,1fr)_120px_110px_110px_110px_120px] gap-3 px-3 text-xs text-muted-foreground lg:grid">
                      <span>排名</span>
                      <span>选手</span>
                      <span>位置</span>
                      <span>战队</span>
                      <span>KDA</span>
                      <span>胜率</span>
                      <span>{rankingMetrics.find((metric) => metric.key === rankingMetric)?.label}</span>
                    </div>
                    <div className="space-y-2">
                      {filteredPlayers.map((player, index) => (
                        <motion.button
                          key={player.id}
                          whileHover={{ scale: 1.006 }}
                          whileTap={{ scale: 0.996 }}
                          onClick={() => setSelectedPlayer(player)}
                          className={cn(
                            'grid w-full gap-3 rounded-md border p-3 text-left transition-all lg:grid-cols-[4rem_minmax(220px,1fr)_120px_110px_110px_110px_120px] lg:items-center',
                            selectedPlayer?.id === player.id
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-card/70 hover:border-muted-foreground'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground',
                              index < 3 && 'bg-secondary/20 text-secondary'
                            )}>
                              {index + 1}
                            </span>
                            <div className="lg:hidden">
                              <p className="text-xs text-muted-foreground">排名</p>
                              <p className="text-sm font-semibold text-foreground">{rankingDisplay(player, rankingMetric)}</p>
                            </div>
                          </div>
                          <div className="flex min-w-0 items-center gap-3">
                            <PlayerAvatar player={player} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">{player.name}</p>
                              {player.realName && <p className="truncate text-xs text-muted-foreground">{player.realName}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <RoleIcon role={player.role} className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{roleNames[player.role]}</span>
                          </div>
                          <div className="flex min-w-0 items-center gap-2">
                            <TeamLogo player={player} />
                            <span className="truncate text-sm text-foreground">{player.team}</span>
                          </div>
                          <p className="text-sm font-bold text-primary">{formatNumber(player.kda, 2)}</p>
                          <p className="text-sm font-semibold text-emerald-400">{formatRate(player.winRate)}</p>
                          <p className="hidden text-sm font-bold text-secondary lg:block">{rankingDisplay(player, rankingMetric)}</p>
                        </motion.button>
                      ))}
                    </div>
                    {!filteredPlayers.length && (
                      <div className="py-12 text-center text-muted-foreground">未找到匹配的选手</div>
                    )}
                  </div>
                </ScrollArea>
              </Card>
            </motion.div>
          )}
        </div>

      </div>

      <PlayerDetailSheet player={selectedPlayer} profile={selectedProfile} isProfileLoading={isProfileLoading} onOpenChange={(open) => {
        if (!open) setSelectedPlayer(null)
      }} />
    </div>
  )
}
