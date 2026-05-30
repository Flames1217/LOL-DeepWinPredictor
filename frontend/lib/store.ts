import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ApiPredictionAnalysis } from './api'
import type { Champion, Role, Team, TeamComposition } from './types'

interface PredictionResult {
  blueWinRate: number
  redWinRate: number
  championWeights: { champion: string; team: 'blue' | 'red'; weight: number }[]
  method?: string
  modelRate?: number
  priorRate?: number
  calibratedRate?: number
  confidence?: 'low' | 'medium' | 'high'
  explanation?: string
  aiAnalysis?: ApiPredictionAnalysis
}

interface AppState {
  blueTeam: TeamComposition
  redTeam: TeamComposition
  blueTeamName: string
  redTeamName: string
  isPredicting: boolean
  predictionResult: PredictionResult | null
  visitCount: number
  visitorCount: number
  champions: Champion[]
  teams: Team[]

  setBlueChampion: (role: Role, champion: string | null) => void
  setRedChampion: (role: Role, champion: string | null) => void
  setBlueBan: (index: number, champion: string | null) => void
  setRedBan: (index: number, champion: string | null) => void
  setBlueTeamName: (name: string) => void
  setRedTeamName: (name: string) => void
  setIsPredicting: (value: boolean) => void
  setPredictionResult: (result: PredictionResult | null) => void
  setSiteStats: (visitCount: number, visitorCount: number) => void
  setChampions: (champions: Champion[]) => void
  setTeams: (teams: Team[]) => void
  resetTeams: () => void
  isTeamComplete: () => boolean
  getAllSelectedChampions: () => string[]
}

const initialTeamComposition: TeamComposition = {
  TOP: null,
  JUN: null,
  MID: null,
  ADC: null,
  SUP: null,
  bans: [null, null, null, null, null],
}

const createEmptyTeam = () => ({
  ...initialTeamComposition,
  bans: [...initialTeamComposition.bans],
})

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      blueTeam: createEmptyTeam(),
      redTeam: createEmptyTeam(),
      blueTeamName: '蓝方',
      redTeamName: '红方',
      isPredicting: false,
      predictionResult: null,
      visitCount: 0,
      visitorCount: 0,
      champions: [],
      teams: [],

      setBlueChampion: (role, champion) => set((state) => ({
        blueTeam: { ...state.blueTeam, [role]: champion },
        predictionResult: null,
      })),

      setRedChampion: (role, champion) => set((state) => ({
        redTeam: { ...state.redTeam, [role]: champion },
        predictionResult: null,
      })),

      setBlueBan: (index, champion) => set((state) => {
        const bans = [...state.blueTeam.bans]
        bans[index] = champion
        return {
          blueTeam: { ...state.blueTeam, bans },
          predictionResult: null,
        }
      }),

      setRedBan: (index, champion) => set((state) => {
        const bans = [...state.redTeam.bans]
        bans[index] = champion
        return {
          redTeam: { ...state.redTeam, bans },
          predictionResult: null,
        }
      }),

      setBlueTeamName: (name) => set({ blueTeamName: name, predictionResult: null }),
      setRedTeamName: (name) => set({ redTeamName: name, predictionResult: null }),
      setIsPredicting: (value) => set({ isPredicting: value }),
      setPredictionResult: (result) => set({ predictionResult: result }),
      setSiteStats: (visitCount, visitorCount) => set({ visitCount, visitorCount }),
      setChampions: (champions) => set({ champions }),
      setTeams: (teams) => set({ teams }),

      resetTeams: () => set({
        blueTeam: createEmptyTeam(),
        redTeam: createEmptyTeam(),
        blueTeamName: '蓝方',
        redTeamName: '红方',
        predictionResult: null,
      }),

      isTeamComplete: () => {
        const state = get()
        const blueComplete = Object.entries(state.blueTeam)
          .filter(([key]) => key !== 'bans')
          .every(([, value]) => value !== null)
        const redComplete = Object.entries(state.redTeam)
          .filter(([key]) => key !== 'bans')
          .every(([, value]) => value !== null)
        return blueComplete && redComplete
      },

      getAllSelectedChampions: () => {
        const state = get()
        const champions: string[] = []

        Object.entries(state.blueTeam).forEach(([key, value]) => {
          if (key !== 'bans' && value) champions.push(value as string)
        })
        Object.entries(state.redTeam).forEach(([key, value]) => {
          if (key !== 'bans' && value) champions.push(value as string)
        })
        state.blueTeam.bans.forEach((ban) => {
          if (ban) champions.push(ban)
        })
        state.redTeam.bans.forEach((ban) => {
          if (ban) champions.push(ban)
        })

        return champions
      },
    }),
    {
      name: 'lol-deepwin-lineup',
      version: 1,
      partialize: (state) => ({
        blueTeam: state.blueTeam,
        redTeam: state.redTeam,
        blueTeamName: state.blueTeamName,
        redTeamName: state.redTeamName,
        predictionResult: state.predictionResult,
      }),
    }
  )
)
