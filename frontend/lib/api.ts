import type { Champion, ChampionDetail, Player, Role, Team } from './types'

export interface ApiHero {
  heroId: string | number
  name: string
  alias?: string
  keywords?: string
  heroLogo?: string
}

export interface ApiTeam {
  teamId: string | number
  opggTeamId?: string | number
  teamName: string
  fullName?: string
  teamFullName?: string
  acronym?: string
  teamLogo?: string
  opggLogo?: string
  rank?: number
  matchCount?: number
  matchWinCount?: number
  gameCount?: number
  gameWinCount?: number
  matchLossCount?: number
  gameLossCount?: number
  setWins?: number
  setLosses?: number
  matchWinningRate?: number
  points?: number
  standingPosition?: number
  previousStandingPosition?: number
  scheduledMatches?: number
  finishedMatches?: number
  recentMatches?: Team['recentMatches']
  upcomingMatches?: Team['upcomingMatches']
  recentMatchesAll?: Team['recentMatchesAll']
  upcomingMatchesAll?: Team['upcomingMatchesAll']
  roster?: Team['roster']
  leagueHeroStats?: Team['leagueHeroStats']
  standings?: Team['standings']
  winningRate?: number
  assistPerGameTeam?: number
  deathPerGameTeam?: number
  killPerGameTeam?: number
  turretDestroyPerGameTeam?: number
  drakeControlRate?: number
  drakeKillPerGameTeam?: number
  firstDragonControlRate?: number
  riftHeraldControlRate?: number
  baronControlRate?: number
  baronKillPerGameTeam?: number
  firstBloodRateTeam?: number
  firstTorrentRateTeam?: number
  firstBloodPerGameTeam?: number
  firstTowerPerGameTeam?: number
  timePerGameTeam?: number
  goldPerGameTeam?: number
  damagePerMinuteTeam?: number
  damageTakenPerMinuteTeam?: number
  creepScorePerGameTeam?: number
  wardPlacedPerGameTeam?: number
  wardKilledPerGameTeam?: number
  totalKills?: number
  totalDeath?: number
  totalAssists?: number
  source?: string
  foundedAt?: string
  website?: string
  twitter?: string
  league?: string | ApiProLeague
}

export interface ApiPlayer {
  playerId: string | number
  playerName: string
  realName?: string
  playerLocation?: string
  playerAvatar?: string
  opggAvatar?: string
  teamId: string | number
  teamName: string
  teamFullName?: string
  teamLogo?: string
  opggTeamId?: string | number
  opggTeamLogo?: string
  nationality?: string
  birthday?: string
  games?: number
  wins?: number
  loses?: number
  winRate?: number
  kda?: number
  totalKills?: number
  totalAssists?: number
  totalDeath?: number
  matchCount?: number
  boCount?: number
  mvpCount?: number
  mvpVotes?: number
  damagePercent?: number
  damageTakenPercent?: number
  damageTakenPerMinute?: number
  damagePerGold?: number
  goldPercent?: number
  goldPerMinute?: number
  wardPlacedPerGame?: number
  wardKilledPerGame?: number
  visionScorePerGame?: number
  visionScoreGapPerGame?: number
  damagePerMinute?: number
  killParticipantPercent?: number
  creepScorePerGame?: number
  creepScorePerMinute?: number
  goldPerGame?: number
  goldGapPerGame?: number
  firstBloodPerGame?: number
  firstTowerPerGame?: number
  opScore?: number
  opScoreGrade?: string
  facebook?: string
  instagram?: string
  discord?: string
  opggPlayerId?: string | number
  opggTournamentId?: string | number
  stream?: string
  youtube?: string
  twitter?: string
  source?: string
  championPool?: Array<{
    heroId?: string | number
    heroName?: string
    heroCnName?: string
    heroCnTitle?: string
    heroLogo?: string
    pickCount?: number
    pickRate?: number
    banRate?: number
    bpRate?: number
    winRate?: number
    kda?: number
  }>
}

export interface ApiProLeague {
  id?: string | number
  name?: string
  shortName: string
  region?: string
  imageUrl?: string
  imageUrlColor?: string
  imageUrlDarkMode?: string
  imageUrlLightMode?: string
  latestSerie?: {
    id?: string | number
    name?: string
    year?: string | number
  }
}

export interface ApiProStatsResponse<T> {
  data?: T[]
  source?: string
  league?: string | ApiProLeague
  leagues?: ApiProLeague[]
  opggLeague?: {
    id?: string | number
    name?: string
    shortName?: string
    region?: string
    imageUrl?: string
  }
  season?: {
    name?: string
    seasonId?: string
    stageIds?: string
    year?: string
  }
  seasonId?: string
  stageIds?: string
  fetchedAt?: string | null
  cacheFallback?: boolean
}

export interface ApiScheduleTeam {
  id?: string | number
  opggTeamId?: string | number
  name?: string
  acronym?: string
  logo?: string
}

export interface ApiProScheduleMatch {
  id: string | number
  opggMatchId?: string | number
  name?: string
  status?: string
  statusLabel?: string
  beginAt?: string | null
  endAt?: string | null
  scheduledAt?: string | null
  time?: string | null
  homeScore?: number | string | null
  awayScore?: number | string | null
  homeTeam?: ApiScheduleTeam
  awayTeam?: ApiScheduleTeam
  winnerTeam?: ApiScheduleTeam | null
  league?: ApiProLeague
  serie?: Record<string, unknown>
  tournament?: Record<string, unknown>
  stage?: string
  round?: string
  bestOf?: string | number | null
  place?: string
  newsId?: string | number
  videoIds?: Array<string | number | null | undefined>
  chatIds?: Array<string | number | null | undefined>
  source?: string
  dataSource?: string
  sourceUrl?: string
  lplUrl?: string
  opggUrl?: string
  detailAvailable?: boolean
}

export interface ApiProScheduleResponse {
  source?: string
  league?: ApiProLeague
  serie?: Record<string, unknown>
  season?: Record<string, unknown>
  tournaments?: Record<string, unknown>[]
  matches?: ApiProScheduleMatch[]
  leagues?: ApiProLeague[]
  fetchedAt?: string
  lastUpdate?: string
  cacheFallback?: boolean
}

export interface ApiMatchPrediction {
  A_win: number
  B_win: number
  liveAdjustedAWin?: number
  liveAdjustedBWin?: number
  method?: string
  modelRate?: number
  priorRate?: number
  calibratedRate?: number
  confidence?: 'low' | 'medium' | 'high'
  explanation?: string
  aiAnalysis?: ApiPredictionAnalysis
  game?: Record<string, unknown>
  backtest?: {
    actualBlueWin?: boolean
    draftHit?: boolean
    liveAdjustedHit?: boolean
  }
}

export interface ApiPredictionAnalysis {
  available?: boolean
  provider?: string
  model?: string
  baseUrl?: string
  summary?: string
  confidence?: 'low' | 'medium' | 'high'
  keyFactors?: string[]
  risks?: string[]
  dataGaps?: string[]
  recommendedView?: string
  endpoint?: string
  rawPreview?: string
  error?: string
}

export interface ApiAiPredictionConfig {
  enabled: boolean
  provider: string
  model?: string
  baseUrl?: string
  baseUrlConfigured?: boolean
  hasApiKey?: boolean
  maskedApiKey?: string
  configPath?: string
}

export interface ApiSocialLinks {
  website?: string | null
  twitter?: string | null
  facebook?: string | null
  instagram?: string | null
  youtube?: string | null
  stream?: string | null
  discord?: string | null
}

export interface ApiProfileSeries {
  id?: string | number
  name?: string
  year?: string | number
  beginAt?: string | null
  endAt?: string | null
}

export interface ApiPlayerCareer {
  beginAt?: string | null
  endAt?: string | null
  team?: {
    id?: string | number
    name?: string
    acronym?: string
    logo?: string
  }
}

export interface ApiTeamProfile {
  id?: string | number
  name?: string
  acronym?: string
  logo?: string
  nationality?: string
  foundedAt?: string | null
  source?: string
  currentLeague?: ApiProLeague
  formerly?: string[]
  socials?: ApiSocialLinks
  series?: ApiProfileSeries[]
  wonSeries?: ApiProfileSeries[]
  formerWonSeries?: ApiProfileSeries[]
}

export interface ApiPlayerProfile {
  id?: string | number
  profileUrl?: string
  nickName?: string
  firstName?: string
  lastName?: string
  imageUrl?: string
  position?: string
  birthday?: string | null
  nationality?: string
  source?: string
  currentTeam?: {
    id?: string | number
    name?: string
    acronym?: string
    logo?: string
  }
  socials?: ApiSocialLinks
  series?: ApiProfileSeries[]
  wonSeries?: ApiProfileSeries[]
  careers?: ApiPlayerCareer[]
}

export interface ApiChampionPositionStat {
  champion_id?: string | number
  key?: string
  name?: string
  image_url?: string
  positionName?: string
  positionWinRate?: number
  positionPickRate?: number
  positionBanRate?: number
  presenceRate?: number
  positionRoleRate?: number
  positionRoleRatePercent?: number
  winRateDeltaFromEven?: number
  positionTier?: number | string
  positionRank?: number
  totalRank?: number
  rank?: number
  tierImageRank?: number
  positionRankPrev?: number | null
  positionRankPrevPatch?: number | null
  positionRankDelta?: number | null
  positionTierData?: {
    rank_prev?: number | null
    rank_prev_patch?: number | null
  }
  positionCounters?: Array<{
    champion_id?: string | number
    key?: string
    name?: string
    img_url?: string
    counterWinRate?: number
    play?: number
    win?: number
  } | string | null>
  play?: number
  dataCompleteness?: {
    hasChampionId?: boolean
    hasCounters?: boolean
    hasRankDelta?: boolean
  }
}

export interface ApiChampionPositionStatsResponse {
  data?: ApiChampionPositionStat[]
  source?: string
  region?: string
  tier?: string
  patch?: string | null
  versions?: string[]
  fetchedAt?: string | null
  updateDate?: string | null
  cacheFallback?: boolean
}

export type HeroLaneStats = Record<string, {
  name: string
  top: number
  jun: number
  mid: number
  adc: number
  sup: number
}>

export interface SiteStats {
  visit_count: number
  visitor_count: number
}

export interface PredictResponse {
  A_win: number
  B_win: number
  winning_team: {
    name: string
    logo: string
  }
  method?: string
  modelRate?: number
  priorRate?: number
  calibratedRate?: number
  confidence?: 'low' | 'medium' | 'high'
  explanation?: string
  calibration?: {
    modelWeight: number
    priorWeight: number
    minWinRate: number
    maxWinRate: number
  }
  aiAnalysis?: ApiPredictionAnalysis
}

const roles: Role[] = ['TOP', 'JUN', 'MID', 'ADC', 'SUP']
type HeroLaneKey = Exclude<keyof HeroLaneStats[string], 'name'>

const roleToLane: Record<Role, HeroLaneKey> = {
  TOP: 'top',
  JUN: 'jun',
  MID: 'mid',
  ADC: 'adc',
  SUP: 'sup',
}

const opggPositionToRole: Record<string, Role> = {
  TOP: 'TOP',
  JUNGLE: 'JUN',
  JUN: 'JUN',
  MID: 'MID',
  MIDDLE: 'MID',
  ADC: 'ADC',
  BOT: 'ADC',
  BOTTOM: 'ADC',
  SUPPORT: 'SUP',
  SUP: 'SUP',
  UTILITY: 'SUP',
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '')

function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  return `${API_BASE_URL}${path}`
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url))
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`)
  }
  return response.json()
}

export const fetchSiteStats = () => getJson<SiteStats>('/site_stats')
export const fetchTeamStats = (params?: { league?: string }) => {
  const search = new URLSearchParams()
  if (params?.league) search.set('league', params.league)
  const query = search.toString()
  return getJson<ApiProStatsResponse<ApiTeam>>(`/query_team_stats${query ? `?${query}` : ''}`)
}
export const fetchTeamDetail = (params: { teamId: string | number; acronym?: string }) => {
  const search = new URLSearchParams({ team_id: String(params.teamId) })
  if (params.acronym) search.set('acronym', params.acronym)
  return getJson<ApiTeamProfile>(`/query_team_detail?${search.toString()}`)
}
export const fetchPlayers = () => getJson<ApiPlayer[]>('/query_player')
export const fetchPlayerStats = (params?: { league?: string }) => {
  const search = new URLSearchParams({ raw: '1' })
  if (params?.league) search.set('league', params.league)
  return getJson<ApiProStatsResponse<ApiPlayer>>(`/query_player?${search.toString()}`)
}
export const fetchPlayerDetail = (params: { playerId: string | number; nickName?: string }) => {
  const search = new URLSearchParams({ player_id: String(params.playerId) })
  if (params.nickName) search.set('nick_name', params.nickName)
  return getJson<ApiPlayerProfile>(`/query_player_detail?${search.toString()}`)
}
export const fetchProLeagues = () => getJson<{ data?: ApiProLeague[]; source?: string }>('/query_pro_leagues')
export const fetchProSchedule = (params?: { league?: string; refresh?: boolean }) => {
  const search = new URLSearchParams()
  if (params?.league) search.set('league', params.league)
  if (params?.refresh) search.set('refresh', '1')
  const query = search.toString()
  return getJson<ApiProScheduleResponse>(`/query_pro_schedule${query ? `?${query}` : ''}`)
}
export async function predictProMatch(payload: unknown) {
  const response = await fetch(apiUrl('/predict_pro_match'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Prediction request failed')
  }
  return data as ApiMatchPrediction
}

export async function predictProGame(payload: unknown) {
  const response = await fetch(apiUrl('/predict_pro_game'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Game prediction request failed')
  }
  return data as ApiMatchPrediction
}
export const fetchProMatchDetail = (params: { matchId: string | number; league?: string; source?: string }) => {
  const search = new URLSearchParams({ match_id: String(params.matchId) })
  if (params.league) search.set('league', params.league)
  if (params.source) search.set('source', params.source)
  return getJson<Record<string, unknown>>(`/query_pro_match_detail?${search.toString()}`)
}
export const fetchChampionPositionStats = (params?: {
  region?: string
  tier?: string
  version?: string
  gameType?: string
  targetChampion?: string | null
}) => {
  const search = new URLSearchParams()
  if (params?.region) search.set('region', params.region)
  if (params?.tier) search.set('tier', params.tier)
  if (params?.version) search.set('patch', params.version)
  if (params?.gameType) search.set('game_type', params.gameType)
  const query = search.toString()
  return getJson<ApiChampionPositionStatsResponse>(`/query_win_rate${query ? `?${query}` : ''}`)
}
export const fetchTencentChampionPositionStats = (tier = '999', queue = '420', lane = 'all') =>
  getJson<ApiChampionPositionStatsResponse>(
    `/query_cn_win_rate?tier=${encodeURIComponent(tier)}&queue=${encodeURIComponent(queue)}&lane=${encodeURIComponent(lane)}`
  )

export const fetchChampionDetail = (params: {
  champion: string
  position: string
  region?: string
  tier?: string
  version?: string
  gameType?: string
  targetChampion?: string | null
}) => {
  const search = new URLSearchParams({
    champion: params.champion,
    position: params.position,
  })
  if (params.region) search.set('region', params.region)
  if (params.tier) search.set('tier', params.tier)
  if (params.version) search.set('patch', params.version)
  if (params.gameType) search.set('game_type', params.gameType)
  if (params.targetChampion) search.set('target_champion', params.targetChampion)
  return getJson<ChampionDetail>(`/query_champion_detail?${search.toString()}`)
}

export async function predictLineup(payload: unknown) {
  const response = await fetch(apiUrl('/predict'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'Prediction request failed')
  }
  return data as PredictResponse
}

export const fetchAiPredictionConfig = () => getJson<ApiAiPredictionConfig>('/ai_prediction_config')

export async function saveAiPredictionConfig(payload: {
  enabled: boolean
  provider: string
  model?: string
  baseUrl?: string
  apiKey?: string
  clearApiKey?: boolean
}) {
  const response = await fetch(apiUrl('/ai_prediction_config'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'AI config save failed')
  }
  return data as ApiAiPredictionConfig
}

export async function fetchAiPredictionAnalysis(payload: unknown) {
  const response = await fetch(apiUrl('/ai_prediction_analysis'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'AI analysis request failed')
  }
  return data as ApiPredictionAnalysis
}

export async function streamAiPredictionAnalysis(
  payload: unknown,
  onDelta: (delta: string) => void,
) {
  const response = await fetch(apiUrl('/ai_prediction_analysis_stream'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok || !response.body) {
    throw new Error('AI analysis stream request failed')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalText = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''

    for (const event of events) {
      const line = event.split('\n').find((item) => item.startsWith('data:'))
      if (!line) continue
      const raw = line.slice(5).trim()
      if (!raw) continue
      const data = JSON.parse(raw) as { delta?: string; error?: string; done?: boolean }
      if (data.error) throw new Error(data.error)
      if (data.delta) {
        finalText += data.delta
        onDelta(data.delta)
      }
    }
  }

  return {
    available: true,
    summary: finalText.trim(),
  } as ApiPredictionAnalysis
}

export async function testAiProvider(payload: unknown = {}) {
  const response = await fetch(apiUrl('/ai_prediction_test'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || 'AI provider test failed')
  }
  return data as ApiPredictionAnalysis
}

export const fetchModelDiagnostics = () => getJson<Record<string, unknown>>('/model_diagnostics')

export function normalizeChampions(
  heroes: ApiHero[] = [],
  positionStats: ApiChampionPositionStat[],
  laneStats: HeroLaneStats = {},
  source: 'global' | 'cn' = 'global'
): Champion[] {
  const heroById = new Map(
    heroes.map((hero) => [Number(hero.heroId), hero])
  )
  const championByRole = new Map<string, Champion>()

  positionStats.forEach((stat, sortIndex) => {
    const rawHeroId = Number(stat.champion_id)
    const role = opggPositionToRole[String(stat.positionName || '').toUpperCase()]
    if (!role) return

    const hasHeroId = Number.isFinite(rawHeroId) && rawHeroId > 0
    const heroId = hasHeroId ? rawHeroId : undefined
    const statKey = String(stat.key || stat.name || sortIndex)
    const officialHero = heroId ? heroById.get(heroId) : undefined
    const alias = officialHero?.alias || stat.key || String(heroId)
    const lane = roleToLane[role]
    const fallbackWinRate = heroId ? (laneStats[String(heroId)]?.[lane] ?? 0.5) : 0.5
    const winRate = Number.isFinite(stat.positionWinRate)
      ? Number(stat.positionWinRate) / 100
      : fallbackWinRate
    const pickRate = Number.isFinite(stat.positionPickRate)
      ? Number(stat.positionPickRate) / 100
      : 0
    const banRate = Number.isFinite(stat.positionBanRate)
      ? Number(stat.positionBanRate) / 100
      : 0
    const presenceRate = Number.isFinite(Number(stat.presenceRate))
      ? Number(stat.presenceRate) / 100
      : pickRate + banRate
    const roleRate = Number.isFinite(Number(stat.positionRoleRatePercent))
      ? Number(stat.positionRoleRatePercent) / 100
      : Number.isFinite(Number(stat.positionRoleRate))
        ? Number(stat.positionRoleRate)
        : undefined

    const positionTier = Number(stat.positionTier ?? stat.tierImageRank)
    const sourceRank = Number(stat.positionRank ?? stat.totalRank ?? stat.rank)
    const tier = Number.isFinite(positionTier)
      ? tierFromRank(positionTier)
      : tierFromRate(winRate, pickRate)
    const previousRank = Number(stat.positionRankPrev ?? stat.positionTierData?.rank_prev)
    const rankDelta = stat.positionRankDelta === null ? Number.NaN : Number(stat.positionRankDelta)
    const computedRankDelta =
      Number.isFinite(rankDelta)
        ? rankDelta
        : Number.isFinite(previousRank) && previousRank > 0 && sourceRank > 0
          ? previousRank - sourceRank
          : undefined
    const counters = (stat.positionCounters || [])
      .filter((counter): counter is Exclude<typeof counter, string | null> => !!counter && typeof counter === 'object')
      .map((counter) => {
        const counterHeroId = Number(counter.champion_id)
        const officialCounter = Number.isFinite(counterHeroId) ? heroById.get(counterHeroId) : undefined
        const counterGames = Number(counter.play)
        const counterWins = Number(counter.win)
        const counterWinRate = Number.isFinite(counter.counterWinRate)
          ? Number(counter.counterWinRate) / 100
          : Number.isFinite(counterGames) && counterGames > 0 && Number.isFinite(counterWins)
            ? counterWins / counterGames
            : undefined
        return {
          heroId: Number.isFinite(counterHeroId) ? counterHeroId : undefined,
          name: officialCounter?.name || counter.name || counter.key || '',
          en: officialCounter?.alias || counter.key || String(counterHeroId || ''),
          imageUrl: officialCounter?.heroLogo || counter.img_url,
          winRate: counterWinRate,
          games: Number.isFinite(counterGames) ? counterGames : undefined,
          wins: Number.isFinite(counterWins) ? counterWins : undefined,
        }
      })
      .filter((counter) => counter.name || counter.imageUrl)

    const champion: Champion = {
      id: `${source}-${heroId || statKey}-${role}`,
      heroId,
      name: officialHero?.name || stat.name || alias,
      en: alias,
      keywords: officialHero?.keywords || [officialHero?.name, alias, stat.key].filter(Boolean).join(','),
      dataSource: source,
      sourceLabel: source === 'cn' ? '中国区 · 101' : '全球 · OP.GG',
      role,
      imageUrl: officialHero?.heroLogo || stat.image_url,
      banRate,
      pickRate,
      presenceRate,
      roleRate,
      winRate,
      winRateDelta: Number.isFinite(Number(stat.winRateDeltaFromEven))
        ? Number(stat.winRateDeltaFromEven) / 100
        : winRate - 0.5,
      games: Number(stat.play || 0),
      rank: sourceRank || undefined,
      rankPrev: Number.isFinite(previousRank) && previousRank > 0 ? previousRank : undefined,
      rankPrevPatch: Number(stat.positionRankPrevPatch) || undefined,
      rankDelta: computedRankDelta,
      sortIndex,
      tier,
      counters,
    }

    const key = `${source}-${heroId || statKey}-${role}`
    const existing = championByRole.get(key)
    if (!existing || champion.pickRate > existing.pickRate) {
      championByRole.set(key, champion)
    }
  })

  return Array.from(championByRole.values()).sort((a, b) => {
    const roleDelta = roles.indexOf(a.role) - roles.indexOf(b.role)
    if (roleDelta !== 0) return roleDelta
    return b.pickRate - a.pickRate
  })
}

function tierFromRank(positionTier: number): Champion['tier'] {
  if (positionTier <= 0) return 'T0'
  if (positionTier === 1) return 'T1'
  if (positionTier === 2) return 'T2'
  if (positionTier === 3) return 'T3'
  return 'T4'
}

function tierFromRate(winRate: number, pickRate: number): Champion['tier'] {
  if (winRate >= 0.54 && pickRate >= 0.04) return 'T0'
  if (winRate >= 0.52 || pickRate >= 0.06) return 'T1'
  if (winRate >= 0.5 || pickRate >= 0.03) return 'T2'
  if (winRate >= 0.48) return 'T3'
  return 'T4'
}

export function normalizeTeams(teams: ApiTeam[]): Team[] {
  return teams.map((team) => {
    const wins = Number(team.gameWinCount || team.setWins || team.matchWinCount || 0)
    const total = Number(team.gameCount || team.matchCount || 0)
    const losses = Number(team.gameLossCount ?? team.setLosses ?? Math.max(total - wins, 0))
    const seconds = Number(team.timePerGameTeam || 0)
    const avgKills = Number(team.killPerGameTeam || 0)
    const avgAssists = Number(team.assistPerGameTeam || 0)
    const avgDeaths = Number(team.deathPerGameTeam || 0)

    return {
      id: Number(team.teamId),
      opggTeamId: team.opggTeamId,
      name: team.teamName,
      fullName: team.fullName || team.teamFullName || team.teamName,
      acronym: team.acronym || team.teamName,
      logo: team.teamLogo || team.opggLogo,
      rank: Number(team.rank) || undefined,
      wins,
      losses,
      winRate: Number(team.winningRate ?? (total ? wins / total : 0)),
      recent: [],
      avgGameTime: seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : undefined,
      avgKills,
      avgAssists,
      avgDeaths,
      kda: avgDeaths ? (avgKills + avgAssists) / avgDeaths : undefined,
      avgTowers: team.turretDestroyPerGameTeam,
      dragonRate: team.drakeControlRate,
      baronRate: team.baronControlRate,
      dragonKills: team.drakeKillPerGameTeam,
      baronKills: team.baronKillPerGameTeam,
      firstBloodRate: team.firstBloodRateTeam ?? team.firstBloodPerGameTeam,
      firstTowerRate: team.firstTorrentRateTeam ?? team.firstTowerPerGameTeam,
      firstDragonRate: team.firstDragonControlRate,
      riftHeraldRate: team.riftHeraldControlRate,
      avgGold: team.goldPerGameTeam,
      avgDamage: team.damagePerMinuteTeam,
      avgDamageTaken: team.damageTakenPerMinuteTeam,
      avgCs: team.creepScorePerGameTeam,
      avgWardsPlaced: team.wardPlacedPerGameTeam,
      avgWardsKilled: team.wardKilledPerGameTeam,
      totalKills: team.totalKills,
      totalDeaths: team.totalDeath,
      assists: team.totalAssists,
      matchWinRate: team.matchWinningRate,
      points: team.points,
      standingPosition: team.standingPosition,
      previousStandingPosition: team.previousStandingPosition,
      scheduledMatches: team.scheduledMatches,
      finishedMatches: team.finishedMatches,
      recentMatches: team.recentMatches,
      upcomingMatches: team.upcomingMatches,
      recentMatchesAll: team.recentMatchesAll,
      upcomingMatchesAll: team.upcomingMatchesAll,
      roster: team.roster,
      leagueHeroStats: team.leagueHeroStats,
      standings: team.standings,
      source: team.source,
      foundedAt: team.foundedAt,
      website: team.website,
      twitter: team.twitter,
    }
  })
}

export function normalizePlayers(players: ApiPlayer[]): Player[] {
  return players.map((player) => {
    const role = opggPositionToRole[String(player.playerLocation || '').toUpperCase()] || 'MID'
    const games = Number(player.games || player.boCount || 0)
    const teamId = Number(player.teamId)
    return {
      id: Number(player.playerId),
      name: player.playerName,
      realName: player.realName,
      team: player.teamName,
      teamId: Number.isFinite(teamId) ? teamId : 0,
      teamFullName: player.teamFullName,
      teamLogo: player.teamLogo,
      opggTeamId: player.opggTeamId,
      opggTeamLogo: player.opggTeamLogo,
      role,
      avatar: player.playerAvatar,
      opggAvatar: player.opggAvatar,
      kda: Number(player.kda || 0),
      avgDamage: Number(player.damagePerMinute || 0),
      avgDamageTaken: Number(player.damageTakenPerMinute || 0),
      goldPerMinute: Number(player.goldPerMinute || 0),
      avgVision: Number(player.visionScorePerGame || player.wardPlacedPerGame || 0),
      winRate: Number(player.winRate || 0),
      games,
      wins: Number(player.wins || 0),
      losses: Number(player.loses || 0),
      matchCount: Number(player.matchCount || 0),
      kills: Number(player.totalKills || 0),
      assists: Number(player.totalAssists || 0),
      deaths: Number(player.totalDeath || 0),
      mvpCount: Number(player.mvpCount || 0),
      mvpVotes: Number(player.mvpVotes || 0),
      killParticipation: Number(player.killParticipantPercent || 0),
      damageShare: Number(player.damagePercent || 0),
      damageTakenShare: Number(player.damageTakenPercent || 0),
      goldShare: Number(player.goldPercent || 0),
      damagePerGold: Number(player.damagePerGold || 0),
      csPerGame: Number(player.creepScorePerGame || 0),
      csPerMinute: Number(player.creepScorePerMinute || 0),
      wardPlacedPerGame: Number(player.wardPlacedPerGame || 0),
      wardKilledPerGame: Number(player.wardKilledPerGame || 0),
      firstBloodPerGame: Number(player.firstBloodPerGame || 0),
      firstTowerPerGame: Number(player.firstTowerPerGame || 0),
      goldPerGame: Number(player.goldPerGame || 0),
      goldGapPerGame: Number(player.goldGapPerGame || 0),
      visionScoreGapPerGame: Number(player.visionScoreGapPerGame || 0),
      nationality: player.nationality,
      birthday: player.birthday,
      source: player.source,
      opScore: Number(player.opScore || 0),
      opScoreGrade: player.opScoreGrade,
      opggPlayerId: player.opggPlayerId,
      opggTournamentId: player.opggTournamentId,
      stream: player.stream,
      youtube: player.youtube,
      twitter: player.twitter,
      facebook: player.facebook,
      instagram: player.instagram,
      discord: player.discord,
      championPool: (player.championPool || []).map((champion) => ({
        champion: champion.heroCnName || champion.heroName || String(champion.heroId || ''),
        imageUrl: champion.heroLogo,
        games: Number(champion.pickCount || 0),
        winRate: Number(champion.winRate || 0),
        pickRate: Number(champion.pickRate || 0),
        banRate: Number(champion.banRate || 0),
        bpRate: Number(champion.bpRate || 0),
        kda: Number(champion.kda || 0),
      })),
      recentMatches: [],
    }
  })
}

export function getLaneWinRate(
  laneStats: HeroLaneStats,
  heroId: number | undefined,
  role: Role
) {
  if (!heroId) return 0.5
  const stats = laneStats[String(heroId)]
  return stats?.[roleToLane[role]] ?? 0.5
}
