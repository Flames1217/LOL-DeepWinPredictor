'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  ExternalLink,
  Loader2,
  Shield,
  Sword,
  Target,
  Trophy,
} from 'lucide-react'
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchTeamDetail, fetchTeamStats, normalizeTeams, type ApiProLeague, type ApiProStatsResponse, type ApiTeam, type ApiTeamProfile } from '@/lib/api'
import type { Team } from '@/lib/types'

const DEFAULT_LEAGUE = 'LPL'

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

function formatRate(rate?: number, digits = 1) {
  return `${((rate || 0) * 100).toFixed(digits)}%`
}

function formatNumber(value?: number, digits = 1) {
  if (!Number.isFinite(value)) return '-'
  return Number(value).toFixed(digits)
}

function formatInteger(value?: number) {
  if (!Number.isFinite(value)) return '-'
  return Math.round(Number(value)).toLocaleString()
}

function formatGameTime(value?: string) {
  return value || '-'
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

function formatMatchTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TeamLogo({ team }: { team: Team }) {
  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {team.logo ? (
        <Image src={team.logo} alt={team.name} fill className="object-contain p-1" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-foreground">
          {team.name.slice(0, 1)}
        </span>
      )}
    </div>
  )
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

function TeamMatchList({
  title,
  matches,
}: {
  title: string
  matches?: Team['recentMatches']
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      {matches?.length ? (
        <div className="space-y-2">
          {matches.slice(0, 5).map((match) => (
            <div key={match.id || match.name} className="rounded-md border border-border bg-background/40 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{match.tournament?.name || match.status || '-'}</span>
                <span>{formatMatchTime(match.scheduledAt || match.beginAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {match.homeTeam?.logo && <img src={match.homeTeam.logo} alt="" className="h-6 w-6 shrink-0 object-contain" />}
                  <span className={cn(
                    'truncate text-sm font-medium',
                    match.winnerTeam?.id && String(match.winnerTeam.id) === String(match.homeTeam?.id) && 'text-primary'
                  )}>
                    {match.homeTeam?.acronym || match.homeTeam?.name}
                  </span>
                </div>
                <span className="shrink-0 rounded bg-muted/40 px-2 py-1 text-sm font-semibold text-foreground">
                  {match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null
                    ? `${match.homeScore} - ${match.awayScore}`
                    : 'vs'}
                </span>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <span className={cn(
                    'truncate text-right text-sm font-medium',
                    match.winnerTeam?.id && String(match.winnerTeam.id) === String(match.awayTeam?.id) && 'text-primary'
                  )}>
                    {match.awayTeam?.acronym || match.awayTeam?.name}
                  </span>
                  {match.awayTeam?.logo && <img src={match.awayTeam.logo} alt="" className="h-6 w-6 shrink-0 object-contain" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">暂无比赛记录</p>
      )}
    </div>
  )
}

function TeamRoster({ team }: { team: Team }) {
  if (!team.roster?.length) return null
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">当前阵容</h4>
      <div className="grid gap-2 md:grid-cols-2">
        {team.roster.map((player) => (
          <div key={String(player.playerId || player.playerName)} className="rounded-md border border-border bg-background/40 p-3">
            <div className="flex items-center gap-3">
              {player.playerAvatar && <img src={player.playerAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{player.playerName}</p>
                <p className="text-xs text-muted-foreground">{player.playerLocation || '-'} · KDA {formatNumber(player.kda, 2)} · {formatRate(player.winRate)}</p>
              </div>
            </div>
            {player.championPool?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {player.championPool.slice(0, 3).map((champion) => (
                  <span key={String(champion.heroId || champion.heroName)} className="inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-1 text-xs">
                    {champion.heroLogo && <img src={champion.heroLogo} alt="" className="h-4 w-4 rounded-full" />}
                    {champion.heroCnName || champion.heroName}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function LeagueHeroStats({ team }: { team: Team }) {
  if (!team.leagueHeroStats?.length) return null
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">赛区热门英雄</h4>
      <div className="grid gap-2 md:grid-cols-2">
        {team.leagueHeroStats.slice(0, 8).map((champion) => (
          <div key={String(champion.heroId || champion.heroName)} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-2">
            <div className="flex min-w-0 items-center gap-2">
              {champion.heroLogo && <img src={champion.heroLogo} alt="" className="h-7 w-7 rounded-full object-cover" />}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{champion.heroCnName || champion.heroName}</p>
                <p className="text-xs text-muted-foreground">{champion.mostUsePlayerName || '-'}</p>
              </div>
            </div>
            <div className="shrink-0 text-right text-xs">
              <p className="font-semibold text-emerald-400">{formatRate(champion.winRate)}</p>
              <p className="text-muted-foreground">BP {formatNumber((champion.bpRate || 0) * 100, 1)}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamProfileBlocks({ profile, isLoading }: { profile?: ApiTeamProfile; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-md border border-border p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Loading OP.GG team profile
      </div>
    )
  }
  if (!profile) return null

  const socials = Object.entries(profile.socials || {}).filter(([, href]) => Boolean(href)) as [string, string][]
  const won = [...(profile.wonSeries || []), ...(profile.formerWonSeries || [])]

  return (
    <div className="mt-6 space-y-3">
      <h4 className="text-sm font-medium text-foreground">OP.GG profile</h4>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-background/40 p-3">
          <p className="text-xs text-muted-foreground">Name</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{profile.name || profile.acronym || '-'}</p>
        </div>
        <div className="rounded-md border border-border bg-background/40 p-3">
          <p className="text-xs text-muted-foreground">League</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{profile.currentLeague?.shortName || profile.currentLeague?.name || '-'}</p>
        </div>
        <div className="rounded-md border border-border bg-background/40 p-3">
          <p className="text-xs text-muted-foreground">Nationality</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{profile.nationality || '-'}</p>
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
      <div className="grid gap-3 lg:grid-cols-2">
        {profile.series?.length ? (
          <div className="rounded-md border border-border bg-background/40 p-3">
            <p className="mb-2 text-sm font-medium text-foreground">Recent series</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              {profile.series.slice(0, 8).map((series) => (
                <p key={String(series.id || series.name)} className="truncate">{series.name || '-'} {series.year ? `· ${series.year}` : ''}</p>
              ))}
            </div>
          </div>
        ) : null}
        {won.length ? (
          <div className="rounded-md border border-border bg-background/40 p-3">
            <p className="mb-2 text-sm font-medium text-foreground">Won series</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              {won.slice(0, 8).map((series) => (
                <p key={String(series.id || series.name)} className="truncate">{series.name || '-'} {series.year ? `· ${series.year}` : ''}</p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TeamDetailPanel({ team, profile, isProfileLoading }: { team: Team; profile?: ApiTeamProfile; isProfileLoading?: boolean }) {
  const tags = [
    team.avgKills !== undefined && team.avgKills >= 14 ? '进攻节奏' : undefined,
    team.dragonRate !== undefined && team.dragonRate >= 0.55 ? '小龙控制' : undefined,
    team.baronRate !== undefined && team.baronRate >= 0.55 ? '大龙压制' : undefined,
    team.avgTowers !== undefined && team.avgTowers >= 6 ? '推塔稳定' : undefined,
  ].filter(Boolean)

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="border-t border-border bg-muted/20 p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">比赛数据</h4>
            <MetricRow icon={<Clock className="h-4 w-4" />} label="平均时长" value={formatGameTime(team.avgGameTime)} />
            <MetricRow icon={<Sword className="h-4 w-4" />} label="场均击杀" value={formatNumber(team.avgKills, 2)} />
            <MetricRow icon={<Target className="h-4 w-4" />} label="场均助攻" value={formatNumber(team.avgAssists, 2)} />
            <MetricRow icon={<Database className="h-4 w-4" />} label="团队 KDA" value={formatNumber(team.kda, 2)} />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">资源控制</h4>
            <MetricRow icon={<Shield className="h-4 w-4" />} label="小龙控制" value={formatRate(team.dragonRate)} />
            <MetricRow icon={<Trophy className="h-4 w-4" />} label="大龙控制" value={formatRate(team.baronRate)} />
            <MetricRow icon={<Target className="h-4 w-4" />} label="场均推塔" value={formatNumber(team.avgTowers, 2)} />
            <MetricRow icon={<Sword className="h-4 w-4" />} label="一血率" value={formatRate(team.firstBloodRate)} />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">经济视野</h4>
            <MetricRow icon={<Database className="h-4 w-4" />} label="场均经济" value={formatInteger(team.avgGold)} />
            <MetricRow icon={<Sword className="h-4 w-4" />} label="分钟伤害" value={formatInteger(team.avgDamage)} />
            <MetricRow icon={<Shield className="h-4 w-4" />} label="分钟承伤" value={formatInteger(team.avgDamageTaken)} />
            <MetricRow icon={<Target className="h-4 w-4" />} label="插/排眼" value={`${formatNumber(team.avgWardsPlaced, 1)} / ${formatNumber(team.avgWardsKilled, 1)}`} />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">战队画像</h4>
            <MetricRow icon={<Trophy className="h-4 w-4" />} label="积分" value={formatInteger(team.points)} />
            <MetricRow icon={<Database className="h-4 w-4" />} label="BO 胜率" value={formatRate(team.matchWinRate)} />
            <MetricRow icon={<Clock className="h-4 w-4" />} label="已赛/待赛" value={`${formatInteger(team.finishedMatches)} / ${formatInteger(team.scheduledMatches)}`} />
            <div className="flex flex-wrap gap-2">
              {tags.length ? (
                tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">等待更多比赛样本</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <TeamMatchList title="近期比赛" matches={team.recentMatches} />
          <TeamMatchList title="后续赛程" matches={team.upcomingMatches} />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <TeamRoster team={team} />
          <LeagueHeroStats team={team} />
        </div>
        <TeamProfileBlocks profile={profile} isLoading={isProfileLoading} />
      </div>
    </motion.div>
  )
}

function TeamCompare({ teamA, teamB }: { teamA: Team | null; teamB: Team | null }) {
  const radarData = useMemo(() => {
    if (!teamA || !teamB) return []
    return [
      { subject: '击杀', [teamA.name]: ((teamA.avgKills || 0) / 20) * 100, [teamB.name]: ((teamB.avgKills || 0) / 20) * 100 },
      { subject: '推塔', [teamA.name]: ((teamA.avgTowers || 0) / 12) * 100, [teamB.name]: ((teamB.avgTowers || 0) / 12) * 100 },
      { subject: '小龙', [teamA.name]: (teamA.dragonRate || 0) * 100, [teamB.name]: (teamB.dragonRate || 0) * 100 },
      { subject: '大龙', [teamA.name]: (teamA.baronRate || 0) * 100, [teamB.name]: (teamB.baronRate || 0) * 100 },
      { subject: '胜率', [teamA.name]: teamA.winRate * 100, [teamB.name]: teamB.winRate * 100 },
      { subject: '经济', [teamA.name]: Math.min(((teamA.totalKills || 0) / 500) * 100, 100), [teamB.name]: Math.min(((teamB.totalKills || 0) / 500) * 100, 100) },
    ]
  }, [teamA, teamB])

  if (!teamA || !teamB) {
    return <div className="py-12 text-center text-muted-foreground">选择两支战队进行对比</div>
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData}>
          <PolarGrid stroke="#2A3041" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#8B8D91', fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar name={teamA.name} dataKey={teamA.name} stroke="#0BC4E3" fill="#0BC4E3" fillOpacity={0.3} />
          <Radar name={teamB.name} dataKey={teamB.name} stroke="#E84057" fill="#E84057" fillOpacity={0.3} />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [meta, setMeta] = useState<ApiProStatsResponse<ApiTeam> | null>(null)
  const [leagueFilter, setLeagueFilter] = useState(DEFAULT_LEAGUE)
  const [leagueOptions, setLeagueOptions] = useState<ApiProLeague[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [teamProfiles, setTeamProfiles] = useState<Record<number, ApiTeamProfile | null>>({})
  const [profileLoadingId, setProfileLoadingId] = useState<number | null>(null)
  const [compareTeamA, setCompareTeamA] = useState<string>('')
  const [compareTeamB, setCompareTeamB] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function loadTeams() {
      setIsLoading(true)
      setError(null)
      try {
        const payload = await fetchTeamStats({ league: leagueFilter })
        if (!alive) return
        setMeta(payload)
        if (payload.leagues?.length) setLeagueOptions(payload.leagues)
        setTeams(normalizeTeams(payload.data || []))
        setExpandedId(null)
        setTeamProfiles({})
        setCompareTeamA('')
        setCompareTeamB('')
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : '战队数据加载失败')
      } finally {
        if (alive) setIsLoading(false)
      }
    }
    loadTeams()
    return () => {
      alive = false
    }
  }, [leagueFilter])

  useEffect(() => {
    const teamId = expandedId
    if (!teamId || teamProfiles[teamId]) return
    const team = teams.find((item) => item.id === teamId)
    if (!team) return

    const profileKey = teamId
    const selectedTeam = team
    let alive = true
    async function loadProfile() {
      setProfileLoadingId(profileKey)
      try {
        const profile = await fetchTeamDetail({
          teamId: selectedTeam.opggTeamId || selectedTeam.id,
          acronym: selectedTeam.acronym || selectedTeam.name,
        })
        if (alive) {
          setTeamProfiles((current) => ({ ...current, [profileKey]: profile }))
        }
      } catch {
        if (alive) {
          setTeamProfiles((current) => ({ ...current, [profileKey]: null }))
        }
      } finally {
        if (alive) setProfileLoadingId(null)
      }
    }
    loadProfile()
    return () => {
      alive = false
    }
  }, [expandedId, teamProfiles, teams])

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || a.losses - b.losses),
    [teams]
  )
  const teamA = useMemo(() => teams.find((team) => team.name === compareTeamA) || null, [compareTeamA, teams])
  const teamB = useMemo(() => teams.find((team) => team.name === compareTeamB) || null, [compareTeamB, teams])
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
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mb-2 font-serif text-3xl font-bold text-foreground">战队数据</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Database className="h-4 w-4" />
            {meta?.season?.name || `${leagueFilter} 最新赛事`}
          </span>
          <span className="inline-flex items-center gap-2">
            <Shield className="h-4 w-4" />
            同步：{formatTimestamp(meta?.fetchedAt)}
          </span>
        </div>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
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
      </div>

      {isLoading && (
        <Card className="flex items-center justify-center gap-3 border-border p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          正在同步 {leagueFilter} 战队数据
        </Card>
      )}

      {!isLoading && error && (
        <Card className="flex items-center gap-3 border-destructive/40 bg-destructive/10 p-6 text-destructive">
          <AlertCircle className="h-5 w-5" />
          {error}
        </Card>
      )}

      {!isLoading && !error && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <Card className="overflow-hidden border-border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="w-16 p-4 text-left text-sm font-medium text-muted-foreground">排名</th>
                      <th className="p-4 text-left text-sm font-medium text-muted-foreground">战队</th>
                      <th className="p-4 text-center text-sm font-medium text-muted-foreground">小局</th>
                      <th className="p-4 text-center text-sm font-medium text-muted-foreground">胜</th>
                      <th className="p-4 text-center text-sm font-medium text-muted-foreground">负</th>
                      <th className="p-4 text-center text-sm font-medium text-muted-foreground">胜率</th>
                      <th className="p-4 text-center text-sm font-medium text-muted-foreground">场均击杀</th>
                      <th className="p-4 text-center text-sm font-medium text-muted-foreground">KDA</th>
                      <th className="p-4 text-center text-sm font-medium text-muted-foreground">场均经济</th>
                      <th className="w-10 p-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeams.map((team, index) => (
                      <AnimatePresence key={team.id} initial={false}>
                        <tr
                          className="cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
                          onClick={() => setExpandedId(expandedId === team.id ? null : team.id)}
                        >
                          <td className="p-4">
                            <span
                              className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                                index === 0
                                  ? 'border border-secondary/30 bg-secondary/20 text-secondary'
                                  : index === 1
                                    ? 'border border-gray-300/30 bg-gray-300/20 text-gray-300'
                                    : index === 2
                                      ? 'border border-amber-700/30 bg-amber-700/20 text-amber-500'
                                      : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {index + 1}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <TeamLogo team={team} />
                              <div>
                                <p className="font-medium text-foreground">{team.name}</p>
                                <p className="text-xs text-muted-foreground">{team.fullName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center text-foreground">{team.wins + team.losses}</td>
                          <td className="p-4 text-center font-medium text-[#00D563]">{team.wins}</td>
                          <td className="p-4 text-center font-medium text-[#FF4D4D]">{team.losses}</td>
                          <td className="p-4 text-center">
                            <span className={cn('font-bold', team.winRate >= 0.6 ? 'text-[#00D563]' : team.winRate >= 0.5 ? 'text-[#F0C93A]' : 'text-[#FF4D4D]')}>
                              {formatRate(team.winRate)}
                            </span>
                          </td>
                          <td className="p-4 text-center text-foreground">{formatNumber(team.avgKills, 2)}</td>
                          <td className="p-4 text-center text-foreground">{formatNumber(team.kda, 2)}</td>
                          <td className="p-4 text-center text-foreground">{formatInteger(team.avgGold)}</td>
                          <td className="p-4">
                            {expandedId === team.id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </td>
                        </tr>
                        {expandedId === team.id && (
                          <tr>
                            <td colSpan={10} className="p-0">
                              <TeamDetailPanel
                                team={team}
                                profile={teamProfiles[team.id] || undefined}
                                isProfileLoading={profileLoadingId === team.id}
                              />
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-border p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">战队对比</h3>
              <div className="flex flex-col gap-6 lg:flex-row">
                <div className="flex gap-4 lg:w-72 lg:flex-col">
                  <Select value={compareTeamA} onValueChange={setCompareTeamA}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择战队 A" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedTeams.map((team) => (
                        <SelectItem key={team.id} value={team.name} disabled={team.name === compareTeamB}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={compareTeamB} onValueChange={setCompareTeamB}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择战队 B" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedTeams.map((team) => (
                        <SelectItem key={team.id} value={team.name} disabled={team.name === compareTeamA}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <TeamCompare teamA={teamA} teamB={teamB} />
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  )
}
