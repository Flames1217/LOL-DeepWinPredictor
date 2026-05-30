'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  duration?: number
  className?: string
}

export function AnimatedCounter({ value, duration = 2000, className }: AnimatedCounterProps) {
  const [count, setCount] = useState(0)
  const countRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    countRef.current = 0
    startTimeRef.current = null

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp
      }

      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1)
      const easeProgress = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      const currentCount = Math.floor(easeProgress * value)

      if (currentCount !== countRef.current) {
        countRef.current = currentCount
        setCount(currentCount)
      }

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setCount(value)
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return (
    <motion.span
      key={count}
      initial={{ opacity: 0.8, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      {count.toLocaleString()}
    </motion.span>
  )
}

interface WinRateRingProps {
  percentage: number
  color: 'blue' | 'red'
  size?: number
  strokeWidth?: number
  label?: string
  animate?: boolean
}

export function WinRateRing({
  percentage,
  color,
  size = 160,
  strokeWidth = 12,
  label,
  animate = true,
}: WinRateRingProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (animatedPercentage / 100) * circumference

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => {
        setAnimatedPercentage(percentage)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setAnimatedPercentage(percentage)
    }
  }, [percentage, animate])

  const colors = {
    blue: {
      stroke: '#0BC4E3',
      glow: 'rgba(11, 196, 227, 0.4)',
      bg: 'rgba(11, 196, 227, 0.1)',
    },
    red: {
      stroke: '#E84057',
      glow: 'rgba(232, 64, 87, 0.4)',
      bg: 'rgba(232, 64, 87, 0.1)',
    },
  }

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors[color].bg}
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors[color].stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            filter: `drop-shadow(0 0 8px ${colors[color].glow})`,
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold"
          style={{ color: colors[color].stroke }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {animatedPercentage.toFixed(1)}%
        </motion.span>
        {label && (
          <span className="text-sm text-muted-foreground mt-1">{label}</span>
        )}
      </div>
    </div>
  )
}

interface DualWinRateProps {
  blueWinRate: number
  redWinRate: number
  blueLabel?: string
  redLabel?: string
}

export function DualWinRateDisplay({
  blueWinRate,
  redWinRate,
  blueLabel = '蓝方',
  redLabel = '红方',
}: DualWinRateProps) {
  const winner = blueWinRate > redWinRate ? 'blue' : 'red'

  return (
    <div className="flex items-center justify-center gap-8 lg:gap-16">
      <motion.div
        className="flex flex-col items-center"
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <WinRateRing
          percentage={blueWinRate * 100}
          color="blue"
          label={blueLabel}
        />
        {winner === 'blue' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, type: 'spring' }}
            className="mt-4 px-4 py-1 bg-primary/20 border border-primary rounded-full"
          >
            <span className="text-sm font-medium text-primary">预测胜出</span>
          </motion.div>
        )}
      </motion.div>

      <motion.div
        className="text-4xl font-bold text-muted-foreground"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3 }}
      >
        VS
      </motion.div>

      <motion.div
        className="flex flex-col items-center"
        initial={{ x: 50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <WinRateRing
          percentage={redWinRate * 100}
          color="red"
          label={redLabel}
        />
        {winner === 'red' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, type: 'spring' }}
            className="mt-4 px-4 py-1 bg-destructive/20 border border-destructive rounded-full"
          >
            <span className="text-sm font-medium text-destructive">预测胜出</span>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
