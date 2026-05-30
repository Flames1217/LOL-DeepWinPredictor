// 英雄类型
export interface Champion {
  id: string
  heroId?: number
  name: string
  en: string
  keywords?: string
  dataSource?: 'global' | 'cn'
  sourceLabel?: string
  role: 'TOP' | 'JUN' | 'MID' | 'ADC' | 'SUP'
  imageUrl?: string
  banRate: number
  pickRate: number
  presenceRate?: number
  roleRate?: number
  winRate: number
  winRateDelta?: number
  games: number
  rank?: number
  rankPrev?: number
  rankPrevPatch?: number
  rankDelta?: number
  sortIndex?: number
  tier?: 'T0' | 'T1' | 'T2' | 'T3' | 'T4'
  counters?: ChampionCounter[]
}

export interface ChampionCounter {
  heroId?: number
  name: string
  en?: string
  imageUrl?: string
  winRate?: number
  games?: number
  wins?: number
}

export interface ChampionDetailEntry {
  id?: number
  name: string
  imageUrl?: string
}

export interface ChampionDetailBuildRow {
  entries: ChampionDetailEntry[]
  pickRate?: number
  winRate?: number
  play?: number
}

export interface ChampionDetailRune {
  id?: number
  name: string
  image_url?: string
  isActive?: boolean
}

export interface ChampionDetailRunePage {
  id?: number
  play?: number
  pick_rate?: number
  win_rate?: number
  primary_perk_style?: ChampionDetailRune
  perk_sub_style?: ChampionDetailRune
  primary_rune?: ChampionDetailRune
  builds?: {
    main_runes?: ChampionDetailRune[][]
    sub_runes?: ChampionDetailRune[][]
    primary_perk_style?: ChampionDetailRune
    perk_sub_style?: ChampionDetailRune
  }[]
}

export interface ChampionDetailSkill {
  key: string
  name: string
  image_url?: string
  video_url?: string
}

export interface ChampionDetailPassive {
  name?: string
  description?: string
  image_url?: string
  video_url?: string
}

export interface ChampionDetailCounter {
  play?: number
  win?: number
  win_rate?: number
  champion: {
    image_url?: string
    name: string
    key: string
  }
}

export interface ChampionDetail {
  source?: string
  champion: string
  position: string
  region?: string
  tier?: string
  patch?: string | null
  fetchedAt?: string
  cacheFallback?: boolean
  targetChampion?: string | null
  matchupBuild?: boolean
  laneStats?: Record<string, string | number | null | undefined>
  counters: ChampionDetailCounter[]
  runePages: ChampionDetailRunePage[]
  summonerSpells: ChampionDetailBuildRow[]
  items: {
    starterItems: ChampionDetailBuildRow[]
    boots: ChampionDetailBuildRow[]
    coreItems: ChampionDetailBuildRow[]
    itemStats?: ChampionDetailBuildRow[]
  }
  skills: ChampionDetailSkill[]
  passive?: ChampionDetailPassive | null
  skillOrder?: string[]
  skillBuilds?: {
    order?: string[]
    pickRate?: number
    winRate?: number
    levelOrders?: {
      order?: string[]
      pickRate?: number
      winRate?: number
    }[]
  }[]
  dataCompleteness?: Record<string, number | boolean>
}

// 战队类型
export interface Team {
  id: number
  opggTeamId?: string | number
  name: string
  fullName: string
  acronym?: string
  logo?: string
  rank?: number
  wins: number
  losses: number
  winRate: number
  recent: ('W' | 'L')[]
  avgGameTime?: string
  avgKills?: number
  avgTowers?: number
  dragonRate?: number
  baronRate?: number
  style?: string[]
  favoriteChampions?: string[]
  totalKills?: number
  totalDeaths?: number
  assists?: number
  avgAssists?: number
  avgDeaths?: number
  kda?: number
  avgGold?: number
  avgDamage?: number
  avgDamageTaken?: number
  avgCs?: number
  avgWardsPlaced?: number
  avgWardsKilled?: number
  firstBloodRate?: number
  firstTowerRate?: number
  firstDragonRate?: number
  riftHeraldRate?: number
  dragonKills?: number
  baronKills?: number
  matchWinRate?: number
  points?: number
  standingPosition?: number
  previousStandingPosition?: number
  scheduledMatches?: number
  finishedMatches?: number
  recentMatches?: TeamMatch[]
  upcomingMatches?: TeamMatch[]
  roster?: PlayerRosterEntry[]
  leagueHeroStats?: ProChampionStat[]
  standings?: Record<string, unknown>[]
  recentMatchesAll?: TeamMatch[]
  upcomingMatchesAll?: TeamMatch[]
  source?: string
  foundedAt?: string
  website?: string
  twitter?: string
}

export interface PlayerRosterEntry {
  playerId?: string | number
  playerName?: string
  playerLocation?: string
  playerAvatar?: string
  kda?: number
  games?: number
  winRate?: number
  championPool?: ProChampionStat[]
}

export interface ProChampionStat {
  heroId?: string | number
  heroName?: string
  heroCnName?: string
  heroCnTitle?: string
  heroLogo?: string
  heroLocation?: string[]
  pickCount?: number
  pickRate?: number
  banCount?: number
  banRate?: number
  bpCount?: number
  bpRate?: number
  wins?: number
  winRate?: number
  kda?: number
  mostUsePlayerId?: string | number
  mostUsePlayerName?: string
}

export interface TeamMatchSide {
  id?: string | number
  name?: string
  acronym?: string
  logo?: string
}

export interface TeamMatch {
  id?: string | number
  name?: string
  status?: string
  beginAt?: string | null
  endAt?: string | null
  scheduledAt?: string | null
  homeScore?: number | string | null
  awayScore?: number | string | null
  homeTeam?: TeamMatchSide
  awayTeam?: TeamMatchSide
  winnerTeam?: TeamMatchSide | null
  tournament?: {
    id?: string | number
    name?: string
    beginAt?: string | null
    endAt?: string | null
  }
}

// 选手类型
export interface Player {
  id: number
  name: string
  realName?: string
  team: string
  teamId: number
  teamFullName?: string
  teamLogo?: string
  opggTeamId?: string | number
  opggTeamLogo?: string
  role: 'TOP' | 'JUN' | 'MID' | 'ADC' | 'SUP'
  avatar?: string
  opggAvatar?: string
  kda: number
  avgDamage: number
  avgDamageTaken?: number
  goldPerMinute?: number
  avgVision: number
  winRate: number
  games?: number
  wins?: number
  losses?: number
  matchCount?: number
  kills?: number
  assists?: number
  deaths?: number
  mvpCount?: number
  mvpVotes?: number
  killParticipation?: number
  damageShare?: number
  goldShare?: number
  damageTakenShare?: number
  damagePerGold?: number
  csPerMinute?: number
  csPerGame?: number
  wardPlacedPerGame?: number
  wardKilledPerGame?: number
  firstBloodPerGame?: number
  firstTowerPerGame?: number
  goldPerGame?: number
  goldGapPerGame?: number
  visionScoreGapPerGame?: number
  nationality?: string
  birthday?: string
  source?: string
  opScore?: number
  opScoreGrade?: string
  opggPlayerId?: string | number
  opggTournamentId?: string | number
  stream?: string
  youtube?: string
  twitter?: string
  facebook?: string
  instagram?: string
  discord?: string
  championPool: {
    champion: string
    imageUrl?: string
    games: number
    winRate: number
    pickRate?: number
    banRate?: number
    bpRate?: number
    kda?: number
  }[]
  recentMatches?: {
    champion: string
    kda: string
    result: 'W' | 'L'
    opponent: string
    date: string
  }[]
}

// 赛程类型
export interface Match {
  id: number
  time: string
  teamA: string
  teamALogo?: string
  teamB: string
  teamBLogo?: string
  stage: string
  scoreA?: number
  scoreB?: number
  winner?: 'A' | 'B'
  games?: MatchGame[]
}

export interface MatchGame {
  gameNumber: number
  blueTeam: string
  redTeam: string
  bluePicks: string[]
  redPicks: string[]
  blueBans: string[]
  redBans: string[]
  winner: 'blue' | 'red'
  mvp?: string
  duration: string
}

// 预测结果类型
export interface PredictionResult {
  blueWinRate: number
  redWinRate: number
  championWeights: {
    champion: string
    team: 'blue' | 'red'
    weight: number
  }[]
  method?: string
  modelRate?: number
  priorRate?: number
  calibratedRate?: number
  confidence?: 'low' | 'medium' | 'high'
  explanation?: string
}

// 位置类型
export type Role = 'TOP' | 'JUN' | 'MID' | 'ADC' | 'SUP'

// 阵容选择状态
export interface TeamComposition {
  TOP: string | null
  JUN: string | null
  MID: string | null
  ADC: string | null
  SUP: string | null
  bans: (string | null)[]
}
