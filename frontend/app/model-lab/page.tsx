'use client'

import { useEffect, useState } from 'react'
import { BrainCircuit, FlaskConical, Loader2, RefreshCw, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fetchModelDiagnostics } from '@/lib/api'

type AnyRecord = Record<string, unknown>

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

export default function ModelLabPage() {
  const [diagnostics, setDiagnostics] = useState<AnyRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setDiagnostics(await fetchModelDiagnostics())
    } catch (err) {
      setError(err instanceof Error ? err.message : '模型诊断加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const calibration = asRecord(diagnostics?.calibration)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">模型实验室</h1>
          <p className="mt-2 text-sm text-muted-foreground">查看当前 BiLSTM、校准策略、过拟合风险和后续训练路线。</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          刷新诊断
        </Button>
      </header>

      {error ? <Card className="border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</Card> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><BrainCircuit className="h-4 w-4" />模型状态</div>
          <p className="mt-3 text-2xl font-bold">{diagnostics?.modelLoaded ? '已加载' : '未加载'}</p>
        </Card>
        <Card className="border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><FlaskConical className="h-4 w-4" />输入维度</div>
          <p className="mt-3 text-2xl font-bold">{String(diagnostics?.vectorFields ?? '-')}</p>
        </Card>
        <Card className="border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><TrendingUp className="h-4 w-4" />输出策略</div>
          <p className="mt-3 text-2xl font-bold">校准概率</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3 border-border p-5">
          <h2 className="text-lg font-semibold">校准策略</h2>
          <pre className="max-h-72 overflow-auto rounded-md bg-background/70 p-3 text-xs text-muted-foreground">{JSON.stringify(calibration, null, 2)}</pre>
        </Card>
        <Card className="space-y-3 border-border p-5">
          <h2 className="text-lg font-semibold">实时预测输入形态</h2>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <p>赛前：阵容、队伍强度、英雄分路胜率、选手英雄池。</p>
            <p>进行中：时间、经济差、人头差、塔、小龙、大龙、先锋、巢虫、装备差、等级差、视野。</p>
            <p>AI：只解释概率变化，不直接决定概率。</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3 border-border p-5">
          <h2 className="text-lg font-semibold">已知问题</h2>
          <div className="space-y-2">
            {asList(diagnostics?.knownIssues).map((item) => <Badge key={item} variant="outline" className="mr-2 whitespace-normal text-left">{item}</Badge>)}
          </div>
        </Card>
        <Card className="space-y-3 border-border p-5">
          <h2 className="text-lg font-semibold">下一步训练路线</h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            {asList(diagnostics?.nextSteps).map((item, index) => <li key={item}>{index + 1}. {item}</li>)}
          </ol>
        </Card>
      </div>
    </div>
  )
}
