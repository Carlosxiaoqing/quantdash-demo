import React, { useState, useRef, useMemo, useEffect } from 'react';
import { KlineBar, KlineInterval, StockSymbol, IntradayMinutePoint } from '../types/stock';
import {
  Download,
  Maximize2,
  Minimize2,
  Palette,
  Loader2,
  Radio,
  Clock,
  Activity,
  Layers,
  LineChart,
  BarChart2,
  RefreshCw,
  Sparkles,
  Info,
  Flame,
  Zap,
} from 'lucide-react';
import {
  applyIncrementalBarUpdate,
  applyIncrementalMinutePoint,
  isAsharesTradingTime,
} from '../utils/klineIncremental';

interface CandleChartProps {
  stock: StockSymbol;
  bars: KlineBar[];
  minutePoints?: IntradayMinutePoint[];
  prevClose?: number;
  interval: KlineInterval;
  onChangeInterval: (interval: KlineInterval) => void;
  onOpenCode: () => void;
  isLoading?: boolean;
  latencyMs?: number;
  apiSource?: string;
  isAutoPolling?: boolean;
  onToggleAutoPolling?: () => void;
  lastUpdatedTime?: string;
  onRefreshNow?: () => void;
  isRefreshing?: boolean;
  onOpenStrategyModal?: () => void;
}

type MainOverlay = 'MA' | 'BOLL' | 'NONE';
type SubIndicator = 'VOLUME' | 'MACD' | 'RSI';
type ChartRenderStyle = 'candle' | 'line';

export const CandleChart: React.FC<CandleChartProps> = ({
  stock,
  bars,
  minutePoints = [],
  prevClose = stock.prevClose || stock.price,
  interval,
  onChangeInterval,
  onOpenCode,
  isLoading = false,
  latencyMs = 145,
  apiSource = 'QuantDash Gateway',
  isAutoPolling = true,
  onToggleAutoPolling,
  lastUpdatedTime,
  onRefreshNow,
  isRefreshing = false,
  onOpenStrategyModal,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mainOverlay, setMainOverlay] = useState<MainOverlay>('MA');
  const [subIndicator, setSubIndicator] = useState<SubIndicator>('MACD');
  const [chartStyle, setChartStyle] = useState<ChartRenderStyle>('candle');
  const [showUpdateExplainer, setShowUpdateExplainer] = useState(false);
  const [isChinaColor, setIsChinaColor] = useState(true); // Red = Up, Green = Down
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Direct reactive reference to props: single source of truth updated incrementally by parent
  const liveBars = bars;
  const liveMinutePoints = minutePoints;

  // Colors
  const upColor = isChinaColor ? '#EF4444' : '#10B981';
  const downColor = isChinaColor ? '#10B981' : '#EF4444';

  // Sizing
  const chartHeight = isFullscreen ? 580 : 380;
  const paddingRight = 70;
  const paddingLeft = 12;
  const paddingTop = 16;
  const svgWidth = 860;

  // -------------------------------------------------------------
  // A. TIMELINE (分时走势) CALCULATIONS
  // -------------------------------------------------------------
  const isTimeline = interval === 'timeline';
  const timelinePoints = liveMinutePoints;

  const { timelineYMin, timelineYMax, maxDevPct, maxTimelineVol } = useMemo(() => {
    if (!isTimeline || timelinePoints.length === 0) {
      return { timelineYMin: prevClose * 0.98, timelineYMax: prevClose * 1.02, maxDevPct: 2.0, maxTimelineVol: 100 };
    }

    let maxDiff = 0;
    let maxV = 0;

    timelinePoints.forEach((p) => {
      const diff1 = Math.abs(p.price - prevClose);
      const diff2 = Math.abs(p.avgPrice - prevClose);
      if (diff1 > maxDiff) maxDiff = diff1;
      if (diff2 > maxDiff) maxDiff = diff2;
      if (p.volume > maxV) maxV = p.volume;
    });

    const safeDiff = Math.max(prevClose * 0.015, maxDiff * 1.1);
    const yMin = +(prevClose - safeDiff).toFixed(2);
    const yMax = +(prevClose + safeDiff).toFixed(2);
    const devPct = prevClose > 0 ? +((safeDiff / prevClose) * 100).toFixed(2) : 2.0;

    return { timelineYMin: yMin, timelineYMax: yMax, maxDevPct: devPct, maxTimelineVol: maxV };
  }, [isTimeline, timelinePoints, prevClose]);

  const upperTimelineH = chartHeight * 0.68;
  const volTimelineH = chartHeight * 0.22;

  const getTimelineYPrice = (val: number) => {
    return paddingTop + (1 - (val - timelineYMin) / (timelineYMax - timelineYMin || 1)) * (upperTimelineH - paddingTop);
  };

  const getTimelineYVol = (val: number) => {
    const bottom = upperTimelineH + volTimelineH;
    return bottom - (val / (maxTimelineVol || 1)) * (volTimelineH - 6);
  };

  // 240 minutes in China trading day
  const timelineSlotW = (svgWidth - paddingLeft - paddingRight) / 240;

  const timelinePricePath = useMemo(() => {
    if (!isTimeline || timelinePoints.length === 0) return '';
    return timelinePoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${paddingLeft + i * timelineSlotW} ${getTimelineYPrice(p.price)}`)
      .join(' ');
  }, [isTimeline, timelinePoints, timelineSlotW, timelineYMin, timelineYMax]);

  const timelineAreaPath = useMemo(() => {
    if (!isTimeline || timelinePoints.length === 0) return '';
    const firstX = paddingLeft;
    const lastX = paddingLeft + (timelinePoints.length - 1) * timelineSlotW;
    const bottomY = upperTimelineH;
    return `${timelinePricePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [isTimeline, timelinePricePath, timelinePoints, timelineSlotW, upperTimelineH]);

  const timelineAvgPath = useMemo(() => {
    if (!isTimeline || timelinePoints.length === 0) return '';
    return timelinePoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${paddingLeft + i * timelineSlotW} ${getTimelineYPrice(p.avgPrice)}`)
      .join(' ');
  }, [isTimeline, timelinePoints, timelineSlotW, timelineYMin, timelineYMax]);

  // Active minute point for stats
  const activeMinute =
    isTimeline && hoverIndex !== null && timelinePoints[hoverIndex]
      ? timelinePoints[hoverIndex]
      : timelinePoints[timelinePoints.length - 1];

  // -------------------------------------------------------------
  // B. CANDLESTICK CALCULATIONS (FOR 1m, 5m, 15m, 60m, 1d, 1w)
  // -------------------------------------------------------------
  const currentBars = liveBars;
  const activeBar =
    !isTimeline && hoverIndex !== null && currentBars[hoverIndex]
      ? currentBars[hoverIndex]
      : currentBars[currentBars.length - 1];

  const isTradingOpen = useMemo(() => isAsharesTradingTime(), []);

  const timeAxisHeight = 24;
  const availableH = chartHeight - timeAxisHeight;
  const mainHeight = availableH * 0.65;
  const volumeHeight = availableH * 0.16;
  const subHeight = availableH * 0.19;

  const { minPrice, maxPrice, maxVol, minSub, maxSub } = useMemo(() => {
    if (isTimeline || !currentBars || currentBars.length === 0) {
      return { minPrice: 0, maxPrice: 100, maxVol: 100, minSub: 0, maxSub: 100 };
    }

    let minP = Infinity;
    let maxP = -Infinity;
    let maxV = 0;

    currentBars.forEach((b) => {
      if (b.low < minP) minP = b.low;
      if (b.high > maxP) maxP = b.high;
      if (b.volume > maxV) maxV = b.volume;

      if (mainOverlay === 'MA') {
        if (b.ma5 && b.ma5 < minP) minP = b.ma5;
        if (b.ma5 && b.ma5 > maxP) maxP = b.ma5;
        if (b.ma20 && b.ma20 < minP) minP = b.ma20;
        if (b.ma20 && b.ma20 > maxP) maxP = b.ma20;
      } else if (mainOverlay === 'BOLL') {
        if (b.bollLower && b.bollLower < minP) minP = b.bollLower;
        if (b.bollUpper && b.bollUpper > maxP) maxP = b.bollUpper;
      }
    });

    const pMargin = (maxP - minP) * 0.05 || 1;
    minP -= pMargin;
    maxP += pMargin;

    let minS = 0;
    let maxS = 100;
    if (subIndicator === 'MACD') {
      minS = Infinity;
      maxS = -Infinity;
      currentBars.forEach((b) => {
        const dif = b.dif ?? 0;
        const dea = b.dea ?? 0;
        const macd = b.macd ?? 0;
        minS = Math.min(minS, dif, dea, macd);
        maxS = Math.max(maxS, dif, dea, macd);
      });
      const sMargin = Math.max(0.1, (maxS - minS) * 0.1);
      minS -= sMargin;
      maxS += sMargin;
    } else if (subIndicator === 'RSI') {
      minS = 0;
      maxS = 100;
    } else {
      minS = 0;
      maxS = maxVol;
    }

    return { minPrice: minP, maxPrice: maxP, maxVol: maxV, minSub: minS, maxSub: maxS };
  }, [isTimeline, currentBars, mainOverlay, subIndicator]);

  const nBars = currentBars.length;
  const candleSlotWidth = (svgWidth - paddingLeft - paddingRight) / Math.max(1, nBars);
  const candleBarWidth = Math.max(2, Math.min(14, candleSlotWidth * 0.75));

  const getYPrice = (val: number) => {
    return paddingTop + (1 - (val - minPrice) / (maxPrice - minPrice)) * (mainHeight - paddingTop);
  };

  const getYVol = (val: number) => {
    const bottom = mainHeight + volumeHeight;
    return bottom - (val / (maxVol || 1)) * (volumeHeight - 6);
  };

  const getYSub = (val: number) => {
    const top = mainHeight + volumeHeight + 8;
    const height = subHeight - 12;
    return top + (1 - (val - minSub) / (maxSub - minSub || 1)) * height;
  };

  const xTimeTicks = useMemo(() => {
    if (isTimeline || !currentBars || currentBars.length === 0) return [];
    const n = currentBars.length;
    const targetCount = 6;
    const step = Math.max(1, Math.floor((n - 1) / (targetCount - 1)));
    const indices: number[] = [];
    for (let i = 0; i < n; i += step) {
      indices.push(i);
    }
    if (indices[indices.length - 1] !== n - 1) {
      indices.push(n - 1);
    }

    return indices.map((idx) => {
      const bar = currentBars[idx];
      const x = paddingLeft + (idx + 0.5) * candleSlotWidth;
      let label = bar.date;

      if (interval === '1y') {
        if (label.length >= 4) {
          label = label.slice(0, 4);
        }
      } else if (interval === '1mo' || interval === '1q') {
        if (label.length >= 7) {
          label = label.slice(0, 7);
        }
      } else if (interval === '1d' || interval === '1w') {
        if (label.length >= 10) {
          label = label.slice(5, 10);
        }
      } else {
        if (label.includes(' ')) {
          const parts = label.split(' ');
          const dayPart = parts[0].slice(5); // MM-DD
          const timePart = parts[1].slice(0, 5); // HH:mm
          const prevBar = idx > 0 ? currentBars[idx - 1] : null;
          const isDayChange = !prevBar || prevBar.date.slice(0, 10) !== bar.date.slice(0, 10);
          label = isDayChange ? `${dayPart} ${timePart}` : timePart;
        }
      }

      return {
        index: idx,
        x,
        label,
        fullDate: bar.date,
      };
    });
  }, [isTimeline, currentBars, candleSlotWidth, paddingLeft, interval]);

  // Indicators polylines
  const ma5Points = currentBars
    .map((b, i) => (b.ma5 ? `${paddingLeft + (i + 0.5) * candleSlotWidth},${getYPrice(b.ma5)}` : ''))
    .filter(Boolean)
    .join(' ');
  const ma10Points = currentBars
    .map((b, i) => (b.ma10 ? `${paddingLeft + (i + 0.5) * candleSlotWidth},${getYPrice(b.ma10)}` : ''))
    .filter(Boolean)
    .join(' ');
  const ma20Points = currentBars
    .map((b, i) => (b.ma20 ? `${paddingLeft + (i + 0.5) * candleSlotWidth},${getYPrice(b.ma20)}` : ''))
    .filter(Boolean)
    .join(' ');
  const ma60Points = currentBars
    .map((b, i) => (b.ma60 ? `${paddingLeft + (i + 0.5) * candleSlotWidth},${getYPrice(b.ma60)}` : ''))
    .filter(Boolean)
    .join(' ');

  const bollUpperPoints = currentBars
    .map((b, i) => (b.bollUpper ? `${paddingLeft + (i + 0.5) * candleSlotWidth},${getYPrice(b.bollUpper)}` : ''))
    .filter(Boolean)
    .join(' ');
  const bollMidPoints = currentBars
    .map((b, i) => (b.bollMid ? `${paddingLeft + (i + 0.5) * candleSlotWidth},${getYPrice(b.bollMid)}` : ''))
    .filter(Boolean)
    .join(' ');
  const bollLowerPoints = currentBars
    .map((b, i) => (b.bollLower ? `${paddingLeft + (i + 0.5) * candleSlotWidth},${getYPrice(b.bollLower)}` : ''))
    .filter(Boolean)
    .join(' ');

  const difPoints = currentBars
    .map((b, i) => (b.dif !== undefined ? `${paddingLeft + (i + 0.5) * candleSlotWidth},${getYSub(b.dif)}` : ''))
    .filter(Boolean)
    .join(' ');
  const deaPoints = currentBars
    .map((b, i) => (b.dea !== undefined ? `${paddingLeft + (i + 0.5) * candleSlotWidth},${getYSub(b.dea)}` : ''))
    .filter(Boolean)
    .join(' ');

  const rsi6Points = currentBars
    .map((b, i) => (b.rsi6 !== undefined ? `${paddingLeft + (i + 0.5) * candleSlotWidth},${getYSub(b.rsi6)}` : ''))
    .filter(Boolean)
    .join(' ');
  const rsi12Points = currentBars
    .map((b, i) => (b.rsi12 !== undefined ? `${paddingLeft + (i + 0.5) * candleSlotWidth},${getYSub(b.rsi12)}` : ''))
    .filter(Boolean)
    .join(' ');
  const rsi24Points = currentBars
    .map((b, i) => (b.rsi24 !== undefined ? `${paddingLeft + (i + 0.5) * candleSlotWidth},${getYSub(b.rsi24)}` : ''))
    .filter(Boolean)
    .join(' ');

  // Polyline for line mode option
  const klineLinePath = useMemo(() => {
    if (isTimeline || currentBars.length === 0) return '';
    return currentBars
      .map((b, i) => `${i === 0 ? 'M' : 'L'} ${paddingLeft + (i + 0.5) * candleSlotWidth} ${getYPrice(b.close)}`)
      .join(' ');
  }, [isTimeline, currentBars, candleSlotWidth, minPrice, maxPrice]);

  const klineAreaPath = useMemo(() => {
    if (isTimeline || currentBars.length === 0 || !klineLinePath) return '';
    const firstX = paddingLeft + 0.5 * candleSlotWidth;
    const lastX = paddingLeft + (currentBars.length - 0.5) * candleSlotWidth;
    const bottomY = mainHeight;
    return `${klineLinePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [isTimeline, klineLinePath, currentBars, candleSlotWidth, mainHeight]);

  // Pointer interactions
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const svgX = ratio * svgWidth;

    if (isTimeline) {
      const idx = Math.floor((svgX - paddingLeft) / timelineSlotW);
      if (idx >= 0 && idx < timelinePoints.length) {
        setHoverIndex(idx);
      }
    } else {
      const idx = Math.floor((svgX - paddingLeft) / candleSlotWidth);
      if (idx >= 0 && idx < nBars) {
        setHoverIndex(idx);
      }
    }
  };

  const handlePointerLeave = () => {
    setHoverIndex(null);
  };

  // CSV Export
  const handleExportCSV = () => {
    if (isTimeline) {
      if (!timelinePoints || timelinePoints.length === 0) return;
      const headers = ['时间,现价,均价,分钟成交量,分钟成交额,涨跌额,涨跌幅%'];
      const rows = timelinePoints.map(
        (p) => `${p.time},${p.price},${p.avgPrice},${p.volume},${p.amount},${p.change},${p.changePercent}`
      );
      const csv = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
      const link = document.createElement('a');
      link.href = encodeURI(csv);
      link.download = `${stock.name}_${stock.symbol}_分时数据.csv`;
      link.click();
    } else {
      if (!currentBars || currentBars.length === 0) return;
      const headers = ['日期,开盘,最高,最低,收盘,成交量,成交额,MA5,MA20'];
      const rows = currentBars.map(
        (b) => `${b.date},${b.open},${b.high},${b.low},${b.close},${b.volume},${b.amount},${b.ma5 ?? ''},${b.ma20 ?? ''}`
      );
      const csv = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
      const link = document.createElement('a');
      link.href = encodeURI(csv);
      link.download = `${stock.name}_${stock.symbol}_${interval}_K线数据.csv`;
      link.click();
    }
  };

  const activeBarChange = activeBar ? +(activeBar.close - activeBar.open).toFixed(2) : 0;
  const activeBarPercent =
    activeBar && activeBar.open > 0 ? +((activeBarChange / activeBar.open) * 100).toFixed(2) : 0;

  return (
    <div
      ref={containerRef}
      className={`bg-[#0F172A]/90 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-200 relative ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl bg-[#0B0F19]' : ''
      }`}
    >
      {/* Loading Overlay: Only for cold initial load when no bars exist yet */}
      {isLoading && (!liveBars || liveBars.length === 0) && (
        <div className="absolute inset-0 bg-[#0B0F19]/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-2 text-blue-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-semibold text-white">
              正在调用 QuantDash 接口获取【{stock.name} ({stock.symbol})】行情...
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            GET /v1/market/{isTimeline ? 'minute' : 'kline'}?symbol={stock.symbol}&freq={interval}
          </span>
        </div>
      )}

      {/* Chart Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/80 bg-[#12192B]">
        {/* Left: Timeframe Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {[
            { id: 'timeline', label: '分时', icon: Activity },
            { id: '1m', label: '1分k', isCandle: true },
            { id: '5m', label: '5分k' },
            { id: '15m', label: '15分k' },
            { id: '60m', label: '60分k' },
            { id: '120m', label: '120分' },
            { id: '1d', label: '日k' },
            { id: '1w', label: '周k' },
            { id: '1mo', label: '月k' },
            { id: '1q', label: '季k' },
            { id: '1y', label: '年k' },
          ].map((tab) => {
            const isSelected = interval === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChangeInterval(tab.id as KlineInterval)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.id === 'timeline' && <Activity className="w-3 h-3 text-cyan-300" />}
                {tab.id === '1m' && <Flame className="w-3 h-3 text-amber-400" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Center: Chart Style & Indicators (Hidden in Timeline mode) */}
        {!isTimeline ? (
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Chart Style Switcher (Candle vs Line) */}
            <div className="flex items-center gap-1 bg-slate-900/70 p-1 rounded-xl border border-slate-800">
              <span className="text-slate-500 text-[11px] px-1.5">图态:</span>
              <button
                onClick={() => setChartStyle('candle')}
                className={`px-2 py-0.5 text-xs rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  chartStyle === 'candle'
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="标准蜡烛K线图（含开高低收柱体与上下影线）"
              >
                <BarChart2 className="w-3 h-3 text-amber-300" />
                <span>蜡烛图</span>
              </button>
              <button
                onClick={() => setChartStyle('line')}
                className={`px-2 py-0.5 text-xs rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  chartStyle === 'line'
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="收盘价趋势折线图"
              >
                <LineChart className="w-3 h-3 text-cyan-300" />
                <span>折线</span>
              </button>
            </div>

            {/* Main Overlay */}
            <div className="flex items-center gap-1 bg-slate-900/70 p-1 rounded-xl border border-slate-800">
              <span className="text-slate-500 text-[11px] px-1.5">主图:</span>
              {(['MA', 'BOLL', 'NONE'] as MainOverlay[]).map((mo) => (
                <button
                  key={mo}
                  onClick={() => setMainOverlay(mo)}
                  className={`px-2 py-0.5 text-xs rounded-md transition-colors cursor-pointer ${
                    mainOverlay === mo ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mo === 'MA' ? '均线(MA)' : mo === 'BOLL' ? '布林带' : '隐藏'}
                </button>
              ))}
            </div>

            {/* Sub Indicator */}
            <div className="flex items-center gap-1 bg-slate-900/70 p-1 rounded-xl border border-slate-800">
              <span className="text-slate-500 text-[11px] px-1.5">副图:</span>
              {(['MACD', 'RSI', 'VOLUME'] as SubIndicator[]).map((si) => (
                <button
                  key={si}
                  onClick={() => setSubIndicator(si)}
                  className={`px-2 py-0.5 text-xs rounded-md transition-colors cursor-pointer ${
                    subIndicator === si ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {si === 'MACD' ? 'MACD' : si === 'RSI' ? 'RSI' : '仅成交量'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-white">
              <span className="w-2 h-0.5 bg-white inline-block"></span>
              <span>现价分时线</span>
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-0.5 bg-amber-400 inline-block"></span>
              <span>当日均价线 (VWAP)</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-0.5 bg-slate-500 inline-block"></span>
              <span>昨收平盘线: {prevClose.toFixed(2)}</span>
            </span>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Market Trading Session Status Badge */}
          {(() => {
            const isUS = stock.market === 'US';
            const isHK = stock.market === 'HK';
            const label = isUS
              ? '美股实时行情 · 动态同步中'
              : isHK
              ? '港股实时行情 · 动态同步中'
              : isTradingOpen
              ? 'A股连续竞价交易中'
              : 'A股休市 · 历史行情';
            const active = isUS || isHK || isTradingOpen;
            return (
              <span
                className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border font-mono ${
                  active
                    ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30'
                    : 'text-slate-400 bg-slate-900 border-slate-800'
                }`}
                title={label}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span>{label}</span>
              </span>
            );
          })()}

          {/* Real-time Update Explainer Button */}
          <button
            onClick={() => setShowUpdateExplainer(!showUpdateExplainer)}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
              showUpdateExplainer
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white'
            }`}
            title="查看所有K线与分时图的实时更新机制说明"
          >
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px]">增量与实时机制</span>
          </button>

          {/* Manual Refresh Button */}
          {onRefreshNow && (
            <button
              onClick={onRefreshNow}
              disabled={isRefreshing}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="立即拉取最新实盘K线与分时数据"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px]">刷新</span>
            </button>
          )}

          {/* Last Updated Timestamp */}
          {lastUpdatedTime && (
            <span className="hidden xl:inline-flex items-center gap-1 text-[11px] text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{lastUpdatedTime}</span>
            </span>
          )}

          {/* Strategy Backtest Button */}
          {onOpenStrategyModal && (
            <button
              onClick={onOpenStrategyModal}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:text-white flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-500/10 transition-colors"
              title="一键运行经典量化策略回测（双均线/RSI布林/价值定投/盘口异动）"
            >
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px]">策略回测</span>
            </button>
          )}

          {/* Color Switcher */}
          <button
            onClick={() => setIsChinaColor(!isChinaColor)}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
            title="切换涨跌颜色风格"
          >
            <Palette className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px]">{isChinaColor ? 'A股红涨' : '国际绿涨'}</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
            title="导出数据为 CSV 表格"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px]">导出CSV</span>
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
            title={isFullscreen ? '退出全屏' : '全屏看板'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Real-time Update Mechanism Explainer Panel */}
      {showUpdateExplainer && (
        <div className="bg-[#101827] border-b border-blue-900/60 p-4 text-xs text-slate-300 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
              <Sparkles className="w-4 h-4 text-blue-400" />
              QuantDash 全周期 K 线增量更新与实时渲染机制
            </span>
            <button
              onClick={() => setShowUpdateExplainer(false)}
              className="text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[11px] cursor-pointer"
            >
              收起说明 ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px]">
            <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 space-y-1.5">
              <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>增量更新架构 (Incremental Sync)</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                历史已结算的 K 线 Bar 为不可变数据（Immutable），无需每次重新拉取和销毁画布；系统仅对右侧当前最新活跃 Bar 做就地增量修改，跨周期时自动追加新柱，彻底消除全屏刷新与闪烁。
              </p>
            </div>
            <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 space-y-1.5">
              <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>1分K 蜡烛图 (1-Minute Candle)</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                标准日本阴阳蜡烛图（开盘价、最高价、最低价、收盘价四要素+上下影线）。当前未闭合的 1 分钟内，实体与影线随盘中每笔最新撮合实时变动（突破高低、收盘跳动）；每满 1 分钟自动结柱，并在下一分钟开出新蜡烛。
              </p>
            </div>
            <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 space-y-1.5">
              <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-300" />
                <span>分时走势 (Intraday Timeline)</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                盘中逐分钟描摹最新价位与成交点，并同步计算 VWAP 加权成交均价线（黄线）。中间虚线为昨收价平盘线，红绿涨跌幅基于昨日收盘价对称呈现。
              </p>
            </div>
            <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 space-y-1.5">
              <div className="font-semibold text-blue-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-400" />
                <span>高频行情轮询与瞬时缓存</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                内存常驻 LRU 缓存，切换股票或周期达到 0ms 瞬间渲染；后台轻量级撮合快照轮询仅消耗微秒级带宽，既保证实时行情紧跟盘面，又彻底告别卡顿与空白。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Ribbon */}
      <div className="px-4 py-2 bg-[#0B0F19]/80 border-b border-slate-800/60 flex flex-wrap items-center justify-between text-xs font-mono tabular-nums gap-3 select-none">
        {isTimeline && activeMinute ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-slate-300">
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 text-[11px] font-semibold border border-cyan-800/40 shrink-0">
                分时
              </span>
              <span className="font-mono text-slate-200 w-[70px] shrink-0 inline-block tabular-nums text-left font-medium">
                {activeMinute.time}
              </span>
            </div>
            <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums">
              <span className="inline-block w-[72px] text-left">
                <span className="text-slate-500 font-sans">现价: </span>
                <strong className={activeMinute.changePercent >= 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {activeMinute.price.toFixed(2)}
                </strong>
              </span>
              <span className="inline-block w-[72px] text-left">
                <span className="text-slate-500 font-sans">均价: </span>
                <strong className="text-amber-400 font-bold">{activeMinute.avgPrice.toFixed(2)}</strong>
              </span>
              <span className="inline-block w-[130px] text-left">
                <span className="text-slate-500 font-sans">涨跌: </span>
                <span className={activeMinute.changePercent >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                  {activeMinute.changePercent >= 0 ? '+' : ''}{activeMinute.change.toFixed(2)} ({activeMinute.changePercent >= 0 ? '+' : ''}{activeMinute.changePercent.toFixed(2)}%)
                </span>
              </span>
              <span className="inline-block w-[88px] text-left">
                <span className="text-slate-500 font-sans">量: </span>
                <span className="text-slate-300">
                  {(activeMinute.volume / 100).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}手
                </span>
              </span>
            </div>
          </div>
        ) : activeBar ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-slate-300">
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 text-[11px] font-semibold border border-blue-800/40 shrink-0">
                {interval.toUpperCase()} {chartStyle === 'candle' ? '蜡烛' : '折线'}
              </span>
              <span className="font-mono text-slate-200 w-[140px] shrink-0 inline-block tabular-nums text-left font-medium">
                {activeBar.date}
              </span>
            </div>
            <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums">
              <span className="inline-block w-[68px] text-left">
                <span className="text-slate-500 font-sans">开: </span>
                <strong className="text-white">{activeBar.open.toFixed(2)}</strong>
              </span>
              <span className="inline-block w-[68px] text-left">
                <span className="text-slate-500 font-sans">高: </span>
                <strong className="text-white">{activeBar.high.toFixed(2)}</strong>
              </span>
              <span className="inline-block w-[68px] text-left">
                <span className="text-slate-500 font-sans">低: </span>
                <strong className="text-white">{activeBar.low.toFixed(2)}</strong>
              </span>
              <span className="inline-block w-[68px] text-left">
                <span className="text-slate-500 font-sans">收: </span>
                <strong className={activeBarPercent >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                  {activeBar.close.toFixed(2)}
                </strong>
              </span>
              <span className="inline-block w-[130px] text-left">
                <span className="text-slate-500 font-sans">涨跌: </span>
                <span className={activeBarPercent >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                  {activeBarPercent >= 0 ? '+' : ''}{activeBarChange.toFixed(2)} ({activeBarPercent >= 0 ? '+' : ''}{activeBarPercent.toFixed(2)}%)
                </span>
              </span>
              <span className="inline-block w-[88px] text-left">
                <span className="text-slate-500 font-sans">量: </span>
                <span className="text-slate-300">
                  {(activeBar.volume / 100).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}手
                </span>
              </span>
            </div>
          </div>
        ) : null}

        {/* Legend */}
        {!isTimeline && activeBar && (
          <div className="flex items-center gap-3 text-[11px]">
            {mainOverlay === 'MA' && (
              <>
                <span className="text-amber-400">MA5: {activeBar.ma5?.toFixed(2) ?? '-'}</span>
                <span className="text-cyan-400">MA10: {activeBar.ma10?.toFixed(2) ?? '-'}</span>
                <span className="text-purple-400">MA20: {activeBar.ma20?.toFixed(2) ?? '-'}</span>
                <span className="text-orange-400">MA60: {activeBar.ma60?.toFixed(2) ?? '-'}</span>
              </>
            )}
            {mainOverlay === 'BOLL' && (
              <>
                <span className="text-amber-400">UPPER: {activeBar.bollUpper?.toFixed(2) ?? '-'}</span>
                <span className="text-slate-300">MID: {activeBar.bollMid?.toFixed(2) ?? '-'}</span>
                <span className="text-cyan-400">LOWER: {activeBar.bollLower?.toFixed(2) ?? '-'}</span>
              </>
            )}
            {subIndicator === 'MACD' && (
              <>
                <span className="text-blue-400">DIF: {activeBar.dif?.toFixed(3) ?? '-'}</span>
                <span className="text-amber-400">DEA: {activeBar.dea?.toFixed(3) ?? '-'}</span>
                <span className={(activeBar.macd ?? 0) >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                  MACD: {activeBar.macd?.toFixed(3) ?? '-'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${chartHeight}`}
          className="w-full h-auto cursor-crosshair block"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* ------------------------------------------------------------- */}
          {/* TIMELINE SVG RENDERING (分时走势图)                           */}
          {/* ------------------------------------------------------------- */}
          {isTimeline ? (
            <g>
              {/* Reference Grid Lines */}
              {/* Upper Line (+Max%) */}
              <line
                x1={paddingLeft}
                y1={paddingTop}
                x2={svgWidth - paddingRight}
                y2={paddingTop}
                stroke="#1E293B"
                strokeDasharray="2 2"
              />
              <text x={svgWidth - paddingRight + 6} y={paddingTop + 3} fill="#EF4444" fontSize="10" fontFamily="monospace">
                +{maxDevPct.toFixed(2)}%
              </text>
              <text x={svgWidth - paddingRight + 45} y={paddingTop + 3} fill="#64748B" fontSize="10" fontFamily="monospace">
                {timelineYMax.toFixed(2)}
              </text>

              {/* Zero Center Line (prevClose) */}
              <line
                x1={paddingLeft}
                y1={getTimelineYPrice(prevClose)}
                x2={svgWidth - paddingRight}
                y2={getTimelineYPrice(prevClose)}
                stroke="#475569"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={svgWidth - paddingRight + 6}
                y={getTimelineYPrice(prevClose) + 3}
                fill="#94A3B8"
                fontSize="10"
                fontFamily="monospace"
              >
                0.00%
              </text>
              <text
                x={svgWidth - paddingRight + 45}
                y={getTimelineYPrice(prevClose) + 3}
                fill="#94A3B8"
                fontSize="10"
                fontFamily="monospace"
              >
                {prevClose.toFixed(2)}
              </text>

              {/* Lower Line (-Max%) */}
              <line
                x1={paddingLeft}
                y1={upperTimelineH}
                x2={svgWidth - paddingRight}
                y2={upperTimelineH}
                stroke="#1E293B"
                strokeDasharray="2 2"
              />
              <text x={svgWidth - paddingRight + 6} y={upperTimelineH - 2} fill="#10B981" fontSize="10" fontFamily="monospace">
                -{maxDevPct.toFixed(2)}%
              </text>
              <text x={svgWidth - paddingRight + 45} y={upperTimelineH - 2} fill="#64748B" fontSize="10" fontFamily="monospace">
                {timelineYMin.toFixed(2)}
              </text>

              {/* Volume subchart divider line */}
              <line
                x1={paddingLeft}
                y1={upperTimelineH + volTimelineH}
                x2={svgWidth - paddingRight}
                y2={upperTimelineH + volTimelineH}
                stroke="#334155"
                strokeWidth="1"
              />

              {/* Vertical time grid lines (09:30, 10:30, 11:30/13:00, 14:00, 15:00) */}
              {[0, 60, 120, 180, 240].map((m, idx) => {
                const x = paddingLeft + m * timelineSlotW;
                const timeLabel =
                  idx === 0
                    ? '09:30'
                    : idx === 1
                    ? '10:30'
                    : idx === 2
                    ? '11:30/13:00'
                    : idx === 3
                    ? '14:00'
                    : '15:00';
                return (
                  <g key={m}>
                    <line
                      x1={x}
                      y1={paddingTop}
                      x2={x}
                      y2={upperTimelineH + volTimelineH}
                      stroke="#1E293B"
                      strokeDasharray="2 2"
                      strokeWidth="0.8"
                    />
                    <text
                      x={x}
                      y={upperTimelineH + volTimelineH + 13}
                      fill="#64748B"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor={idx === 0 ? 'start' : idx === 4 ? 'end' : 'middle'}
                    >
                      {timeLabel}
                    </text>
                  </g>
                );
              })}

              {/* Translucent Area under price line */}
              {timelineAreaPath && <path d={timelineAreaPath} fill="url(#timelineGradient)" />}

              {/* Minute Volume Bars */}
              {timelinePoints.map((p, i) => {
                const x = paddingLeft + i * timelineSlotW;
                const yV = getTimelineYVol(p.volume);
                const bottom = upperTimelineH + volTimelineH;
                const h = Math.max(1, bottom - yV);
                const isUp = i === 0 ? p.price >= prevClose : p.price >= timelinePoints[i - 1].price;
                const col = isUp ? upColor : downColor;

                return (
                  <rect
                    key={i}
                    x={x}
                    y={yV}
                    width={Math.max(1, timelineSlotW * 0.8)}
                    height={h}
                    fill={col}
                    fillOpacity="0.7"
                  />
                );
              })}

              {/* Yellow VWAP line */}
              {timelineAvgPath && (
                <path d={timelineAvgPath} fill="none" stroke="#FBBF24" strokeWidth="1.2" strokeLinecap="round" />
              )}

              {/* White Price line */}
              {timelinePricePath && (
                <path d={timelinePricePath} fill="none" stroke="#F8FAFC" strokeWidth="1.6" strokeLinecap="round" />
              )}

              {/* Interactive Crosshair for Timeline */}
              {hoverIndex !== null && hoverIndex < timelinePoints.length && (
                <g>
                  <line
                    x1={paddingLeft + hoverIndex * timelineSlotW}
                    y1={paddingTop}
                    x2={paddingLeft + hoverIndex * timelineSlotW}
                    y2={upperTimelineH + volTimelineH}
                    stroke="#94A3B8"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={paddingLeft}
                    y1={getTimelineYPrice(timelinePoints[hoverIndex].price)}
                    x2={svgWidth - paddingRight}
                    y2={getTimelineYPrice(timelinePoints[hoverIndex].price)}
                    stroke="#94A3B8"
                    strokeWidth="0.8"
                    strokeDasharray="3 3"
                  />

                  {/* Price Tag */}
                  <rect
                    x={svgWidth - paddingRight + 2}
                    y={getTimelineYPrice(timelinePoints[hoverIndex].price) - 9}
                    width={58}
                    height={18}
                    fill="#1E293B"
                    stroke="#475569"
                    strokeWidth="0.8"
                    rx="3"
                  />
                  <text
                    x={svgWidth - paddingRight + 5}
                    y={getTimelineYPrice(timelinePoints[hoverIndex].price) + 3.5}
                    fill="#F8FAFC"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {timelinePoints[hoverIndex].price.toFixed(2)}
                  </text>
                </g>
              )}
            </g>
          ) : (
            /* ------------------------------------------------------------- */
            /* CANDLESTICK RENDERING (1m, 5m, 15m, 60m, 1d, 1w)              */
            /* ------------------------------------------------------------- */
            <g>
              {/* Background Price Grid Lines */}
              {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
                const y = paddingTop + ratio * (mainHeight - paddingTop);
                const priceVal = maxPrice - ratio * (maxPrice - minPrice);
                return (
                  <g key={ratio}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={svgWidth - paddingRight}
                      y2={y}
                      stroke="#1E293B"
                      strokeDasharray="3 3"
                      strokeWidth="0.8"
                    />
                    <text x={svgWidth - paddingRight + 8} y={y + 3} fill="#64748B" fontSize="10" fontFamily="monospace">
                      {priceVal.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* Dividers */}
              <line x1={paddingLeft} y1={mainHeight} x2={svgWidth - paddingRight} y2={mainHeight} stroke="#334155" strokeWidth="1" />
              <line
                x1={paddingLeft}
                y1={mainHeight + volumeHeight}
                x2={svgWidth - paddingRight}
                y2={mainHeight + volumeHeight}
                stroke="#334155"
                strokeWidth="1"
              />

              {/* Bollinger Band Shaded Area */}
              {mainOverlay === 'BOLL' && bollUpperPoints && bollLowerPoints && (
                <path
                  d={`M ${bollUpperPoints} L ${bollLowerPoints.split(' ').reverse().join(' ')} Z`}
                  fill="#3B82F6"
                  fillOpacity="0.08"
                />
              )}

              {/* Mode: Line / Mountain Area Chart */}
              {chartStyle === 'line' && (
                <g>
                  {klineAreaPath && <path d={klineAreaPath} fill="url(#timelineGradient)" />}
                  {klineLinePath && (
                    <path d={klineLinePath} fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
                  )}
                </g>
              )}

              {/* Candlesticks & Volume Bars */}
              {currentBars.map((b, i) => {
                const isUp = b.close >= b.open;
                const barColor = isUp ? upColor : downColor;
                const xCenter = paddingLeft + (i + 0.5) * candleSlotWidth;
                const yHigh = getYPrice(b.high);
                const yLow = getYPrice(b.low);
                const yOpen = getYPrice(b.open);
                const yClose = getYPrice(b.close);

                const candleTop = Math.min(yOpen, yClose);
                const candleH = Math.max(1.5, Math.abs(yClose - yOpen));

                const vY = getYVol(b.volume);
                const vBottom = mainHeight + volumeHeight;
                const vH = Math.max(1, vBottom - vY);

                const isLast = i === nBars - 1;

                return (
                  <g key={i}>
                    {/* Candlestick Wicks & Bodies (only in candle mode) */}
                    {chartStyle === 'candle' && (
                      <>
                        {/* Shadow / Wick */}
                        <line
                          x1={xCenter}
                          y1={yHigh}
                          x2={xCenter}
                          y2={yLow}
                          stroke={barColor}
                          strokeWidth="1.2"
                        />

                        {/* Candle Body */}
                        <rect
                          x={xCenter - candleBarWidth / 2}
                          y={candleTop}
                          width={candleBarWidth}
                          height={candleH}
                          fill={barColor}
                          stroke={barColor}
                          strokeWidth="0.8"
                          rx="1"
                        />
                      </>
                    )}

                    {/* Volume Bar */}
                    <rect
                      x={xCenter - candleBarWidth / 2}
                      y={vY}
                      width={candleBarWidth}
                      height={vH}
                      fill={barColor}
                      fillOpacity="0.65"
                      rx="0.5"
                    />

                    {/* MACD Histogram */}
                    {subIndicator === 'MACD' && b.macd !== undefined && (
                      <rect
                        x={xCenter - candleBarWidth / 2}
                        y={b.macd >= 0 ? getYSub(b.macd) : getYSub(0)}
                        width={candleBarWidth}
                        height={Math.max(1, Math.abs(getYSub(b.macd) - getYSub(0)))}
                        fill={b.macd >= 0 ? upColor : downColor}
                        fillOpacity="0.75"
                        rx="0.5"
                      />
                    )}
                  </g>
                );
              })}

              {/* Dynamic Real-time Price Line for latest tick */}
              {currentBars.length > 0 && (
                <g>
                  <line
                    x1={paddingLeft}
                    y1={getYPrice(currentBars[currentBars.length - 1].close)}
                    x2={svgWidth - paddingRight}
                    y2={getYPrice(currentBars[currentBars.length - 1].close)}
                    stroke={
                      currentBars[currentBars.length - 1].close >= currentBars[currentBars.length - 1].open
                        ? upColor
                        : downColor
                    }
                    strokeDasharray="2 2"
                    strokeWidth="1"
                  />
                  <rect
                    x={svgWidth - paddingRight + 2}
                    y={getYPrice(currentBars[currentBars.length - 1].close) - 8}
                    width={58}
                    height={16}
                    fill={
                      currentBars[currentBars.length - 1].close >= currentBars[currentBars.length - 1].open
                        ? upColor
                        : downColor
                    }
                    rx="3"
                  />
                  <text
                    x={svgWidth - paddingRight + 6}
                    y={getYPrice(currentBars[currentBars.length - 1].close) + 4}
                    fill="#FFFFFF"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {currentBars[currentBars.length - 1].close.toFixed(2)}
                  </text>
                </g>
              )}

              {/* Moving Averages */}
              {mainOverlay === 'MA' && (
                <>
                  {ma5Points && <polyline points={ma5Points} fill="none" stroke="#FACC15" strokeWidth="1.5" strokeLinecap="round" />}
                  {ma10Points && <polyline points={ma10Points} fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" />}
                  {ma20Points && <polyline points={ma20Points} fill="none" stroke="#C084FC" strokeWidth="1.5" strokeLinecap="round" />}
                  {ma60Points && <polyline points={ma60Points} fill="none" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" />}
                </>
              )}

              {/* Bollinger Lines */}
              {mainOverlay === 'BOLL' && (
                <>
                  {bollUpperPoints && <polyline points={bollUpperPoints} fill="none" stroke="#FACC15" strokeWidth="1.2" strokeDasharray="2 2" />}
                  {bollMidPoints && <polyline points={bollMidPoints} fill="none" stroke="#94A3B8" strokeWidth="1.2" />}
                  {bollLowerPoints && <polyline points={bollLowerPoints} fill="none" stroke="#22D3EE" strokeWidth="1.2" strokeDasharray="2 2" />}
                </>
              )}

              {/* MACD Lines */}
              {subIndicator === 'MACD' && (
                <>
                  <line x1={paddingLeft} y1={getYSub(0)} x2={svgWidth - paddingRight} y2={getYSub(0)} stroke="#475569" strokeWidth="0.8" strokeDasharray="2 2" />
                  {difPoints && <polyline points={difPoints} fill="none" stroke="#60A5FA" strokeWidth="1.3" />}
                  {deaPoints && <polyline points={deaPoints} fill="none" stroke="#FBBF24" strokeWidth="1.3" />}
                </>
              )}

              {/* RSI Lines */}
              {subIndicator === 'RSI' && (
                <>
                  <line x1={paddingLeft} y1={getYSub(80)} x2={svgWidth - paddingRight} y2={getYSub(80)} stroke="#EF4444" strokeWidth="0.6" strokeDasharray="2 2" />
                  <line x1={paddingLeft} y1={getYSub(20)} x2={svgWidth - paddingRight} y2={getYSub(20)} stroke="#10B981" strokeWidth="0.6" strokeDasharray="2 2" />
                  {rsi6Points && <polyline points={rsi6Points} fill="none" stroke="#FBBF24" strokeWidth="1.3" />}
                  {rsi12Points && <polyline points={rsi12Points} fill="none" stroke="#22D3EE" strokeWidth="1.3" />}
                  {rsi24Points && <polyline points={rsi24Points} fill="none" stroke="#C084FC" strokeWidth="1.3" />}
                </>
              )}

              {/* Candlestick Bottom X-Axis Time / Date Scale */}
              <g className="candlestick-x-axis">
                <line
                  x1={paddingLeft}
                  y1={chartHeight - 20}
                  x2={svgWidth - paddingRight}
                  y2={chartHeight - 20}
                  stroke="#1E293B"
                  strokeWidth="1"
                />
                {xTimeTicks.map((tick, i) => (
                  <g key={tick.index}>
                    <line
                      x1={tick.x}
                      y1={chartHeight - 20}
                      x2={tick.x}
                      y2={chartHeight - 15}
                      stroke="#334155"
                      strokeWidth="1"
                    />
                    <text
                      x={tick.x}
                      y={chartHeight - 5}
                      fill="#94A3B8"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor={i === 0 ? 'start' : i === xTimeTicks.length - 1 ? 'end' : 'middle'}
                    >
                      {tick.label}
                    </text>
                  </g>
                ))}
              </g>

              {/* Crosshair */}
              {hoverIndex !== null && hoverIndex < nBars && (
                <g>
                  <line
                    x1={paddingLeft + (hoverIndex + 0.5) * candleSlotWidth}
                    y1={paddingTop}
                    x2={paddingLeft + (hoverIndex + 0.5) * candleSlotWidth}
                    y2={chartHeight - 20}
                    stroke="#94A3B8"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={paddingLeft}
                    y1={getYPrice(currentBars[hoverIndex].close)}
                    x2={svgWidth - paddingRight}
                    y2={getYPrice(currentBars[hoverIndex].close)}
                    stroke="#94A3B8"
                    strokeWidth="0.8"
                    strokeDasharray="3 3"
                  />
                  <rect
                    x={svgWidth - paddingRight + 2}
                    y={getYPrice(currentBars[hoverIndex].close) - 9}
                    width={58}
                    height={18}
                    fill="#1E293B"
                    stroke="#475569"
                    strokeWidth="0.8"
                    rx="3"
                  />
                  <text
                    x={svgWidth - paddingRight + 5}
                    y={getYPrice(currentBars[hoverIndex].close) + 3.5}
                    fill="#F8FAFC"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {currentBars[hoverIndex].close.toFixed(2)}
                  </text>

                  {/* Bottom date badge */}
                  <rect
                    x={Math.max(paddingLeft, Math.min(svgWidth - paddingRight - 116, paddingLeft + (hoverIndex + 0.5) * candleSlotWidth - 58))}
                    y={chartHeight - 20}
                    width={116}
                    height={18}
                    fill="#0F172A"
                    stroke="#38BDF8"
                    strokeWidth="1"
                    rx="3"
                  />
                  <text
                    x={Math.max(paddingLeft, Math.min(svgWidth - paddingRight - 116, paddingLeft + (hoverIndex + 0.5) * candleSlotWidth - 58)) + 58}
                    y={chartHeight - 7}
                    fill="#38BDF8"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {currentBars[hoverIndex].date}
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
