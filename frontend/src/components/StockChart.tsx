import { useEffect, useRef, useCallback } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts'
import type { ApiStockDaily, ApiSetup } from '@/types'

interface StockChartProps {
  dailyBars: ApiStockDaily[]
  spyBars?: ApiStockDaily[]
  setups?: ApiSetup[]
  height?: number
  showMAs?: boolean
  showSpy?: boolean
}

// MA line configs
const MA_LINES = [
  { key: 'ema6' as const, color: '#8b5cf6', width: 1, label: 'EMA 6' },
  { key: 'ema20' as const, color: '#f59e0b', width: 1, label: 'EMA 20' },
  { key: 'sma50' as const, color: '#3b82f6', width: 1.5, label: 'SMA 50' },
  { key: 'sma150' as const, color: '#14b8a6', width: 1, label: 'SMA 150' },
  { key: 'sma200' as const, color: '#ef4444', width: 1.5, label: 'SMA 200' },
] as const

type MaKey = (typeof MA_LINES)[number]['key']

function toChartDate(dateStr: string): string {
  // Convert ISO date to YYYY-MM-DD for lightweight-charts
  return dateStr.slice(0, 10)
}

export function StockChart({
  dailyBars,
  spyBars,
  setups,
  height = 360,
  showMAs = true,
  showSpy = false,
}: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickRef = useRef<ISeriesApi<typeof CandlestickSeries> | null>(null)
  const maSeriesRef = useRef<Map<string, ISeriesApi<typeof LineSeries>>>(new Map())

  // Sort bars by date ascending (backend sends desc)
  const sortedBars = dailyBars.toSorted((a, b) => a.date.localeCompare(b.date))

  const initChart = useCallback(() => {
    if (!containerRef.current || sortedBars.length === 0) return

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      candlestickRef.current = null
      maSeriesRef.current.clear()
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontFamily: '"DM Sans", sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(139,92,246,0.3)', labelBackgroundColor: '#1e1b4b' },
        horzLine: { color: 'rgba(139,92,246,0.3)', labelBackgroundColor: '#1e1b4b' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.1, bottom: 0.15 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: false,
      },
      width: containerRef.current.clientWidth,
      height,
    })

    chartRef.current = chart

    // Candlestick series (v5 API)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    candleSeries.setData(
      sortedBars.map((bar) => ({
        time: toChartDate(bar.date),
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
      })),
    )

    candlestickRef.current = candleSeries

    // Volume histogram (v5 API)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    volumeSeries.setData(
      sortedBars.map((bar) => ({
        time: toChartDate(bar.date),
        value: Number(bar.volume),
        color: Number(bar.close) >= Number(bar.open) ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
      })),
    )

    // MA overlay lines
    if (showMAs) {
      for (const ma of MA_LINES) {
        const maData = sortedBars
          .filter((bar) => bar[ma.key] != null)
          .map((bar) => ({
            time: toChartDate(bar.date),
            value: Number(bar[ma.key]),
          }))

        if (maData.length > 0) {
          const lineSeries = chart.addSeries(LineSeries, {
            color: ma.color,
            lineWidth: ma.width as 1 | 2 | 3 | 4,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          })
          lineSeries.setData(maData)
          maSeriesRef.current.set(ma.key, lineSeries)
        }
      }
    }

    // Setup annotation lines (horizontal price levels)
    if (setups && setups.length > 0) {
      for (const setup of setups) {
        if (setup.pivotPrice != null) {
          candleSeries.createPriceLine({
            price: Number(setup.pivotPrice),
            color: '#8b5cf6',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `Pivot (${setup.type})`,
          })
        }
        if (setup.stopPrice != null) {
          candleSeries.createPriceLine({
            price: Number(setup.stopPrice),
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: 'Stop',
          })
        }
        if (setup.targetPrice != null) {
          candleSeries.createPriceLine({
            price: Number(setup.targetPrice),
            color: '#22c55e',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: 'Target',
          })
        }
      }
    }

    // Fit content
    chart.timeScale().fitContent()
  }, [sortedBars, setups, showMAs, height])

  // Init chart on mount or data change
  useEffect(() => {
    initChart()
  }, [initChart])

  // Handle resize
  useEffect(() => {
    if (!containerRef.current || !chartRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        chartRef.current?.applyOptions({ width })
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [])

  if (sortedBars.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border-muted bg-bg-elevated"
        style={{ height }}
      >
        <span className="text-xs text-text-muted sm:text-sm">No chart data available</span>
      </div>
    )
  }

  return <div ref={containerRef} className="w-full rounded-lg" style={{ height }} />
}
