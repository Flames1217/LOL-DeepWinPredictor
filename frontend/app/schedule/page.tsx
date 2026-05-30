'use client'

import { memo, useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { format, isAfter, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Coins, Crosshair, ExternalLink, Eye, Loader2, RefreshCw, Sparkles, Sword, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  fetchProLeagues,
  fetchProMatchDetail,
  fetchProSchedule,
  predictProGame,
  predictProMatch,
  type ApiMatchPrediction,
  type ApiProLeague,
  type ApiProScheduleMatch,
  type ApiScheduleTeam,
} from '@/lib/api'

const DEFAULT_LEAGUE = 'LPL'
const INITIAL_VISIBLE_MATCHES = 36
const LPL_STAT_ICONS = {
  dragon: 'https://ossweb-img.qq.com/images/lpl/web201612/data-ico1.png',
  baron: 'https://ossweb-img.qq.com/images/lpl/web201612/data-ico2.png',
  tower: 'https://ossweb-img.qq.com/images/lpl/web201612/data-ico3.png',
  gold: 'https://ossweb-img.qq.com/images/lpl/web201612/data-ico4.png',
}

type AnyRecord = Record<string, unknown>

function todayKey() {
  return format(new Date(), 'yyyy-MM-dd')
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}
}

function asArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') as AnyRecord[] : []
}

function fmt(value: unknown, fallback = '-') {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1)
  return String(value)
}

function fmtRate(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${(number * 100).toFixed(1)}%`
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = parseISO(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function matchTime(match: ApiProScheduleMatch) {
  return match.time || match.scheduledAt || match.beginAt || null
}

function dateKey(value?: string | null) {
  const date = parseDate(value)
  return date ? format(date, 'yyyy-MM-dd') : 'unknown'
}

function nearestDateKey(matches: ApiProScheduleMatch[]) {
  const dates = Array.from(new Set(matches.map((match) => dateKey(matchTime(match))).filter((item) => item !== 'unknown'))).sort()
  if (!dates.length) return todayKey()
  const today = todayKey()
  return dates.find((date) => date >= today) || dates[dates.length - 1]
}

function displayClock(value?: string | null) {
  const date = parseDate(value)
  return date ? format(date, 'HH:mm:ss', { locale: zhCN }) : (value || '-')
}

function displayMonthDay(value?: string | null) {
  const date = parseDate(value)
  return date ? format(date, 'MM-dd', { locale: zhCN }) : '--'
}

function displayDate(value?: string | null) {
  const date = parseDate(value)
  return date ? format(date, 'M月d日 EEEE', { locale: zhCN }) : '未定日期'
}

function isFutureMatch(match: ApiProScheduleMatch, now = new Date()) {
  const status = String(match.status || '').toLowerCase()
  if (status === 'finished') return false
  const date = parseDate(matchTime(match))
  return date ? isAfter(date, now) : status !== 'finished'
}

function isFinishedMatch(match: ApiProScheduleMatch, now = new Date()) {
  const status = String(match.status || '').toLowerCase()
  const hasScore = match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null
  return status === 'finished' || (hasScore && !isFutureMatch(match, now))
}

function matchStatusLabel(match: ApiProScheduleMatch, now = new Date()) {
  const status = String(match.status || '').toLowerCase()
  if (status === 'finished') return '已结束'
  if (status.includes('running') || status.includes('live')) return '进行中'
  return isFutureMatch(match, now) ? '未开赛' : (match.statusLabel || '待确认')
}

function countdownText(match: ApiProScheduleMatch, now: Date) {
  const date = parseDate(matchTime(match))
  if (!date) return '-'
  const diff = date.getTime() - now.getTime()
  if (diff <= 0) return String(match.status || '').toLowerCase() === 'finished' ? '已结束' : '开赛中'
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const body = [hours, minutes, seconds].map((item) => String(item).padStart(2, '0')).join(':')
  return days > 0 ? `${days}天 ${body}` : body
}

const CountdownText = memo(function CountdownText({ match }: { match: ApiProScheduleMatch }) {
  const [now, setNow] = useState(() => new Date())
  const future = isFutureMatch(match, now)

  useEffect(() => {
    if (!future) return undefined
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [future])

  return (
    <p className={cn('mt-2 font-mono text-lg font-bold', future ? 'text-primary' : 'text-muted-foreground')}>
      {countdownText(match, now)}
    </p>
  )
})

function leagueIcon(league?: ApiProLeague | null) {
  return league?.shortName ? `/opgg_league_icon/${encodeURIComponent(league.shortName)}` : '/opgg_esports_favicon.ico'
}

function teamLabel(team?: ApiScheduleTeam) {
  return team?.acronym || team?.name || 'TBD'
}

function championAsset(heroId: unknown, alias?: unknown) {
  return `/lol_champion_icon/${encodeURIComponent(String(heroId || alias || 'unknown'))}.png?v=3`
}

function itemAsset(itemId: unknown) {
  return `https://game.gtimg.cn/images/lol/act/img/item/${encodeURIComponent(String(itemId))}.png`
}

function spellAsset(iconKey: unknown, spellId: unknown) {
  return `/lol_spell_icon/${encodeURIComponent(String(iconKey || spellId || 'unknown'))}.png?v=3`
}

function runeAsset(runeId: unknown) {
  return `/lol_rune_icon/${encodeURIComponent(String(runeId))}.png?v=3`
}

function AssetIcon({ src, label, className }: { src: string; label?: string; className?: string }) {
  return (
    <img
      src={src}
      alt={label || ''}
      title={label}
      loading="lazy"
      className={cn('h-7 w-7 shrink-0 rounded border border-border bg-muted object-cover', className)}
      onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
    />
  )
}

function LplIcon({ src }: { src: string }) {
  return <img src={src} alt="" className="h-4 w-4 shrink-0 object-contain" loading="lazy" />
}

function Metric({ label, value, icon, className }: { label: string; value: unknown; icon?: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}>
      {icon}
      <span>{label}</span>
      <strong className="font-semibold text-foreground">{fmt(value)}</strong>
    </span>
  )
}

function TeamLogo({ team, winner, align = 'left' }: { team?: ApiScheduleTeam; winner?: boolean; align?: 'left' | 'right' }) {
  const label = teamLabel(team)
  return (
    <div className={cn('flex min-w-0 items-center gap-2', align === 'right' && 'flex-row-reverse text-right')}>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted', winner ? 'border-primary/60' : 'border-border')}>
        {team?.logo ? <img src={team.logo} alt="" className="h-full w-full object-contain p-1" loading="lazy" /> : <span className="text-xs font-bold">{label.slice(0, 2)}</span>}
      </div>
      <div className="min-w-0">
        <p className={cn('truncate text-sm font-semibold', winner && 'text-primary')}>{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{team?.name || '-'}</p>
      </div>
    </div>
  )
}

function PredictionBlock({ prediction, home, away, match }: { prediction?: ApiMatchPrediction; home: string; away: string; match: ApiProScheduleMatch }) {
  if (!prediction) return null
  const homeRate = Math.max(0, Math.min(100, prediction.A_win))
  const finished = isFinishedMatch(match)
  const predictedHomeWin = prediction.A_win >= prediction.B_win
  const actualHomeWin = match.winnerTeam?.id
    ? String(match.winnerTeam.id) === String(match.homeTeam?.id)
    : Number(match.homeScore) > Number(match.awayScore)
  const checked = finished && Number.isFinite(Number(match.homeScore)) && Number.isFinite(Number(match.awayScore))
  const hit = checked ? predictedHomeWin === actualHomeWin : undefined
  return (
    <div className="mt-3 rounded-md border border-primary/25 bg-primary/10 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-primary">{home} {prediction.A_win.toFixed(1)}%</span>
          <span className="text-muted-foreground">{away} {prediction.B_win.toFixed(1)}%</span>
        </div>
        {checked ? (
          <Badge className={cn(hit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-destructive/20 text-destructive')}>
            赛后回测 · {hit ? '命中' : '未命中'}
          </Badge>
        ) : (
          <Badge variant="outline">赛前预测</Badge>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(5, Math.min(95, homeRate))}%` }} />
      </div>
      {checked && !hit ? (
        <p className="mt-2 text-xs text-muted-foreground">
          实际赛果：{actualHomeWin ? home : away} 获胜。该结果用于回测模型，不会反向改写赛前预测概率。
        </p>
      ) : null}
    </div>
  )
}

function GamePredictionBlock({ prediction, teams }: { prediction?: ApiMatchPrediction; teams: AnyRecord[] }) {
  if (!prediction) return null
  const blueName = fmt(teams[0]?.teamSide || '蓝方')
  const redName = fmt(teams[1]?.teamSide || '红方')
  const draftRate = Math.max(0, Math.min(100, prediction.A_win))
  const liveRate = prediction.liveAdjustedAWin
  const hit = prediction.backtest?.liveAdjustedHit ?? prediction.backtest?.draftHit

  return (
    <div className="rounded-md border border-primary/30 bg-primary/10 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-primary">小局 BP {blueName} {prediction.A_win.toFixed(1)}%</span>
          <span className="text-muted-foreground">{redName} {prediction.B_win.toFixed(1)}%</span>
          {typeof liveRate === 'number' ? <span className="font-semibold text-secondary">局内校正 {liveRate.toFixed(1)}%</span> : null}
        </div>
        {prediction.backtest ? (
          <Badge className={cn(hit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-destructive/20 text-destructive')}>
            小局回测 · {hit ? '命中' : '未命中'}
          </Badge>
        ) : <Badge variant="outline">小局预测</Badge>}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(5, Math.min(95, draftRate))}%` }} />
      </div>
      {typeof liveRate === 'number' ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
          <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${Math.max(5, Math.min(95, liveRate))}%` }} />
        </div>
      ) : null}
    </div>
  )
}

function teamFromDetail(match: ApiProScheduleMatch, teamId: unknown) {
  const id = String(teamId || '')
  return [match.homeTeam, match.awayTeam].find((team) => team && String(team.id) === id)
}

const PlayerRow = memo(function PlayerRow({ player }: { player: AnyRecord }) {
  const battle = asRecord(player.battleDetail)
  const damage = asRecord(player.damageDetail)
  const vision = asRecord(player.visionDetail)
  const other = asRecord(player.otherDetail)
  const runes = asArray(player.perkRunes)
  const items = asArray(player.items)
  const trinket = asRecord(player.trinketItem)
  const avatar = String(player.playerAvatar || '')
  const coreRunes = runes.slice(0, 6)
  const shardRunes = runes.slice(6, 9)

  return (
    <div className="grid gap-3 rounded-md border border-border bg-background/55 p-3 text-xs xl:grid-cols-[minmax(230px,1.25fr)_90px_minmax(220px,1fr)_minmax(245px,1fr)_190px] xl:items-center">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span>{fmt(player.playerName).slice(0, 1)}</span>}
        </div>
        <AssetIcon src={championAsset(player.heroId, player.heroNameEn)} label={fmt(player.heroName)} className="h-9 w-9 rounded-md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{fmt(player.playerName)}</p>
          <p className="truncate text-muted-foreground">{fmt(player.heroName)} · {fmt(player.role || player.playerLocation)}</p>
        </div>
      </div>

      <div className="font-semibold text-primary">
        {fmt(battle.kills)}/{fmt(battle.death)}/{fmt(battle.assist)}
        {other.mvp ? <Badge className="ml-2 bg-primary text-primary-foreground">MVP</Badge> : null}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <AssetIcon src={spellAsset(player.spell1IconKey, player.spell1Id)} label={fmt(player.spell1Name)} />
        <AssetIcon src={spellAsset(player.spell2IconKey, player.spell2Id)} label={fmt(player.spell2Name)} />
        {items.map((item) => item.itemId ? <AssetIcon key={String(item.itemId)} src={itemAsset(item.itemId)} label={fmt(item.itemName)} /> : null)}
        {trinket.itemId ? <AssetIcon src={itemAsset(trinket.itemId)} label={fmt(trinket.itemName)} /> : null}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {coreRunes.map((rune) => rune.runeId ? <AssetIcon key={String(rune.runeId)} src={runeAsset(rune.runeId)} label={fmt(rune.runeName)} /> : null)}
        <span className="mx-1 h-5 w-px bg-border" />
        {shardRunes.map((rune) => rune.runeId ? <AssetIcon key={String(rune.runeId)} src={runeAsset(rune.runeId)} label={fmt(rune.runeName)} className="h-6 w-6 opacity-90" /> : null)}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
        <Metric label="伤害" value={damage.heroDamage} icon={<Sword className="h-3.5 w-3.5 text-primary" />} />
        <Metric label="经济" value={other.golds} icon={<Coins className="h-3.5 w-3.5 text-amber-400" />} />
        <Metric label="补刀" value={other.creepsKilled} icon={<Crosshair className="h-3.5 w-3.5 text-muted-foreground" />} />
        <Metric label="视野" value={vision.visionScore} icon={<Eye className="h-3.5 w-3.5 text-sky-400" />} />
        <span>参团 {fmtRate(battle.attendWarRate)}</span>
        <span>DPM {fmt(damage.damagePerMinute)}</span>
      </div>
    </div>
  )
})

const TeamGamePanel = memo(function TeamGamePanel({ team, match, winner }: { team: AnyRecord; match: ApiProScheduleMatch; winner: boolean }) {
  const players = asArray(team.playerInfos)
  const bans = Array.isArray(team.banHeroList) ? team.banHeroList : []
  const scheduleTeam = teamFromDetail(match, team.teamId)

  return (
    <div className={cn('rounded-md border bg-card/60 p-3', winner ? 'border-primary/50' : 'border-border')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <TeamLogo team={scheduleTeam} winner={winner} />
        <div className="flex flex-wrap items-center gap-3">
          <Metric label="经济" value={team.golds} icon={<LplIcon src={LPL_STAT_ICONS.gold} />} />
          <Metric label="小龙" value={team.dragonAmount} icon={<LplIcon src={LPL_STAT_ICONS.dragon} />} />
          <Metric label="大龙" value={team.baronAmount} icon={<LplIcon src={LPL_STAT_ICONS.baron} />} />
          <Metric label="防御塔" value={team.turretAmount} icon={<LplIcon src={LPL_STAT_ICONS.tower} />} />
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-muted-foreground">Ban</span>
        {bans.length ? bans.map((heroId) => <AssetIcon key={String(heroId)} src={championAsset(heroId)} />) : <span className="text-xs text-muted-foreground">-</span>}
      </div>
      <div className="space-y-2">
        {players.map((player) => <PlayerRow key={String(player.playerId || player.playerName)} player={player} />)}
      </div>
    </div>
  )
})

function KillScore({ teams }: { teams: AnyRecord[] }) {
  const left = teams[0]
  const right = teams[1]
  if (!left || !right) return null
  return (
    <div className="flex items-center justify-center gap-5 rounded-md border border-border bg-background/45 px-4 py-3">
      <div className="text-right">
        <p className="text-xs text-muted-foreground">蓝方击杀</p>
        <p className="text-3xl font-bold text-primary">{fmt(left.kills)}</p>
      </div>
      <Sword className="h-5 w-5 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">红方击杀</p>
        <p className="text-3xl font-bold text-destructive">{fmt(right.kills)}</p>
      </div>
    </div>
  )
}

function OpggMatchDetail({ detail }: { detail: AnyRecord | null }) {
  if (!detail) return <p className="py-4 text-sm text-muted-foreground">暂无详情</p>
  const home = asRecord(detail.homeTeam)
  const away = asRecord(detail.awayTeam)
  const tournament = asRecord(detail.tournament)
  const streams = asArray(detail.streams)
  const videos = asArray(detail.videos)
  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
      <div className="rounded-md border border-border bg-background/45 p-4">
        <p className="mb-3 text-sm font-semibold">比赛概览</p>
        <div className="grid items-center gap-4 md:grid-cols-[1fr_110px_1fr]">
          <TeamLogo team={home as ApiScheduleTeam} />
          <div className="rounded-md border border-border bg-card px-4 py-2 text-center text-2xl font-bold">
            {fmt(detail.homeScore)} : {fmt(detail.awayScore)}
          </div>
          <TeamLogo team={away as ApiScheduleTeam} align="right" />
        </div>
        <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <span>赛事：{fmt(tournament.name)}</span>
          <span>开始：{fmt(detail.beginAt || detail.scheduledAt)}</span>
          <span>状态：{fmt(detail.status)}</span>
          <span>胜方：{fmt(asRecord(detail.winnerTeam).acronym || asRecord(detail.winnerTeam).name)}</span>
        </div>
      </div>
      <div className="rounded-md border border-border bg-background/45 p-4">
        <p className="mb-3 text-sm font-semibold">直播与回放</p>
        <div className="space-y-2">
          {[...streams, ...videos].slice(0, 6).map((item, index) => {
            const url = String(item.rawUrl || item.embedUrl || item.url || '')
            return url ? (
              <Button key={`${url}-${index}`} size="sm" variant="outline" asChild>
                <a href={url} target="_blank" rel="noreferrer">打开链接 <ExternalLink className="ml-1 h-3.5 w-3.5" /></a>
              </Button>
            ) : null
          })}
          {!streams.length && !videos.length ? <p className="text-sm text-muted-foreground">暂无直播或回放链接</p> : null}
        </div>
      </div>
    </div>
  )
}

function LplGameDetail({ detail, match }: { detail: AnyRecord | null; match: ApiProScheduleMatch }) {
  const games = asArray(detail?.games)
  const [activeIndex, setActiveIndex] = useState(0)
  const [gamePrediction, setGamePrediction] = useState<ApiMatchPrediction | undefined>()
  const [gamePredicting, setGamePredicting] = useState(false)
  const [gamePredictionError, setGamePredictionError] = useState('')

  useEffect(() => {
    setActiveIndex(0)
    setGamePrediction(undefined)
    setGamePredictionError('')
  }, [detail])

  if (!games.length) return <OpggMatchDetail detail={detail} />

  const activeGame = games[Math.min(activeIndex, games.length - 1)] || games[0]
  const teams = asArray(activeGame.teamInfos)

  async function runGamePrediction() {
    setGamePredicting(true)
    setGamePredictionError('')
    try {
      setGamePrediction(await predictProGame({ league: 'LPL', matchId: match.id, gameIndex: activeIndex, game: activeGame }))
    } catch (error) {
      setGamePredictionError(error instanceof Error ? error.message : '小局预测失败')
    } finally {
      setGamePredicting(false)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {games.map((game, index) => (
            <Button key={String(game.bo || index)} size="sm" variant={index === activeIndex ? 'default' : 'outline'} onClick={() => {
              setActiveIndex(index)
              setGamePrediction(undefined)
              setGamePredictionError('')
            }}>
              第 {fmt(game.bo || index + 1)} 局
            </Button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          {displayClock(String(activeGame.matchStartTime || ''))}
          {activeGame.gameTime ? <span className="ml-3">时长 {fmt(activeGame.gameTime)}</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={runGamePrediction} disabled={gamePredicting || teams.length < 2}>
          {gamePredicting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
          {gamePrediction ? '重新小局回测' : '小局预测/回测'}
        </Button>
        {gamePredictionError ? <span className="text-xs text-destructive">{gamePredictionError}</span> : null}
      </div>

      <GamePredictionBlock prediction={gamePrediction} teams={teams} />
      <KillScore teams={teams} />
      <div className="grid gap-3">
        {teams.map((team) => (
          <TeamGamePanel key={String(team.teamId)} team={team} match={match} winner={String(activeGame.matchWin || '') === String(team.teamId || '')} />
        ))}
      </div>
    </div>
  )
}

const MatchCard = memo(function MatchCard({ match, leagueKey }: { match: ApiProScheduleMatch; leagueKey: string }) {
  const [prediction, setPrediction] = useState<ApiMatchPrediction | undefined>()
  const [predictionError, setPredictionError] = useState('')
  const [predicting, setPredicting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<AnyRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const time = matchTime(match)
  const homeWinner = match.winnerTeam?.id && String(match.winnerTeam.id) === String(match.homeTeam?.id)
  const awayWinner = match.winnerTeam?.id && String(match.winnerTeam.id) === String(match.awayTeam?.id)
  const scoreReady = match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null
  const canPredict = Boolean(match.homeTeam && match.awayTeam)

  async function runPrediction() {
    setPredicting(true)
    setPredictionError('')
    try {
      setPrediction(await predictProMatch({ league: leagueKey, matchId: match.id, homeTeam: match.homeTeam, awayTeam: match.awayTeam }))
    } catch (err) {
      setPredictionError(err instanceof Error ? err.message : '预测失败')
    } finally {
      setPredicting(false)
    }
  }

  async function toggleDetail() {
    const next = !expanded
    setExpanded(next)
    if (!next || detail || !match.detailAvailable) return
    setDetailLoading(true)
    try {
      const detailMatchId = match.dataSource === 'lpl.qq.com' ? match.id : (match.opggMatchId || match.id)
      setDetail(await fetchProMatchDetail({ matchId: detailMatchId, league: leagueKey, source: match.dataSource }))
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden border-border bg-card/95">
      <div className="grid gap-3 p-3 lg:grid-cols-[132px_minmax(0,1fr)_258px] lg:items-center">
        <div className="rounded-md border border-border bg-background/40 p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> 比赛时间</p>
          <p className="mt-1 font-mono text-sm font-semibold">{displayMonthDay(time)}</p>
          <p className="font-mono text-sm font-semibold">{displayClock(time)}</p>
          <CountdownText match={match} />
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{match.bestOf || 'BO'}</Badge>
            <Badge className={cn(isFutureMatch(match) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>
              {matchStatusLabel(match)}
            </Badge>
            <span className="truncate">{match.stage || (match.tournament?.name as string) || '-'}</span>
            {match.round ? <span>{match.round}</span> : null}
            {match.place ? <span>{match.place}</span> : null}
          </div>

          <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_92px_minmax(0,1fr)]">
            <TeamLogo team={match.homeTeam} winner={Boolean(homeWinner)} />
            <div className="flex h-12 items-center justify-center rounded-md border border-border bg-background/45 px-3">
              {scoreReady ? (
                <div className="flex items-center gap-2 text-2xl font-bold">
                  <span className={homeWinner ? 'text-primary' : 'text-muted-foreground'}>{match.homeScore}</span>
                  <span className="text-muted-foreground">:</span>
                  <span className={awayWinner ? 'text-primary' : 'text-muted-foreground'}>{match.awayScore}</span>
                </div>
              ) : (
                <span className="text-base font-bold text-muted-foreground">VS</span>
              )}
            </div>
            <TeamLogo team={match.awayTeam} winner={Boolean(awayWinner)} align="right" />
          </div>

          <PredictionBlock prediction={prediction} home={teamLabel(match.homeTeam)} away={teamLabel(match.awayTeam)} match={match} />
          {predictionError ? <p className="mt-2 text-xs text-destructive">{predictionError}</p> : null}
        </div>

        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
          <Button size="sm" variant="outline" onClick={runPrediction} disabled={predicting || !canPredict}>
            {predicting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            {isFinishedMatch(match) ? (prediction ? '重新回测' : '赛后回测') : (prediction ? '重新预测' : 'AI预测')}
          </Button>
          {match.detailAvailable ? (
            <Button size="sm" variant="outline" onClick={toggleDetail}>
              {expanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              比赛详情
            </Button>
          ) : null}
          {match.lplUrl ? <Button size="sm" variant="outline" asChild><a href={match.lplUrl} target="_blank" rel="noreferrer">LPL官网 <ExternalLink className="ml-1 h-3.5 w-3.5" /></a></Button> : null}
          {match.opggUrl ? <Button size="sm" variant="outline" asChild><a href={match.opggUrl} target="_blank" rel="noreferrer">OP.GG详情 <ExternalLink className="ml-1 h-3.5 w-3.5" /></a></Button> : null}
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-border px-3 pb-3">
          {detailLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在同步比赛详情
            </div>
          ) : (
            <LplGameDetail detail={detail} match={match} />
          )}
        </div>
      ) : null}
    </Card>
  )
})

export default function SchedulePage() {
  const [leagueKey, setLeagueKey] = useState(DEFAULT_LEAGUE)
  const [leagues, setLeagues] = useState<ApiProLeague[]>([])
  const [schedule, setSchedule] = useState<ApiProScheduleMatch[]>([])
  const [dateFilter, setDateFilter] = useState(todayKey)
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_MATCHES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<AnyRecord | null>(null)
  const [isPending, startTransition] = useTransition()

  async function loadSchedule(refresh = false) {
    setLoading(true)
    setError(null)
    try {
      const [leaguePayload, schedulePayload] = await Promise.all([
        fetchProLeagues(),
        fetchProSchedule({ league: leagueKey, refresh }),
      ])
      if (leaguePayload.data?.length) setLeagues(leaguePayload.data)
      const matches = schedulePayload.matches || []
      setSchedule(matches)
      setDateFilter(nearestDateKey(matches))
      setMeta(schedulePayload as unknown as AnyRecord)
    } catch (err) {
      setError(err instanceof Error ? err.message : '职业赛程加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSchedule(false)
  }, [leagueKey])

  useEffect(() => {
    setDateFilter(todayKey())
    setVisibleCount(INITIAL_VISIBLE_MATCHES)
  }, [leagueKey])

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_MATCHES)
  }, [dateFilter])

  const activeLeague = useMemo(
    () => leagues.find((league) => league.shortName === leagueKey) || (meta?.league as ApiProLeague | undefined),
    [leagueKey, leagues, meta]
  )

  const availableDates = useMemo(
    () => Array.from(new Set(schedule.map((match) => dateKey(matchTime(match))).filter((item) => item !== 'unknown'))).sort(),
    [schedule]
  )

  function shiftDate(direction: -1 | 1) {
    if (!availableDates.length) return
    const currentIndex = availableDates.indexOf(dateFilter)
    const fallbackIndex = availableDates.indexOf(nearestDateKey(schedule))
    const nextIndex = Math.max(
      0,
      Math.min(availableDates.length - 1, (currentIndex >= 0 ? currentIndex : fallbackIndex >= 0 ? fallbackIndex : 0) + direction)
    )
    startTransition(() => setDateFilter(availableDates[nextIndex]))
  }

  const filtered = useMemo(() => {
    return schedule
      .filter((match) => {
        if (dateFilter !== 'all' && dateKey(matchTime(match)) !== dateFilter) return false
        return true
      })
      .sort((a, b) => {
        return new Date(matchTime(a) || 0).getTime() - new Date(matchTime(b) || 0).getTime()
      })
  }, [schedule, dateFilter])

  const visibleMatches = filtered.slice(0, visibleCount)
  const grouped = useMemo(() => {
    const rows: Record<string, ApiProScheduleMatch[]> = {}
    visibleMatches.forEach((match) => {
      const key = dateKey(matchTime(match))
      rows[key] = rows[key] || []
      rows[key].push(match)
    })
    return rows
  }, [visibleMatches])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">职业赛程</h1>
          <p className="mt-1 text-sm text-muted-foreground">按赛区和日期查看比赛，倒计时会实时更新。</p>
        </div>
        <div className="text-xs text-muted-foreground">更新时间：{String(meta?.fetchedAt || meta?.lastUpdate || '-')}</div>
      </div>

      <Card className="border-border p-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,420px)_minmax(280px,1fr)_auto] xl:items-end">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">赛区</p>
            <Select value={leagueKey} onValueChange={(value) => startTransition(() => setLeagueKey(value))}>
              <SelectTrigger className="w-full">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <img src={leagueIcon(activeLeague)} alt="" className="h-6 w-6 object-contain" />
                  <span className="truncate">{activeLeague?.shortName || leagueKey} · {activeLeague?.name || 'League'}</span>
                </span>
              </SelectTrigger>
              <SelectContent>
                {leagues.map((league) => (
                  <SelectItem key={league.shortName} value={league.shortName}>
                    <span className="inline-flex items-center gap-2">
                      <img src={leagueIcon(league)} alt="" className="h-5 w-5 object-contain" />
                      {league.shortName} · {league.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">比赛日</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} disabled={!availableDates.length || dateFilter === availableDates[0]}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={dateFilter} onValueChange={(value) => startTransition(() => setDateFilter(value))}>
                <SelectTrigger className="min-w-[13rem] flex-1">
                  <SelectValue placeholder="选择比赛日" />
                </SelectTrigger>
                <SelectContent>
                  {availableDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {displayDate(date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => shiftDate(1)} disabled={!availableDates.length || dateFilter === availableDates[availableDates.length - 1]}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button variant="outline" size="sm" onClick={() => startTransition(() => setDateFilter(nearestDateKey(schedule)))}>最近比赛</Button>
            <Button variant="outline" size="sm" onClick={() => loadSchedule(true)} disabled={loading || isPending}>
              {loading || isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              同步
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {filtered.length} 场</span>
          <span>{displayDate(dateFilter)}</span>
        </div>
      </Card>

      {loading ? (
        <Card className="flex items-center justify-center gap-3 border-border p-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          正在加载职业赛程
        </Card>
      ) : null}

      {!loading && error ? <Card className="border-destructive/40 bg-destructive/10 p-6 text-destructive">{error}</Card> : null}

      {!loading && !error ? (
        <div className="space-y-5">
          {Object.entries(grouped).map(([date, matches]) => (
            <section key={date}>
              <div className="mb-2 flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{displayDate(matches[0] ? matchTime(matches[0]) : date)}</span>
                  <Badge variant="outline">{matches.length} 场</Badge>
                </div>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {matches.map((match) => <MatchCard key={`${leagueKey}-${match.id}`} match={match} leagueKey={leagueKey} />)}
              </div>
            </section>
          ))}

          {visibleCount < filtered.length ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setVisibleCount((count) => count + INITIAL_VISIBLE_MATCHES)}>
                加载更多比赛
              </Button>
            </div>
          ) : null}

          {!Object.keys(grouped).length ? (
            <Card className="border-border p-8 text-center text-muted-foreground">暂无符合筛选条件的职业赛程</Card>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
