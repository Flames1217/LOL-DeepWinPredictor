'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, Loader2, PlugZap, Save, ShieldCheck, TestTube2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  fetchAiPredictionConfig,
  saveAiPredictionConfig,
  testAiProvider,
  type ApiAiPredictionConfig,
  type ApiPredictionAnalysis,
} from '@/lib/api'

const providerOptions = [
  { value: 'disabled', label: '关闭' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'deepseek', label: 'DeepSeek / 兼容接口' },
  { value: 'qwen', label: '通义千问 / 兼容接口' },
  { value: 'ollama', label: 'Ollama 本地' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export default function AiProviderPage() {
  const [config, setConfig] = useState<ApiAiPredictionConfig | null>(null)
  const [provider, setProvider] = useState('disabled')
  const [enabled, setEnabled] = useState(true)
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [clearApiKey, setClearApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')
  const [analysis, setAnalysis] = useState<ApiPredictionAnalysis | null>(null)

  useEffect(() => {
    fetchAiPredictionConfig().then((payload) => {
      setConfig(payload)
      setProvider(payload.provider || 'disabled')
      setEnabled(payload.enabled)
      setModel(payload.model || '')
      setBaseUrl(payload.baseUrl || '')
    })
  }, [])

  async function saveConfig() {
    setSaving(true)
    setMessage('')
    try {
      const payload = await saveAiPredictionConfig({ enabled, provider, model, baseUrl, apiKey, clearApiKey })
      setConfig(payload)
      setApiKey('')
      setClearApiKey(false)
      setMessage('配置已保存')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function runTest() {
    setTesting(true)
    setAnalysis(null)
    setMessage('')
    try {
      setAnalysis(await testAiProvider({ A_win: 53, B_win: 47 }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '测试失败')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">AI 提供商</h1>
          <p className="mt-2 text-sm text-muted-foreground">配置 Base URL、API Key 和模型，供预测解释与提示词分析使用。</p>
        </div>
        <Badge className={config?.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-muted text-muted-foreground'}>
          {config?.enabled ? '已启用' : '未启用'}
        </Badge>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="space-y-5 border-border p-5">
          <div className="flex items-center gap-2">
            <PlugZap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">连接配置</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Provider">
              <select value={provider} onChange={(event) => setProvider(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                {providerOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Model">
              <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="例如 gpt-4.1-mini / deepseek-chat / qwen-plus" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" />
            </Field>
            <Field label="Base URL">
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" />
            </Field>
            <Field label="API Key">
              <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={config?.hasApiKey ? config.maskedApiKey || '已保存' : '未保存'} type="password" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2 text-muted-foreground">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              启用 AI 分析
            </label>
            <label className="inline-flex items-center gap-2 text-muted-foreground">
              <input type="checkbox" checked={clearApiKey} onChange={(event) => setClearApiKey(event.target.checked)} />
              清空已保存 Key
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存配置
            </Button>
            <Button variant="outline" onClick={runTest} disabled={testing}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube2 className="mr-2 h-4 w-4" />}
              测试连接
            </Button>
          </div>

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </Card>

        <Card className="space-y-4 border-border p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">当前状态</h2>
          </div>
          <div className="grid gap-3 text-sm">
            <p className="flex justify-between gap-3"><span className="text-muted-foreground">Provider</span><strong>{config?.provider || '-'}</strong></p>
            <p className="flex justify-between gap-3"><span className="text-muted-foreground">Model</span><strong>{config?.model || '-'}</strong></p>
            <p className="flex justify-between gap-3"><span className="text-muted-foreground">Base URL</span><strong>{config?.baseUrlConfigured ? '已配置' : '未配置'}</strong></p>
            <p className="flex justify-between gap-3"><span className="text-muted-foreground">API Key</span><strong>{config?.hasApiKey ? config.maskedApiKey : '未保存'}</strong></p>
          </div>
          <p className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            Key 仅保存在本地配置文件中，接口不会回显明文。AI 只负责解释，最终胜率仍由本地模型和校准逻辑给出。
          </p>
        </Card>
      </div>

      {analysis ? (
        <Card className="border-primary/30 bg-primary/10 p-5">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">测试结果</h2>
          </div>
          <p className="text-sm text-foreground">{analysis.summary || '已返回响应'}</p>
          {analysis.error ? <p className="mt-2 text-xs text-destructive">{analysis.error}</p> : null}
        </Card>
      ) : null}
    </div>
  )
}
