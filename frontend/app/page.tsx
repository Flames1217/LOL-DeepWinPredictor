'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Eye, Users, RefreshCw, Sparkles, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import type { Champion, Role, Team } from '@/lib/types'
import { ChampionSelector, BanSlot } from '@/components/champion-selector'
import { AnimatedCounter, DualWinRateDisplay } from '@/components/animated-elements'
import { ChampionWeightChart } from '@/components/prediction-chart'
import {
  fetchChampionPositionStats,
  fetchHeroLaneStats,
  fetchHeroes,
  fetchProLeagues,
  fetchSiteStats,
  fetchTeamStats,
  fetchTeams,
  streamAiPredictionAnalysis,
  getLaneWinRate,
  normalizeChampions,
  normalizeTeams,
  predictLineup,
  type ApiProLeague,
  type HeroLaneStats,
} from '@/lib/api'

const roles: Role[] = ['TOP', 'JUN', 'MID', 'ADC', 'SUP']
const roleIndex: Record<Role, number> = { TOP: 0, JUN: 1, MID: 2, ADC: 3, SUP: 4 }
const DEFAULT_LEAGUE = 'LPL'

function findTeam(teams: Team[], name: string) {
  return teams.find((team) => team.name === name)
}

function leagueIcon(league?: ApiProLeague | null) {
  return league?.shortName ? `/opgg_league_icon/${encodeURIComponent(league.shortName)}` : '/opgg_esports_favicon.ico'
}

function compactLeagueName(league?: ApiProLeague | null, fallback = DEFAULT_LEAGUE) {
  return league?.shortName || fallback
}

function TeamOption({ team }: { team: Team }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {team.logo ? <img src={team.logo} alt="" className="h-5 w-5 shrink-0 rounded object-contain" /> : null}
      <span className="truncate">{team.acronym || team.name}</span>
    </span>
  )
}

function SideTeamSelect({
  sideLabel,
  leagueKey,
  leagues,
  teams,
  teamName,
  loading,
  onLeagueChange,
  onTeamChange,
}: {
  sideLabel: string
  leagueKey: string
  leagues: ApiProLeague[]
  teams: Team[]
  teamName: string
  loading?: boolean
  onLeagueChange: (league: string) => void
  onTeamChange: (team: string) => void
}) {
  const activeLeague = leagues.find((league) => league.shortName === leagueKey) || { shortName: leagueKey, name: leagueKey }
  const selectedTeam = teams.find((team) => team.name === teamName)

  return (
    <div className="grid min-w-0 grid-cols-[minmax(7rem,.8fr)_minmax(8rem,1fr)] gap-2">
      <Select value={leagueKey} onValueChange={onLeagueChange}>
        <SelectTrigger className="h-8 min-w-0 text-sm">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <img src={leagueIcon(activeLeague)} alt="" className="h-4 w-4 shrink-0 object-contain" />
            <span className="truncate">{compactLeagueName(activeLeague, leagueKey)}</span>
          </span>
        </SelectTrigger>
        <SelectContent>
          {leagues.map((league) => (
            <SelectItem key={league.shortName} value={league.shortName}>
              <span className="inline-flex min-w-0 items-center gap-2">
                <img src={leagueIcon(league)} alt="" className="h-5 w-5 shrink-0 object-contain" />
                <span className="truncate">{league.shortName} · {league.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={teamName} onValueChange={onTeamChange}>
        <SelectTrigger className="h-8 min-w-0 text-sm">
          {selectedTeam ? <TeamOption team={selectedTeam} /> : <SelectValue placeholder="选择战队" />}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={sideLabel}>{sideLabel}</SelectItem>
          {loading ? <SelectItem value={`${sideLabel}-loading`} disabled>加载战队中</SelectItem> : null}
          {teams.map((team) => (
            <SelectItem key={`${leagueKey}-${team.id}-${team.name}`} value={team.name}>
              <TeamOption team={team} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function findChampion(champions: Champion[], alias: string | null, role: Role) {
  if (!alias) return undefined
  return champions.find((champion) => champion.en === alias && champion.role === role)
}

function buildTeamPayload(
  champions: Champion[],
  laneStats: HeroLaneStats,
  picks: Record<Role, string | null>,
  selectedTeam: Team | undefined,
  prefix: 'A' | 'B'
) {
  const payload: Record<string, number> = {
    [`team${prefix}id`]: selectedTeam?.id || 0,
  }

  roles.forEach((role, index) => {
    const champion = findChampion(champions, picks[role], role)
    payload[`${prefix}${index + 1}playerLocation`] = roleIndex[role]
    payload[`${prefix}${index + 1}heroId`] = champion?.heroId || 0
    payload[`${prefix}${index + 1}heroWinRate`] = champion?.winRate ?? getLaneWinRate(laneStats, champion?.heroId, role)
  })

  return payload
}

function buildFeatureWeights(
  champions: Champion[],
  laneStats: HeroLaneStats,
  blueTeam: Record<Role, string | null>,
  redTeam: Record<Role, string | null>
) {
  const raw = [
    ...roles.map((role) => {
      const champion = findChampion(champions, blueTeam[role], role)
      return {
        champion: champion?.en || '',
        team: 'blue' as const,
        weight: champion?.winRate ?? getLaneWinRate(laneStats, champion?.heroId, role),
      }
    }),
    ...roles.map((role) => {
      const champion = findChampion(champions, redTeam[role], role)
      return {
        champion: champion?.en || '',
        team: 'red' as const,
        weight: champion?.winRate ?? getLaneWinRate(laneStats, champion?.heroId, role),
      }
    }),
  ].filter((item) => item.champion)

  const total = raw.reduce((sum, item) => sum + item.weight, 0) || 1
  return raw.map((item) => ({ ...item, weight: item.weight / total }))
}

function formatRate(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  const percent = value > 1 ? value : value * 100
  return `${percent.toFixed(1)}%`
}

export default function PredictPage() {
  const {
    blueTeam,
    redTeam,
    blueTeamName,
    redTeamName,
    champions,
    setBlueChampion,
    setRedChampion,
    setBlueBan,
    setRedBan,
    setBlueTeamName,
    setRedTeamName,
    setChampions,
    setTeams,
    setSiteStats,
    isPredicting,
    setIsPredicting,
    predictionResult,
    setPredictionResult,
    resetTeams,
    isTeamComplete,
    getAllSelectedChampions,
    visitCount,
    visitorCount,
  } = useAppStore()

  const [laneStats, setLaneStats] = useState<HeroLaneStats>({})
  const [leagueOptions, setLeagueOptions] = useState<ApiProLeague[]>([{ shortName: DEFAULT_LEAGUE, name: 'League of Legends Pro League' }])
  const [blueLeagueKey, setBlueLeagueKey] = useState(DEFAULT_LEAGUE)
  const [redLeagueKey, setRedLeagueKey] = useState(DEFAULT_LEAGUE)
  const [teamsByLeague, setTeamsByLeague] = useState<Record<string, Team[]>>({})
  const [teamLoadingByLeague, setTeamLoadingByLeague] = useState<Record<string, boolean>>({})
  const [showResult, setShowResult] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const blueLeagueTeams = teamsByLeague[blueLeagueKey] || []
  const redLeagueTeams = teamsByLeague[redLeagueKey] || []
  const allLeagueTeams = useMemo(() => {
    const byKey = new Map<string, Team>()
    Object.values(teamsByLeague).flat().forEach((team) => {
      byKey.set(`${team.id}-${team.name}`, team)
    })
    return Array.from(byKey.values())
  }, [teamsByLeague])
  const selectedBlueTeam = useMemo(() => findTeam(blueLeagueTeams, blueTeamName), [blueLeagueTeams, blueTeamName])
  const selectedRedTeam = useMemo(() => findTeam(redLeagueTeams, redTeamName), [redLeagueTeams, redTeamName])
  const disabledChampions = getAllSelectedChampions()
  const canPredict = isTeamComplete() && champions.length > 0

  async function loadTeamsForLeague(league: string) {
    if (!league || teamsByLeague[league]?.length || teamLoadingByLeague[league]) return
    setTeamLoadingByLeague((state) => ({ ...state, [league]: true }))
    try {
      const payload = await fetchTeamStats({ league })
      const normalized = normalizeTeams(payload.data || [])
      setTeamsByLeague((state) => ({ ...state, [league]: normalized }))
    } catch (error) {
      if (league !== DEFAULT_LEAGUE) {
        setTeamsByLeague((state) => ({ ...state, [league]: [] }))
        return
      }
      const fallbackTeams = await fetchTeams()
      setTeamsByLeague((state) => ({ ...state, [league]: normalizeTeams(fallbackTeams) }))
    } finally {
      setTeamLoadingByLeague((state) => ({ ...state, [league]: false }))
    }
  }

  useEffect(() => {
    let mounted = true

    async function loadInitialData() {
      try {
        setIsLoadingData(true)
        const [heroes, teamPayload, stats, championPositionStats, siteStats, leaguePayload] = await Promise.all([
          fetchHeroes(),
          fetchTeamStats({ league: DEFAULT_LEAGUE }).catch(async () => ({ data: await fetchTeams() })),
          fetchHeroLaneStats(),
          fetchChampionPositionStats(),
          fetchSiteStats().catch(() => ({ visit_count: 0, visitor_count: 0 })),
          fetchProLeagues().catch(() => ({ data: [{ shortName: DEFAULT_LEAGUE, name: 'League of Legends Pro League' }] })),
        ])

        if (!mounted) return

        setLaneStats(stats)
        setChampions(normalizeChampions(heroes, championPositionStats.data || [], stats))
        const normalizedTeams = normalizeTeams(teamPayload.data || [])
        setTeams(normalizedTeams)
        setTeamsByLeague((state) => ({ ...state, [DEFAULT_LEAGUE]: normalizedTeams }))
        if (leaguePayload.data?.length) setLeagueOptions(leaguePayload.data)
        setSiteStats(siteStats.visit_count, siteStats.visitor_count)
        setLoadError(null)
      } catch (error) {
        if (!mounted) return
        setLoadError(error instanceof Error ? error.message : '加载数据失败')
      } finally {
        if (mounted) setIsLoadingData(false)
      }
    }

    loadInitialData()
    return () => {
      mounted = false
    }
  }, [setChampions, setSiteStats, setTeams])

  useEffect(() => {
    loadTeamsForLeague(blueLeagueKey)
  }, [blueLeagueKey])

  useEffect(() => {
    loadTeamsForLeague(redLeagueKey)
  }, [redLeagueKey])

  useEffect(() => {
    if (allLeagueTeams.length) setTeams(allLeagueTeams)
  }, [allLeagueTeams, setTeams])

  const handlePredict = async () => {
    if (!canPredict) {
      setLoadError('请为双方各选择 5 名英雄后再预测')
      return
    }

    setIsPredicting(true)
    setShowResult(false)
    setLoadError(null)

    try {
      const result = await predictLineup({
        left_team: buildTeamPayload(champions, laneStats, blueTeam, selectedBlueTeam, 'A'),
        right_team: buildTeamPayload(champions, laneStats, redTeam, selectedRedTeam, 'B'),
      })

      setPredictionResult({
        blueWinRate: result.A_win / 100,
        redWinRate: result.B_win / 100,
        championWeights: buildFeatureWeights(champions, laneStats, blueTeam, redTeam),
        method: result.method,
        modelRate: result.modelRate,
        priorRate: result.priorRate,
        calibratedRate: result.calibratedRate,
        confidence: result.confidence,
        explanation: result.explanation,
        aiAnalysis: result.aiAnalysis,
      })
      setShowResult(true)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '预测失败，请稍后重试')
    } finally {
      setIsPredicting(false)
    }
  }

  const handleAiAnalysis = async () => {
    if (!predictionResult) return
    setIsAiAnalyzing(true)
    const baseResult = {
      ...predictionResult,
      aiAnalysis: {
        summary: '',
        confidence: predictionResult.confidence,
        available: true,
      },
    }
    let streamedText = ''
    const payload = {
      mode: 'draft',
      teams: {
        blue: { league: blueLeagueKey, name: blueTeamName },
        red: { league: redLeagueKey, name: redTeamName },
      },
      draft: { blueTeam, redTeam },
      result: {
        A_win: predictionResult.blueWinRate * 100,
        B_win: predictionResult.redWinRate * 100,
        modelRate: predictionResult.modelRate,
        priorRate: predictionResult.priorRate,
        calibratedRate: predictionResult.calibratedRate,
        confidence: predictionResult.confidence,
      },
    }
    setPredictionResult(baseResult)
    try {
      const analysis = await streamAiPredictionAnalysis(payload, (delta) => {
        streamedText += delta
        setPredictionResult({
          ...baseResult,
          aiAnalysis: {
            ...baseResult.aiAnalysis,
            summary: streamedText,
          },
        })
      })
      setPredictionResult({ ...baseResult, aiAnalysis: analysis })
    } catch (error) {
      setPredictionResult({
        ...baseResult,
        aiAnalysis: {
          summary: error instanceof Error ? error.message : 'AI 分析暂时不可用',
          confidence: predictionResult.confidence,
        },
      })
    } finally {
      setIsAiAnalyzing(false)
    }
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-card via-card to-card border border-border"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5" />
        <div className="relative p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="mb-3 font-serif text-3xl font-bold text-foreground lg:text-3xl">
                LOL-DeepWinPredictor
              </h1>
              <p className="text-muted-foreground">
                基于 BiLSTM 深度学习的职业赛事胜率预测
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 lg:gap-6">
              <div className="relative hidden h-14 w-44 overflow-hidden rounded-md border border-border bg-card/70 md:block">
                <Image src="/legacy/images/leagueoflegends.webp" alt="League of Legends" fill className="object-contain p-2" />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 border border-secondary/30">
                <Sparkles className="w-4 h-4 text-secondary" />
                <span className="text-sm font-medium text-secondary">
                  实时接入本地模型
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">访问</span>
                  <AnimatedCounter value={visitCount} className="text-sm font-bold text-foreground" />
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">用户</span>
                  <AnimatedCounter value={visitorCount} className="text-sm font-bold text-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {loadError && (
        <Card className="p-4 border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{loadError}</span>
        </Card>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1"
        >
          <Card className="p-4 border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <h2 className="font-semibold text-foreground">蓝方</h2>
              </div>
              <SideTeamSelect
                sideLabel="蓝方"
                leagueKey={blueLeagueKey}
                leagues={leagueOptions}
                teams={blueLeagueTeams}
                teamName={blueTeamName}
                loading={teamLoadingByLeague[blueLeagueKey]}
                onLeagueChange={(league) => {
                  setBlueLeagueKey(league)
                  setBlueTeamName('蓝方')
                  setPredictionResult(null)
                }}
                onTeamChange={setBlueTeamName}
              />
            </div>

            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1.5">禁用</p>
              <div className="flex gap-1.5">
                {blueTeam.bans.map((ban, index) => (
                  <BanSlot
                    key={index}
                    champion={ban}
                    onSelect={(c) => setBlueBan(index, c)}
                    disabledChampions={disabledChampions}
                    champions={champions}
                    team="blue"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {roles.map((role) => (
                <ChampionSelector
                  key={role}
                  role={role}
                  selectedChampion={blueTeam[role]}
                  onSelect={(c) => setBlueChampion(role, c)}
                  disabledChampions={disabledChampions}
                  champions={champions}
                  team="blue"
                />
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-row lg:flex-col items-center justify-center gap-3 py-2 lg:py-0"
        >
          <div className="hidden lg:block w-px flex-1 bg-gradient-to-b from-transparent via-border to-transparent" />
          <Button
            size="sm"
            onClick={handlePredict}
            disabled={!canPredict || isPredicting || isLoadingData}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold shadow-lg shadow-primary/30"
          >
            {isPredicting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4 mr-1" />
                预测
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetTeams()
              setShowResult(false)
              setPredictionResult(null)
            }}
            className="text-muted-foreground text-xs"
          >
            重置
          </Button>
          <div className="hidden lg:block w-px flex-1 bg-gradient-to-b from-transparent via-border to-transparent" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1"
        >
          <Card className="p-4 border-destructive/30 bg-destructive/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
                <h2 className="font-semibold text-foreground">红方</h2>
              </div>
              <SideTeamSelect
                sideLabel="红方"
                leagueKey={redLeagueKey}
                leagues={leagueOptions}
                teams={redLeagueTeams}
                teamName={redTeamName}
                loading={teamLoadingByLeague[redLeagueKey]}
                onLeagueChange={(league) => {
                  setRedLeagueKey(league)
                  setRedTeamName('红方')
                  setPredictionResult(null)
                }}
                onTeamChange={setRedTeamName}
              />
            </div>

            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1.5">禁用</p>
              <div className="flex gap-1.5">
                {redTeam.bans.map((ban, index) => (
                  <BanSlot
                    key={index}
                    champion={ban}
                    onSelect={(c) => setRedBan(index, c)}
                    disabledChampions={disabledChampions}
                    champions={champions}
                    team="red"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {roles.map((role) => (
                <ChampionSelector
                  key={role}
                  role={role}
                  selectedChampion={redTeam[role]}
                  onSelect={(c) => setRedChampion(role, c)}
                  disabledChampions={disabledChampions}
                  champions={champions}
                  team="red"
                />
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      <AnimatePresence>
        {(isPredicting || isLoadingData) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <Card className="p-8">
              <div className="flex items-center justify-center gap-16">
                <div className="flex flex-col items-center gap-4">
                  <Skeleton className="w-40 h-40 rounded-full" />
                  <Skeleton className="w-20 h-6" />
                </div>
                <Skeleton className="w-16 h-12" />
                <div className="flex flex-col items-center gap-4">
                  <Skeleton className="w-40 h-40 rounded-full" />
                  <Skeleton className="w-20 h-6" />
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {showResult && predictionResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <Card className="p-6 lg:p-8 border-secondary/30">
              <h3 className="text-xl font-semibold text-center mb-8 text-foreground">
                预测结果
              </h3>
              <DualWinRateDisplay
                blueWinRate={predictionResult.blueWinRate}
                redWinRate={predictionResult.redWinRate}
                blueLabel={blueTeamName}
                redLabel={redTeamName}
              />
              <div className="mt-8 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-card/60 p-4">
                  <p className="text-xs text-muted-foreground">本地模型</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{formatRate(predictionResult.modelRate)}</p>
                </div>
                <div className="rounded-lg border border-border bg-card/60 p-4">
                  <p className="text-xs text-muted-foreground">队伍与阵容先验</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{formatRate(predictionResult.priorRate)}</p>
                </div>
                <div className="rounded-lg border border-secondary/40 bg-secondary/10 p-4">
                  <p className="text-xs text-muted-foreground">校准后</p>
                  <p className="mt-1 text-xl font-semibold text-secondary">{formatRate(predictionResult.calibratedRate)}</p>
                </div>
              </div>
              {predictionResult.explanation ? (
                <p className="mt-4 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  {predictionResult.explanation}
                </p>
              ) : null}
              {predictionResult.aiAnalysis || isAiAnalyzing ? (
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">AI 分析</p>
                  <p className="mt-2 min-h-16 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {predictionResult.aiAnalysis?.summary || '正在生成分析...'}
                    {isAiAnalyzing ? <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-primary align-[-2px]" /> : null}
                  </p>
                </div>
              ) : null}
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAiAnalysis}
                  disabled={isAiAnalyzing}
                >
                  {isAiAnalyzing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  生成 AI 分析
                </Button>
              </div>
            </Card>

            <ChampionWeightChart weights={predictionResult.championWeights} champions={champions} />
          </motion.div>
        )}
      </AnimatePresence>

      {!showResult && !isPredicting && !isLoadingData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center py-8"
        >
          <p className="text-muted-foreground">
            请选择双方各 5 名英雄后开始预测，队伍和禁用位可选
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            已选择: {disabledChampions.filter((c) => roles.some((r) => blueTeam[r] === c || redTeam[r] === c)).length} / 10 名英雄
          </p>
        </motion.div>
      )}
    </div>
  )
}
