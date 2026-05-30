'use client'

import { useEffect, useState } from 'react'
import { Activity, Loader2, Play, Radar, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  fetchLplLiveCandidates,
  runLplLiveProbe,
  type ApiLiveProbeCandidate,
  type ApiLiveProbeResponse,
} from '@/lib/api'

function teamName(team?: ApiLiveProbeCandidate['homeTeam']) {
  return team?.acronym || team?.name || 'TBD'
}

function timeText(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

export default function LiveLplPage() {
  const [candidates, setCandidates] = useState<ApiLiveProbeCandidate[]>([])
  const [matchId, setMatchId] = useState('')
  const [probe, setProbe] = useState<ApiLiveProbeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [probing, setProbing] = useState(false)
  const [error, setError] = useState('')

  async function loadCandidates() {
    setLoading(true)
    setError('')
    try {
      const payload = await fetchLplLiveCandidates(12)
      setCandidates(payload.data || [])
      if (!matchId && payload.data?.[0]?.matchId) setMatchId(String(payload.data[0].matchId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '候选比赛加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function runProbe(save = true) {
    setProbing(true)
    setError('')
    try {
      setProbe(await runLplLiveProbe({ matchId, save }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '探针运行失败')
    } finally {
      setProbing(false)
    }
  }

  useEffect(() => {
    loadCandidates()
  }, [])

  const liveChanges = (probe?.changedFields || []).filter((item) => item.liveHint)
  const compact = probe?.compact as Record<string, unknown> | undefined
  const games = Array.isArray(compact?.games) ? compact.games as Array<Record<string, unknown>> : []

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">LPL 实时探针</h1>
          <p className="mt-2 text-sm text-muted-foreground">轮询 LPL 官方比赛详情，验证经济、人头、资源、装备等字段是否实时变化。</p>
        </div>
        <Button variant="outline" onClick={loadCandidates} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          刷新候选
        </Button>
      </header>

      {error ? <Card className="border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</Card> : null}

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="space-y-4 border-border p-4">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">候选比赛</h2>
          </div>
          <div className="space-y-2">
            {candidates.map((match) => (
              <button
                key={String(match.matchId)}
                onClick={() => setMatchId(String(match.matchId))}
                className={`w-full rounded-md border p-3 text-left text-sm transition ${String(match.matchId) === matchId ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/20'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong>{teamName(match.homeTeam)} vs {teamName(match.awayTeam)}</strong>
                  <Badge variant="outline">{match.statusLabel || match.status || '-'}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{timeText(match.time)} · ID {match.matchId}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 border-border p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 space-y-2">
              <span className="text-sm text-muted-foreground">Match ID</span>
              <input value={matchId} onChange={(event) => setMatchId(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" />
            </label>
            <Button onClick={() => runProbe(true)} disabled={probing || !matchId}>
              {probing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              运行探针
            </Button>
          </div>

          {probe ? (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">检查时间</p>
                <p className="mt-1 text-sm font-semibold">{probe.checkedAt || '-'}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">字段总数</p>
                <p className="mt-1 text-sm font-semibold">{probe.inventory?.totalFields ?? '-'}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">实时候选字段</p>
                <p className="mt-1 text-sm font-semibold">{probe.inventory?.candidateLiveFieldCount ?? '-'}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">本次变化</p>
                <p className="mt-1 text-sm font-semibold">{probe.changedFieldCount ?? 0}</p>
              </div>
            </div>
          ) : null}

          {games.length ? (
            <div className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">紧凑比赛状态</h3>
              </div>
              <pre className="max-h-80 overflow-auto rounded bg-background/70 p-3 text-xs text-muted-foreground">{JSON.stringify({ ...compact, games: games.slice(0, 1) }, null, 2)}</pre>
            </div>
          ) : null}

          {liveChanges.length ? (
            <div className="rounded-md border border-primary/30 bg-primary/10 p-3">
              <h3 className="mb-2 font-semibold">实时字段变化</h3>
              <div className="max-h-72 space-y-2 overflow-auto">
                {liveChanges.slice(0, 30).map((item) => (
                  <div key={item.path} className="rounded border border-border bg-card p-2 text-xs">
                    <p className="font-mono text-primary">{item.path}</p>
                    <p className="text-muted-foreground">{String(item.before)} → {String(item.after)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : probe ? (
            <p className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">暂无变化。赛前或赛后静态状态通常不会变化，比赛进行中需要持续轮询观察。</p>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
