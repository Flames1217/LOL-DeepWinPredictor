import type { Champion, Match, Player, Team } from './types'

export const DDRAGON_VERSION = '14.10.1'
export const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}`

export const getChampionImageUrl = (englishName: string) =>
  `${DDRAGON_BASE}/img/champion/${englishName}.png`

export const getChampionSplashUrl = (englishName: string) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${englishName}_0.jpg`

export const mockChampions: Champion[] = [
  { id: '1', name: '艾希', en: 'Ashe', role: 'ADC', banRate: 0.12, pickRate: 0.28, winRate: 0.51, games: 120, tier: 'T2' },
  { id: '2', name: '维克托', en: 'Viktor', role: 'MID', banRate: 0.18, pickRate: 0.24, winRate: 0.52, games: 98, tier: 'T1' },
  { id: '3', name: '蕾欧娜', en: 'Leona', role: 'SUP', banRate: 0.16, pickRate: 0.23, winRate: 0.50, games: 88, tier: 'T2' },
  { id: '4', name: '赵信', en: 'XinZhao', role: 'JUN', banRate: 0.21, pickRate: 0.19, winRate: 0.49, games: 76, tier: 'T2' },
  { id: '5', name: '奥恩', en: 'Ornn', role: 'TOP', banRate: 0.25, pickRate: 0.21, winRate: 0.53, games: 86, tier: 'T1' },
  { id: '6', name: '卡莎', en: 'Kaisa', role: 'ADC', banRate: 0.31, pickRate: 0.35, winRate: 0.50, games: 132, tier: 'T1' },
  { id: '7', name: '阿狸', en: 'Ahri', role: 'MID', banRate: 0.28, pickRate: 0.27, winRate: 0.51, games: 103, tier: 'T1' },
  { id: '8', name: '塞拉斯', en: 'Sylas', role: 'MID', banRate: 0.33, pickRate: 0.22, winRate: 0.49, games: 92, tier: 'T2' },
  { id: '9', name: '烬', en: 'Jhin', role: 'ADC', banRate: 0.10, pickRate: 0.30, winRate: 0.52, games: 111, tier: 'T1' },
  { id: '10', name: '锤石', en: 'Thresh', role: 'SUP', banRate: 0.22, pickRate: 0.26, winRate: 0.50, games: 95, tier: 'T2' },
  { id: '11', name: '盲僧', en: 'LeeSin', role: 'JUN', banRate: 0.36, pickRate: 0.34, winRate: 0.48, games: 140, tier: 'T2' },
  { id: '12', name: '杰斯', en: 'Jayce', role: 'TOP', banRate: 0.27, pickRate: 0.20, winRate: 0.49, games: 82, tier: 'T2' },
]

export const mockTeams: Team[] = [
  {
    id: 1,
    name: 'BLG',
    fullName: 'Bilibili Gaming',
    wins: 12,
    losses: 4,
    winRate: 0.75,
    recent: ['W', 'W', 'L', 'W', 'W'],
    avgGameTime: '32:15',
    avgKills: 14.2,
    avgTowers: 8.5,
    dragonRate: 0.68,
    baronRate: 0.72,
    style: ['进攻', '团战'],
    favoriteChampions: ['Viktor', 'Kaisa', 'Ornn', 'LeeSin', 'Leona'],
  },
  {
    id: 2,
    name: 'JDG',
    fullName: 'JD Gaming',
    wins: 10,
    losses: 6,
    winRate: 0.625,
    recent: ['L', 'W', 'W', 'L', 'W'],
    avgGameTime: '34:28',
    avgKills: 13.1,
    avgTowers: 7.9,
    dragonRate: 0.61,
    baronRate: 0.64,
    style: ['运营', '后期'],
    favoriteChampions: ['Jayce', 'Ahri', 'Jhin', 'Thresh', 'XinZhao'],
  },
]

export const mockPlayers: Player[] = [
  {
    id: 1,
    name: 'Knight',
    team: 'BLG',
    teamId: 1,
    role: 'MID',
    kda: 8.69,
    avgDamage: 802,
    avgVision: 32,
    winRate: 0.75,
    championPool: [
      { champion: 'Viktor', games: 8, winRate: 0.75 },
      { champion: 'Ahri', games: 6, winRate: 0.67 },
    ],
  },
  {
    id: 2,
    name: 'Ruler',
    team: 'JDG',
    teamId: 2,
    role: 'ADC',
    kda: 6.12,
    avgDamage: 745,
    avgVision: 28,
    winRate: 0.63,
    championPool: [
      { champion: 'Kaisa', games: 7, winRate: 0.71 },
      { champion: 'Jhin', games: 5, winRate: 0.60 },
    ],
  },
]

export const mockSchedule: Match[] = [
  {
    id: 1,
    time: '2026-05-30T17:00:00+08:00',
    teamA: 'BLG',
    teamB: 'JDG',
    stage: 'Regular Season',
    scoreA: 0,
    scoreB: 0,
  },
]

export const mockPredict = async (
  blueTeam: string[],
  redTeam: string[],
): Promise<{
  blueWinRate: number
  redWinRate: number
  championWeights: { champion: string; team: 'blue' | 'red'; weight: number }[]
}> => {
  await new Promise((resolve) => setTimeout(resolve, 300))
  const blueWinRate = 0.5 + (Math.random() - 0.5) * 0.16
  return {
    blueWinRate,
    redWinRate: 1 - blueWinRate,
    championWeights: [
      ...blueTeam.map((champion, index) => ({
        champion,
        team: 'blue' as const,
        weight: Math.max(0.04, 0.18 - index * 0.02),
      })),
      ...redTeam.map((champion, index) => ({
        champion,
        team: 'red' as const,
        weight: Math.max(0.04, 0.18 - index * 0.02),
      })),
    ],
  }
}
