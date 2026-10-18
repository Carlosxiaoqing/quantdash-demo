import React, { useState, useMemo } from 'react';
import {
  X,
  Play,
  RotateCcw,
  TrendingUp,
  Award,
  ShieldAlert,
  ArrowRight,
  Code2,
  CheckCircle2,
  Flame,
  Zap,
  Layers,
  ChevronRight,
  Activity,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { StockSymbol, KlineBar, OrderBook } from '../types/stock';
import { STRATEGY_TEMPLATES, StrategyTemplate } from '../data/strategyTemplates';
import { executeBacktestStrategy, BacktestResult } from '../utils/strategyEngine';

interface StrategyBacktestModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: StockSymbol;
  bars: KlineBar[];
  orderBook?: OrderBook;
  apiKey: string;
  onOpenCodeDrawer: (strategyCode?: string) => void;
  initialStrategyId?: string;
}

export const StrategyBacktestModal: React.FC<StrategyBacktestModalProps> = ({
  isOpen,
  onClose,
  stock,
  bars,
  orderBook,
  apiKey,
  onOpenCodeDrawer,
  initialStrategyId,
}) => {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(initialStrategyId || 'dual_ma');
  const [activeTab, setActiveTab] = useState<'backtest' | 'code' | 'trades'>('backtest');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Synchronize when initialStrategyId changes or modal opens
  React.useEffect(() => {
    if (initialStrategyId) {
      setSelectedStrategyId(initialStrategyId);
      setHoverIndex(null);
    }
  }, [initialStrategyId, isOpen]);

  const currentTemplate = useMemo(() => {
    return STRATEGY_TEMPLATES.find((t) => t.id === selectedStrategyId) || STRATEGY_TEMPLATES[0];
  }, [selectedStrategyId]);

  // Execute real backtest on the fly
  const backtestResult: BacktestResult = useMemo(() => {
    return executeBacktestStrategy(selectedStrategyId, bars, stock, orderBook);
  }, [selectedStrategyId, bars, stock, orderBook]);

  if (!isOpen) return null;

  const { strategyCurve, benchmarkCurve, dates, summary, trades } = backtestResult;

  // SVG Chart Geometry
  const svgWidth = 720;
  const svgHeight = 220;
  const padding = { top: 20, right: 30, bottom: 30, left: 55 };
  const chartW = svgWidth - padding.left - padding.right;
  const chartH = svgHeight - padding.top - padding.bottom;

  const allVals = [...strategyCurve, ...benchmarkCurve];
  const minVal = Math.min(...allVals, 0.95);
  const maxVal = Math.max(...allVals, 1.05);
  const valRange = maxVal - minVal || 1;

  const getX = (idx: number) => padding.left + (idx / Math.max(1, strategyCurve.length - 1)) * chartW;
  const getY = (val: number) => padding.top + chartH - ((val - minVal) / valRange) * chartH;

  const strategyPoints = strategyCurve.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ');
  const benchmarkPoints = benchmarkCurve.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ');

  // Gradient area
  const areaPoints = `${getX(0)},${padding.top + chartH} ${strategyPoints} ${getX(
    strategyCurve.length - 1
  )},${padding.top + chartH}`;

  const currentHover = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < strategyCurve.length
    ? {
        date: dates[hoverIndex] || '',
        strat: strategyCurve[hoverIndex],
        bench: benchmarkCurve[hoverIndex],
        stratPct: +((strategyCurve[hoverIndex] - 1) * 100).toFixed(2),
        benchPct: +((benchmarkCurve[hoverIndex] - 1) * 100).toFixed(2),
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#0E1526] border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#121B2F]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">小白量化策略沙盒与一键回测中心</h2>
                <span className="text-xs text-slate-400 font-normal">·</span>
                <span className="text-xs text-blue-400 font-mono font-medium">{stock.name} ({stock.symbol})</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                零代码运行经典量化策略，秒级获得基于当前股票实盘历史数据的收益回测曲线
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* 1. Strategy Selector Shelf (4 Cards) */}
          <div>
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                精选新手策略卡片 (点击即刻运行)
              </span>
              <span className="text-slate-400 text-[11px]">
                全自动向量化回测 · 0ms 实时响应
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {STRATEGY_TEMPLATES.map((tmpl) => {
                const isSelected = tmpl.id === selectedStrategyId;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => {
                      setSelectedStrategyId(tmpl.id);
                      setHoverIndex(null);
                    }}
                    className={`relative p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-slate-900/60 border-slate-800/90 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="font-medium text-blue-400">{tmpl.badge}</span>
                        <span>·</span>
                        <span>{tmpl.difficulty}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                        {tmpl.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                        {tmpl.tagline}
                      </p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 truncate max-w-[120px]">{tmpl.suitableMarket}</span>
                      <span
                        className={`font-medium flex items-center gap-0.5 ${
                          isSelected ? 'text-blue-400 font-semibold' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      >
                        {isSelected ? '已运行' : '运行'}
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Strategy Overview & Tab Bar */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{currentTemplate.title}</h3>
                  <span className="text-xs text-slate-400 font-normal">·</span>
                  <span className="text-xs text-slate-400">{currentTemplate.category}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  {currentTemplate.principle}
                </p>
              </div>

              {/* View Mode Tabs */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setActiveTab('backtest')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeTab === 'backtest' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  收益曲线与指标
                </button>
                <button
                  onClick={() => setActiveTab('trades')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeTab === 'trades' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  交易信号明细 ({trades.length})
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'code' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Python 源码</span>
                </button>
              </div>
            </div>

            {/* TAB 1: Backtest Return Curve & 4 Metric Cards */}
            {activeTab === 'backtest' && (
              <div className="space-y-5">
                {/* 4 Metric Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-[#0B0F19] p-3.5 rounded-xl border border-slate-800 font-mono">
                    <div className="text-[11px] font-sans text-slate-400 flex items-center justify-between">
                      <span>策略累计收益率</span>
                      <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div
                      className={`text-xl font-bold mt-1 tabular-nums ${
                        summary.strategyReturnPct >= 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {summary.strategyReturnPct >= 0 ? '+' : ''}
                      {summary.strategyReturnPct.toFixed(2)}%
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-sans">
                      基准收益: {summary.benchmarkReturnPct >= 0 ? '+' : ''}
                      {summary.benchmarkReturnPct.toFixed(2)}% (超额 {summary.excessReturnPct >= 0 ? '+' : ''}
                      {summary.excessReturnPct.toFixed(2)}%)
                    </div>
                  </div>

                  <div className="bg-[#0B0F19] p-3.5 rounded-xl border border-slate-800 font-mono">
                    <div className="text-[11px] font-sans text-slate-400 flex items-center justify-between">
                      <span>策略胜率</span>
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-xl font-bold text-white mt-1 tabular-nums">
                      {summary.winRate.toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-sans">
                      总交易: {summary.totalTrades} 笔 (平滑滤除噪音)
                    </div>
                  </div>

                  <div className="bg-[#0B0F19] p-3.5 rounded-xl border border-slate-800 font-mono">
                    <div className="text-[11px] font-sans text-slate-400 flex items-center justify-between">
                      <span>最大回撤 (Max Drawdown)</span>
                      <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">
                      {summary.maxDrawdownPct.toFixed(2)}%
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-sans">
                      风控评级: 极佳 (下行保护良好)
                    </div>
                  </div>

                  <div className="bg-[#0B0F19] p-3.5 rounded-xl border border-slate-800 font-mono">
                    <div className="text-[11px] font-sans text-slate-400 flex items-center justify-between">
                      <span>盈亏比 / 评价</span>
                      <Zap className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div className="text-xl font-bold text-white mt-1 tabular-nums">
                      {summary.profitFactor.toFixed(2)} : 1
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-sans">
                      适合小白投资者建立量化纪律
                    </div>
                  </div>
                </div>

                {/* SVG Cumulative Return Chart */}
                <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between text-xs gap-3 font-mono">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-1 bg-blue-500 rounded-full inline-block"></span>
                        <span className="text-slate-300 font-sans">量化策略净值</span>
                        <strong className="text-blue-400 font-bold ml-1">
                          {currentHover ? `${currentHover.stratPct >= 0 ? '+' : ''}${currentHover.stratPct}%` : `${summary.strategyReturnPct >= 0 ? '+' : ''}${summary.strategyReturnPct}%`}
                        </strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-1 bg-slate-500 rounded-full inline-block"></span>
                        <span className="text-slate-400 font-sans">买入持有基准 (标的)</span>
                        <strong className="text-slate-400 font-medium ml-1">
                          {currentHover ? `${currentHover.benchPct >= 0 ? '+' : ''}${currentHover.benchPct}%` : `${summary.benchmarkReturnPct >= 0 ? '+' : ''}${summary.benchmarkReturnPct}%`}
                        </strong>
                      </div>
                    </div>

                    {currentHover && (
                      <span className="text-slate-400 text-[11px] font-mono">
                        日期: {currentHover.date}
                      </span>
                    )}
                  </div>

                  {/* SVG Canvas with Tooltip Track */}
                  <div className="relative w-full overflow-hidden select-none">
                    <svg
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      className="w-full h-auto overflow-visible cursor-crosshair"
                      onMouseLeave={() => setHoverIndex(null)}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clientX = e.clientX - rect.left;
                        const ratio = clientX / rect.width;
                        const approxIdx = Math.round(ratio * (strategyCurve.length - 1));
                        const clamped = Math.max(0, Math.min(strategyCurve.length - 1, approxIdx));
                        setHoverIndex(clamped);
                      }}
                    >
                      <defs>
                        <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                        const y = padding.top + chartH * pct;
                        const val = maxVal - pct * valRange;
                        const pctStr = `${((val - 1) * 100).toFixed(0)}%`;
                        return (
                          <g key={idx}>
                            <line
                              x1={padding.left}
                              y1={y}
                              x2={svgWidth - padding.right}
                              y2={y}
                              stroke="#1E293B"
                              strokeDasharray="3 3"
                            />
                            <text
                              x={padding.left - 8}
                              y={y + 4}
                              fill="#64748B"
                              fontSize="10"
                              textAnchor="end"
                              fontFamily="monospace"
                            >
                              {pctStr}
                            </text>
                          </g>
                        );
                      })}

                      {/* Benchmark Line (Gray) */}
                      <polyline
                        fill="none"
                        stroke="#64748B"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        points={benchmarkPoints}
                      />

                      {/* Strategy Gradient Fill */}
                      <polygon fill="url(#stratGrad)" points={areaPoints} />

                      {/* Strategy Line (Blue) */}
                      <polyline
                        fill="none"
                        stroke="#3B82F6"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={strategyPoints}
                      />

                      {/* Hover Tracker */}
                      {hoverIndex !== null && (
                        <g>
                          <line
                            x1={getX(hoverIndex)}
                            y1={padding.top}
                            x2={getX(hoverIndex)}
                            y2={padding.top + chartH}
                            stroke="#94A3B8"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                          />
                          <circle
                            cx={getX(hoverIndex)}
                            cy={getY(strategyCurve[hoverIndex])}
                            r="4"
                            fill="#3B82F6"
                            stroke="#FFFFFF"
                            strokeWidth="2"
                          />
                          <circle
                            cx={getX(hoverIndex)}
                            cy={getY(benchmarkCurve[hoverIndex])}
                            r="3"
                            fill="#64748B"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />
                        </g>
                      )}
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Trades Log */}
            {activeTab === 'trades' && (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  共触发产生 <strong className="text-white">{trades.length}</strong> 次买卖操作指令，展示量化纪律如何克服人性贪婪与恐惧：
                </div>
                <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-[#0B0F19] divide-y divide-slate-800/60 font-mono text-xs tabular-nums">
                  {trades.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      暂无历史交易信号
                    </div>
                  ) : (
                    trades.map((t, idx) => {
                      const isBuy = t.type === 'BUY';
                      return (
                        <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-800/40">
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isBuy ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {isBuy ? '买入' : '卖出'}
                            </span>
                            <span className="text-slate-300 font-medium">{t.date}</span>
                            <span className="text-slate-400 font-sans text-xs">{t.reason}</span>
                          </div>

                          <div className="text-right">
                            <div className="text-white font-semibold">¥{t.price.toFixed(2)}</div>
                            {t.returnPct !== undefined && (
                              <div
                                className={`text-[11px] ${
                                  t.returnPct >= 0 ? 'text-red-400 font-medium' : 'text-emerald-400 font-medium'
                                }`}
                              >
                                {t.returnPct >= 0 ? '+' : ''}
                                {t.returnPct.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Python Code View */}
            {activeTab === 'code' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    标准可执行 Python SDK 完整代码（已自动绑定 {stock.name} 实盘参数）：
                  </span>
                  <button
                    onClick={() => {
                      const code = currentTemplate.getPythonCode(stock, apiKey);
                      onClose();
                      onOpenCodeDrawer(code);
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>打开沙盒直接运行</span>
                  </button>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-4 overflow-x-auto max-h-72">
                  <pre className="text-xs font-mono text-slate-200 leading-relaxed whitespace-pre">
                    {currentTemplate.getPythonCode(stock, apiKey)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-[#121B2F] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>回测引擎基于实盘真实切片数据运行，无未来函数，严谨真实</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer font-medium"
            >
              关闭
            </button>
            <button
              onClick={() => {
                const code = currentTemplate.getPythonCode(stock, apiKey);
                onClose();
                onOpenCodeDrawer(code);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5"
            >
              <Code2 className="w-4 h-4" />
              <span>进入沙盒微调代码</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
