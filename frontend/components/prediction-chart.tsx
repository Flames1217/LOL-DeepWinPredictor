'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts'
import { mockChampions, getChampionImageUrl } from '@/lib/mock-data'
import Image from 'next/image'
import type { Champion } from '@/lib/types'

interface ChampionWeightChartProps {
  weights: {
    champion: string
    team: 'blue' | 'red'
    weight: number
  }[]
  champions?: Champion[]
}

export function ChampionWeightChart({ weights, champions = mockChampions }: ChampionWeightChartProps) {
  const chartData = useMemo(() => {
    return weights
      .sort((a, b) => b.weight - a.weight)
      .map((w) => {
        const champion = champions.find((c) => c.en === w.champion)
        return {
          ...w,
          name: champion?.name || w.champion,
          imageUrl: champion?.imageUrl || getChampionImageUrl(w.champion),
          displayWeight: (w.weight * 100).toFixed(1),
        }
      })
  }, [champions, weights])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-card rounded-lg border border-border p-4"
    >
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        BiLSTM 注意力权重分析
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        各英雄对预测结果的贡献度
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 80, bottom: 0 }}
          >
            <XAxis
              type="number"
              domain={[0, 0.25]}
              tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
              stroke="#8B8D91"
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#8B8D91"
              fontSize={12}
              width={70}
              tick={({ x, y, payload }) => {
                const item = chartData.find((d) => d.name === payload.value)
                return (
                  <g transform={`translate(${x},${y})`}>
                    <foreignObject x={-75} y={-12} width={70} height={24}>
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[50px]">
                          {payload.value}
                        </span>
                        {item && (
                          <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0">
                            <Image
                              src={item.imageUrl}
                              alt={item.name}
                              width={20}
                              height={20}
                              className="object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </foreignObject>
                  </g>
                )
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded overflow-hidden">
                          <Image
                            src={data.imageUrl}
                            alt={data.name}
                            width={32}
                            height={32}
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{data.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {data.team === 'blue' ? '蓝方' : '红方'}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm">
                        贡献度:{' '}
                        <span
                          className="font-bold"
                          style={{
                            color: data.team === 'blue' ? '#0BC4E3' : '#E84057',
                          }}
                        >
                          {data.displayWeight}%
                        </span>
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.team === 'blue' ? '#0BC4E3' : '#E84057'}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
