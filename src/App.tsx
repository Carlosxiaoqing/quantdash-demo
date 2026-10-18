import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { MarketTicker } from './components/MarketTicker';
import { StockSearchSelector } from './components/StockSearchSelector';
import { CandleChart } from './components/CandleChart';
import { ValuationChart } from './components/ValuationChart';
import { FinancialDuPont } from './components/FinancialDuPont';
import { OrderBookSnapshot } from './components/OrderBookSnapshot';
import { CodeGeneratorDrawer } from './components/CodeGeneratorDrawer';
import { StrategyShowcase } from './components/StrategyShowcase';
import { StrategyBacktestModal } from './components/StrategyBacktestModal';
import { TokenConfigModal } from './components/TokenConfigModal';
import { QuickStartModal } from './components/QuickStartModal';
import { STRATEGY_TEMPLATES } from './data/strategyTemplates';
import { StockSymbol, KlineInterval, KlineBar, IntradayMinutePoint, OrderBook } from './types/stock';
import {
  generateValuationHistory,
  generateFinancialReports,
  generateOrderBook,
  generateKlineData,
  generateMinutePoints,
} from './data/mockStocks';
import {
  queryKlineData,
  getCachedKline,
  fetchLatestQuote,
  fetchLatestEastmoneyBar,
  ALL_SUPPORTED_STOCKS,
} from './services/quantdashService';
import {
  applyIncrementalBarUpdate,
  applyIncrementalMinutePoint,
  resetSessionBarBucket,
  isAsharesTradingTime,
  isMarketTradingTime,
} from './utils/klineIncremental';
import {
  BarChart3,
  PieChart,
  Layers,
  Activity,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  Zap,
} from 'lucide-react';

export default function App() {
  const [currentStock, setCurrentStock] = useState<StockSymbol>(ALL_SUPPORTED_STOCKS[0]);
  const [interval, setKlineInterval] = useState<KlineInterval>('1d');
  const [activeView, setActiveView] = useState<'kline' | 'valuation' | 'financial' | 'depth'>('kline');
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('quantdash_api_key') || '';
  });

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isQuickStartOpen, setIsQuickStartOpen] = useState(false);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);
  const [activeStrategyId, setActiveStrategyId] = useState<string>('dual_ma');
  const [drawerExternalCode, setDrawerExternalCode] = useState<string>('');
  const [drawerAutoRunTrigger, setDrawerAutoRunTrigger] = useState<number>(0);

  const handleOpenStrategyModal = useCallback((strategyId?: string) => {
    if (strategyId) {
      setActiveStrategyId(strategyId);
    }
    setIsStrategyModalOpen(true);
  }, []);

  const handleLoadStrategyCodeToDrawer = useCallback(
    (strategyId: string, autoRun = false) => {
      const tmpl = STRATEGY_TEMPLATES.find((t) => t.id === strategyId);
      if (tmpl) {
        const code = tmpl.getPythonCode(currentStock, apiKey);
        setDrawerExternalCode(code);
        if (autoRun) {
          setDrawerAutoRunTrigger((prev) => prev + 1);
        }
        const el = document.getElementById('code-drawer');
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    [currentStock, apiKey]
  );

  // Dynamic API Query States
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAutoPolling, setIsAutoPolling] = useState(true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(() =>
    new Date().toLocaleTimeString('zh-CN', { hour12: false })
  );
  const [bars, setBars] = useState<KlineBar[]>([]);
  const [minutePoints, setMinutePoints] = useState<IntradayMinutePoint[]>([]);
  const [prevClose, setPrevClose] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState(145);
  const [apiSource, setApiSource] = useState('QuantDash Gateway');
  const [liveOrderBook, setLiveOrderBook] = useState<OrderBook | null>(null);

  // Synchronize localStorage when apiKey changes
  const handleSaveKey = (key: string) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('quantdash_api_key', key);
    } else {
      localStorage.removeItem('quantdash_api_key');
    }
  };

  // State refs to ensure polling and timers always read current state without re-triggering intervals
  const currentStockRef = useRef(currentStock);
  currentStockRef.current = currentStock;

  const intervalRef = useRef(interval);
  intervalRef.current = interval;

  const barsRef = useRef(bars);
  barsRef.current = bars;

  const minutePointsRef = useRef(minutePoints);
  minutePointsRef.current = minutePoints;

  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;

  // Concurrency guard to prevent overlapping in-flight network requests on 1s high-frequency ticks
  const isPollingInProgressRef = useRef(false);

  // Perform dynamic API fetch whenever currentStock or interval changes (with instant cache & non-blocking background fetch)
  const fetchStockData = useCallback(
    async (stock: StockSymbol, freq: KlineInterval, key: string, isFullReload = false) => {
      // 1. Check memory cache for instant 0ms rendering
      const cached = getCachedKline(stock.symbol, freq, stock.price);
      if (cached && !isFullReload) {
        setBars(cached.data.bars || []);
        setMinutePoints(cached.data.minutePoints || []);
        if (cached.data.prevClose) setPrevClose(cached.data.prevClose);
        setLatencyMs(cached.latencyMs);
        setApiSource(cached.source);
        setLastUpdatedTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
        setIsLoading(false);
        return;
      }

      // 2. If no cache and bars are empty, supply instant fallback bars & points anchored strictly to current stock.price
      if (barsRef.current.length === 0 || barsRef.current[0]?.date === undefined) {
        const instantBars = generateKlineData(stock, freq, 80);
        const instantPoints = generateMinutePoints(stock);
        setBars(instantBars);
        setMinutePoints(instantPoints);
        setPrevClose(stock.prevClose || stock.price);
      }

      // Non-intrusive refresh indicator (only show full loading overlay on cold empty start)
      if (barsRef.current.length === 0) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const [response, quote] = await Promise.all([
          queryKlineData(stock, freq, key, isFullReload),
          fetchLatestQuote(stock).catch(() => null),
        ]);
        setBars(response.data.bars || []);
        setMinutePoints(response.data.minutePoints || []);
        if (response.data.prevClose) {
          setPrevClose(response.data.prevClose);
        }
        setLatencyMs(response.latencyMs);
        setApiSource(response.source);
        setLastUpdatedTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));

        if (quote && quote.price > 0) {
          if (quote.orderBook) {
            setLiveOrderBook(quote.orderBook);
          }
          setCurrentStock((prev) => {
            if (prev.symbol !== stock.symbol) return prev;
            return {
              ...prev,
              price: quote.price,
              change: quote.change,
              changePercent: quote.changePercent,
              open: quote.open || prev.open,
              high: Math.max(quote.high || 0, prev.high),
              low: quote.low ? Math.min(quote.low, prev.low || quote.low) : prev.low,
              prevClose: quote.prevClose || prev.prevClose,
              volume: quote.volume || prev.volume,
              amount: quote.amount || prev.amount,
              turnoverRate: quote.turnoverRate ?? prev.turnoverRate,
              peTTM: quote.peTTM ?? prev.peTTM,
              pb: quote.pb ?? prev.pb,
              marketCap: quote.marketCap ?? prev.marketCap,
            };
          });
        } else if (response.updatedStock) {
          setCurrentStock((prev) => {
            if (
              prev.symbol === response.updatedStock!.symbol &&
              prev.name === response.updatedStock!.name &&
              prev.price === response.updatedStock!.price
            ) {
              return prev;
            }
            return response.updatedStock!;
          });
        }
      } catch {
        // Fallback resilience
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  // Initial load and dependency trigger when symbol or interval changes
  useEffect(() => {
    fetchStockData(currentStock, interval, apiKey, false);
  }, [currentStock.symbol, interval, apiKey, fetchStockData]);

  // Real-time Incremental Auto-Polling (every 1 second)
  // Reverse-engineered Eastmoney logic: preserves historical bars and strictly updates the active latest bar incrementally
  useEffect(() => {
    if (!isAutoPolling) return;

    const pollTimer = setInterval(async () => {
      // 1. Guard against request overlap: if previous 1s fetch is still processing, skip this tick cleanly
      if (isPollingInProgressRef.current) return;

      // 2. Tab background optimization: if tab is hidden, skip ticking to save client CPU & bandwidth
      if (typeof document !== 'undefined' && document.hidden) return;

      const activeStock = currentStockRef.current;
      const activeInterval = intervalRef.current;
      const currentBars = barsRef.current;
      const currentPoints = minutePointsRef.current;

      // Adaptive multi-market polling supporting 24/7 continuous dynamic simulation & live updates
      if (!isMarketTradingTime(activeStock.market)) {
        return;
      }

      isPollingInProgressRef.current = true;
      try {
        if (activeInterval === 'timeline') {
          // Intraday timeline incremental update
          let quote = await fetchLatestQuote(activeStock);
          if (!quote || quote.price <= 0) {
            // Adaptive micro-tick: realistic smooth micro fluctuation
            const microDelta = (Math.random() - 0.49) * (activeStock.price * 0.0006);
            const simPrice = +(activeStock.price + microDelta).toFixed(2);
            quote = {
              price: simPrice,
              prevClose: activeStock.prevClose || simPrice,
              open: activeStock.open || simPrice,
              high: Math.max(activeStock.high, simPrice),
              low: Math.min(activeStock.low, simPrice),
              volume: activeStock.volume + Math.floor(Math.random() * 25 + 5),
              amount: activeStock.amount + Math.floor(simPrice * 100),
              change: +(simPrice - (activeStock.prevClose || simPrice)).toFixed(2),
              changePercent:
                activeStock.prevClose > 0
                  ? +(((simPrice - activeStock.prevClose) / activeStock.prevClose) * 100).toFixed(2)
                  : 0,
              name: activeStock.name,
              turnoverRate: activeStock.turnoverRate,
              peTTM: activeStock.peTTM,
              pb: activeStock.pb,
              marketCap: activeStock.marketCap,
              orderBook: generateOrderBook(simPrice),
            };
          }

          if (quote && quote.price > 0 && currentPoints.length > 0) {
            const updatedPoints = applyIncrementalMinutePoint(
              currentPoints,
              quote.price,
              quote.prevClose,
              Math.floor(Math.random() * 25 + 5)
            );
            setMinutePoints(updatedPoints);

            if (quote.orderBook) {
              setLiveOrderBook(quote.orderBook);
            }
            setCurrentStock((prev) => {
              if (prev.symbol !== activeStock.symbol) return prev;
              return {
                ...prev,
                price: quote!.price,
                high: Math.max(prev.high, quote!.high),
                low: Math.min(prev.low, quote!.low),
                change: quote!.change,
                changePercent: quote!.changePercent,
                volume: quote!.volume > prev.volume ? quote!.volume : prev.volume + 50,
                turnoverRate: quote!.turnoverRate ?? prev.turnoverRate,
                peTTM: quote!.peTTM ?? prev.peTTM,
                pb: quote!.pb ?? prev.pb,
                marketCap: quote!.marketCap ?? prev.marketCap,
              };
            });
            setLastUpdatedTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
          }
        } else {
          // 1m, 5m, 15m, 30m, 60m, 1d, 1w K-line incremental update:
          let emBar: KlineBar | null = null;
          if (activeStock.market === 'CN') {
            emBar = await fetchLatestEastmoneyBar(activeStock, activeInterval);
          }

          if (emBar && currentBars.length > 0) {
            const lastIndex = currentBars.length - 1;
            const lastBar = currentBars[lastIndex];

            if (emBar.date === lastBar.date) {
              // Same candle: update in place
              const updated = applyIncrementalBarUpdate(
                currentBars,
                {
                  price: emBar.close,
                  high: emBar.high,
                  low: emBar.low,
                  deltaVolume: Math.max(0, emBar.volume - lastBar.volume),
                  deltaAmount: Math.max(0, emBar.amount - lastBar.amount),
                },
                activeInterval
              );
              setBars(updated);
            } else if (emBar.date > lastBar.date) {
              // Real-world turnover: new bar opened on Eastmoney
              const updated = [...currentBars.slice(currentBars.length >= 90 ? 1 : 0), emBar];
              setBars(updated);
            }

            setCurrentStock((prev) => {
              if (prev.symbol !== activeStock.symbol) return prev;
              return {
                ...prev,
                price: emBar!.close,
                high: Math.max(prev.high, emBar!.high),
                low: Math.min(prev.low, emBar!.low),
                volume: emBar!.volume > prev.volume ? emBar!.volume : prev.volume,
              };
            });
            setLastUpdatedTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
          } else {
            // Live quote or adaptive micro-tick for US/HK/any market
            let quote = await fetchLatestQuote(activeStock);
            if (!quote || quote.price <= 0) {
              const microDelta = (Math.random() - 0.49) * (activeStock.price * 0.0006);
              const simPrice = +(activeStock.price + microDelta).toFixed(2);
              quote = {
                price: simPrice,
                prevClose: activeStock.prevClose || simPrice,
                open: activeStock.open || simPrice,
                high: Math.max(activeStock.high, simPrice),
                low: Math.min(activeStock.low, simPrice),
                volume: activeStock.volume + Math.floor(Math.random() * 20 + 5),
                amount: activeStock.amount + Math.floor(simPrice * 100),
                change: +(simPrice - (activeStock.prevClose || simPrice)).toFixed(2),
                changePercent:
                  activeStock.prevClose > 0
                    ? +(((simPrice - activeStock.prevClose) / activeStock.prevClose) * 100).toFixed(2)
                    : 0,
                name: activeStock.name,
                turnoverRate: activeStock.turnoverRate,
                peTTM: activeStock.peTTM,
                pb: activeStock.pb,
                marketCap: activeStock.marketCap,
                orderBook: generateOrderBook(simPrice),
              };
            }

            if (quote && quote.price > 0 && currentBars.length > 0) {
              const updatedBars = applyIncrementalBarUpdate(
                currentBars,
                {
                  price: quote.price,
                  high: quote.high,
                  low: quote.low,
                  deltaVolume: Math.floor(Math.random() * 20 + 5),
                },
                activeInterval
              );
              setBars(updatedBars);

              if (quote.orderBook) {
                setLiveOrderBook(quote.orderBook);
              }
              setCurrentStock((prev) => {
                if (prev.symbol !== activeStock.symbol) return prev;
                return {
                  ...prev,
                  price: quote!.price,
                  high: Math.max(prev.high, quote!.high),
                  low: Math.min(prev.low, quote!.low),
                  change: quote!.change,
                  changePercent: quote!.changePercent,
                  volume: quote!.volume > prev.volume ? quote!.volume : prev.volume + 50,
                  turnoverRate: quote!.turnoverRate ?? prev.turnoverRate,
                  peTTM: quote!.peTTM ?? prev.peTTM,
                  pb: quote!.pb ?? prev.pb,
                  marketCap: quote!.marketCap ?? prev.marketCap,
                };
              });
              setLastUpdatedTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
            }
          }
        }
      } catch {
        // silent resilient polling
      } finally {
        isPollingInProgressRef.current = false;
      }
    }, 1000);

    const handleVisibilityChange = () => {
      if (!document.hidden && isAutoPolling) {
        fetchStockData(currentStockRef.current, intervalRef.current, apiKeyRef.current, true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAutoPolling, fetchStockData]);

  // Handler for user selecting or searching a stock
  const handleSelectStock = (stock: StockSymbol) => {
    if (stock.symbol === currentStock.symbol) return;
    resetSessionBarBucket();

    // Check if we have cached bars matching current target price
    const cached = getCachedKline(stock.symbol, interval, stock.price);
    if (cached) {
      setBars(cached.data.bars || []);
      setMinutePoints(cached.data.minutePoints || []);
      if (cached.data.prevClose) setPrevClose(cached.data.prevClose);
    } else {
      // Immediately initialize baseline bars & minute points in <1ms anchored strictly to stock.price
      const instantBars = generateKlineData(stock, interval, 80);
      const instantPoints = generateMinutePoints(stock);
      setBars(instantBars);
      setMinutePoints(instantPoints);
      setPrevClose(stock.prevClose || stock.price);
    }

    setCurrentStock(stock);
    // Trigger fresh load aligned with the newly selected stock
    fetchStockData(stock, interval, apiKey, true);
  };

  // Handler for changing interval
  const handleChangeInterval = (newInterval: KlineInterval) => {
    if (newInterval === interval) return;
    resetSessionBarBucket();
    setKlineInterval(newInterval);
  };

  // Handler for manual refresh
  const handleRefreshNow = () => {
    fetchStockData(currentStock, interval, apiKey, true);
  };

  const valuationData = useMemo(() => {
    return generateValuationHistory(currentStock);
  }, [currentStock]);

  const financialReports = useMemo(() => {
    return generateFinancialReports(currentStock);
  }, [currentStock]);

  const orderBook = useMemo(() => {
    if (liveOrderBook) return liveOrderBook;
    return generateOrderBook(currentStock.price);
  }, [liveOrderBook, currentStock.price]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. Top Navigation Bar */}
      <Header
        hasCustomKey={apiKey.trim().length > 0}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        onOpenQuickStart={() => setIsQuickStartOpen(true)}
        onOpenStrategyModal={() => handleOpenStrategyModal()}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* 2. Real-time Market Indices Ticker */}
      <MarketTicker />

      {/* 3. Main Workspace Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Top Control Bar: Stock Search & Real-time Metrics Strip */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0F172A]/80 border border-slate-800 p-4 rounded-2xl">
          {/* Real-time Dynamic Stock Search Selector */}
          <StockSearchSelector
            currentStock={currentStock}
            onSelectStock={handleSelectStock}
            isLoading={isLoading}
          />

          {/* Quick Metrics Strip */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs tabular-nums text-slate-400">
            <div className="w-[72px] shrink-0 text-left">
              <span className="text-slate-500 font-sans">开盘: </span>
              <span className="text-white">{currentStock.open.toFixed(2)}</span>
            </div>
            <div className="w-[72px] shrink-0 text-left">
              <span className="text-slate-500 font-sans">最高: </span>
              <span className="text-white">{currentStock.high.toFixed(2)}</span>
            </div>
            <div className="w-[72px] shrink-0 text-left">
              <span className="text-slate-500 font-sans">最低: </span>
              <span className="text-white">{currentStock.low.toFixed(2)}</span>
            </div>
            <div className="w-[110px] shrink-0 text-left">
              <span className="text-slate-500 font-sans">成交额: </span>
              <span className="text-white">
                {(currentStock.amount / 100000000).toFixed(2)} 亿
              </span>
            </div>
            <div className="w-[85px] shrink-0 text-left">
              <span className="text-slate-500 font-sans">换手率: </span>
              <span className="text-white">{currentStock.turnoverRate.toFixed(2)}%</span>
            </div>
            <div className="w-[85px] shrink-0 text-left">
              <span className="text-slate-500 font-sans">PE(TTM): </span>
              <span className="text-blue-400 font-semibold">{currentStock.peTTM.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs (For mobile & direct toggle) */}
        <div className="flex lg:hidden flex-wrap items-center gap-1.5 pb-1">
          {[
            { id: 'kline', label: '行情K线与指标', icon: BarChart3 },
            { id: 'valuation', label: '估值波段分析', icon: PieChart },
            { id: 'financial', label: '杜邦财务透视', icon: Layers },
            { id: 'depth', label: '五档深度盘口', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                className={`px-3 py-2 text-xs font-medium rounded-xl border flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Analysis View */}
        <div className="transition-all duration-200">
          {activeView === 'kline' && (
            <CandleChart
              stock={currentStock}
              bars={bars}
              minutePoints={minutePoints}
              prevClose={prevClose || currentStock.prevClose || currentStock.price}
              interval={interval}
              onChangeInterval={handleChangeInterval}
              onOpenCode={() => {
                const el = document.getElementById('code-drawer');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              isLoading={isLoading}
              latencyMs={latencyMs}
              apiSource={apiSource}
              isAutoPolling={isAutoPolling}
              onToggleAutoPolling={() => setIsAutoPolling((prev) => !prev)}
              lastUpdatedTime={lastUpdatedTime}
              onRefreshNow={handleRefreshNow}
              isRefreshing={isRefreshing}
              onOpenStrategyModal={() => handleOpenStrategyModal()}
            />
          )}

          {activeView === 'valuation' && (
            <ValuationChart
              stock={currentStock}
              valuationData={valuationData}
              onOpenCode={() => {
                const el = document.getElementById('code-drawer');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          )}

          {activeView === 'financial' && (
            <FinancialDuPont
              stock={currentStock}
              reports={financialReports}
              onOpenCode={() => {
                const el = document.getElementById('code-drawer');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          )}

          {activeView === 'depth' && (
            <OrderBookSnapshot
              stock={currentStock}
              orderBook={orderBook}
              onOpenCode={() => {
                const el = document.getElementById('code-drawer');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          )}
        </div>

        {/* 4. Strategy Showcase Section for Beginners */}
        <StrategyShowcase
          stock={currentStock}
          bars={bars}
          orderBook={orderBook}
          apiKey={apiKey}
          onOpenBacktestModal={handleOpenStrategyModal}
          onLoadStrategyCodeToDrawer={handleLoadStrategyCodeToDrawer}
        />

        {/* 5. Real-time Linked Code Generator & Execution Drawer */}
        <div id="code-drawer">
          <CodeGeneratorDrawer
            stock={currentStock}
            interval={interval}
            apiKey={apiKey}
            bars={bars}
            onOpenStrategyModal={handleOpenStrategyModal}
            externalCode={drawerExternalCode}
            autoRunTrigger={drawerAutoRunTrigger}
          />
        </div>

        {/* 5. QuantDash Value Proposition / Promotion Banner */}
        <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-900/50 rounded-2xl p-6 relative overflow-hidden">
          <div className="max-w-3xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-medium">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span>全市场实时接入 · 输入标的自动发起 QuantDash API 异步查询</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              告别繁琐的金融爬虫与脏数据清洗，直接调用 QuantDash API
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              QuantDash 覆盖全市场 A 股、港股、美股的高频行情 K 线、实时盘口、估值模型与标准化财务报表。
              只需几行简洁 Python 代码，即可将数据无缝导入 Pandas、Excel 进行策略回测与深度分析。
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="https://quantdash.net/"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-colors flex items-center gap-1.5"
              >
                <span>立即前往 QuantDash 官网注册</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href="https://docs.quantdash.net/zh-Hans/sdk/python-quickstart"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>查阅 Python SDK 快速入门</span>
              </a>

              <button
                onClick={() => setIsQuickStartOpen(true)}
                className="px-4 py-2 text-blue-400 hover:text-blue-300 text-xs font-medium cursor-pointer"
              >
                查看新手 3 分钟上手指引 →
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 6. Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0E131F] py-6 px-4 sm:px-8 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">QuantDash</span>
            <span>·</span>
            <span>零代码量化数据体验中心</span>
            <span>·</span>
            <span>为开发者与量化投资者打造</span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://quantdash.net/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              产品主页 (quantdash.net)
            </a>
            <a
              href="https://docs.quantdash.net/zh-Hans"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              官方文档中心
            </a>
            <a
              href="https://docs.quantdash.net/zh-Hans/sdk/python-quickstart"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              Python SDK 指南
            </a>
          </div>
        </div>
      </footer>

      {/* 7. Modals */}
      <TokenConfigModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveKey={handleSaveKey}
      />

      <QuickStartModal
        isOpen={isQuickStartOpen}
        onClose={() => setIsQuickStartOpen(false)}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
      />

      <StrategyBacktestModal
        isOpen={isStrategyModalOpen}
        onClose={() => setIsStrategyModalOpen(false)}
        stock={currentStock}
        bars={bars}
        orderBook={orderBook}
        apiKey={apiKey}
        initialStrategyId={activeStrategyId}
        onOpenCodeDrawer={(code?: string) => {
          if (code) {
            setDrawerExternalCode(code);
            setDrawerAutoRunTrigger((prev) => prev + 1);
          }
          const el = document.getElementById('code-drawer');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
    </div>
  );
}
