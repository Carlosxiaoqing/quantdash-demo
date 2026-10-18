import React, { useState, useRef, useEffect, useTransition } from 'react';
import { Search, ChevronDown, Check, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { StockSymbol, MarketType } from '../types/stock';
import { ALL_SUPPORTED_STOCKS, searchStocksInstant, searchStocksOnline, resolveStockSymbol, fetchBatchQuotes, LiveQuote } from '../services/quantdashService';

interface StockSearchSelectorProps {
  currentStock: StockSymbol;
  onSelectStock: (stock: StockSymbol) => void;
  isLoading?: boolean;
}

export const StockSearchSelector: React.FC<StockSearchSelectorProps> = ({
  currentStock,
  onSelectStock,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<StockSymbol[]>(ALL_SUPPORTED_STOCKS);
  const [isSearching, setIsSearching] = useState(false);
  const [marketFilter, setMarketFilter] = useState<'ALL' | MarketType>('ALL');
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveQuote>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Synchronize current stock quote whenever currentStock updates
  useEffect(() => {
    if (currentStock && currentStock.price > 0) {
      setLiveQuotes((prev) => ({
        ...prev,
        [currentStock.symbol]: {
          price: currentStock.price,
          open: currentStock.open,
          high: currentStock.high,
          low: currentStock.low,
          volume: currentStock.volume,
          amount: currentStock.amount,
          change: currentStock.change,
          changePercent: currentStock.changePercent,
          prevClose: currentStock.prevClose,
          name: currentStock.name,
        },
      }));
    }
  }, [currentStock]);

  // Batch-fetch real-time market quotes for popular catalog stocks
  useEffect(() => {
    let active = true;
    const loadRealQuotes = async () => {
      try {
        const topStocks = ALL_SUPPORTED_STOCKS.slice(0, 10);
        const quotes = await fetchBatchQuotes(topStocks);
        if (active && Object.keys(quotes).length > 0) {
          setLiveQuotes((prev) => ({ ...prev, ...quotes }));
        }
      } catch {
        // keep existing
      }
    };

    loadRealQuotes();
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Instant local search + debounced abortable online search
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setSearchResults(ALL_SUPPORTED_STOCKS);
      setIsSearching(false);
      return;
    }

    // 1. Instant 0ms local match so user gets results on the very first keystroke!
    const instant = searchStocksInstant(trimmed);
    if (instant.length > 0) {
      setSearchResults(instant);
    }

    // 2. Abort previous in-flight remote search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchStocksOnline(trimmed, controller.signal);
        if (!controller.signal.aborted) {
          setSearchResults(results);
        }
      } catch {
        // keep instant results
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 120);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm]);

  const filteredStocks = searchResults.filter((s) => {
    if (marketFilter === 'ALL') return true;
    return s.market === marketFilter;
  });

  const getEffectiveStock = (stock: StockSymbol): StockSymbol => {
    if (stock.symbol === currentStock.symbol) {
      return currentStock;
    }
    const live = liveQuotes[stock.symbol];
    if (live && live.price > 0) {
      return {
        ...stock,
        price: live.price,
        change: live.change,
        changePercent: live.changePercent,
        high: live.high || stock.high,
        low: live.low || stock.low,
        open: live.open || stock.open,
        prevClose: live.prevClose || stock.prevClose,
        volume: live.volume || stock.volume,
        amount: live.amount || stock.amount,
      };
    }
    return stock;
  };

  const handleSelect = (stock: StockSymbol) => {
    onSelectStock(getEffectiveStock(stock));
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleQueryCurrentInput = () => {
    const term = searchTerm.trim();
    if (!term) return;

    // Pick top result if available
    if (filteredStocks.length > 0) {
      handleSelect(filteredStocks[0]);
    } else {
      const resolved = resolveStockSymbol(term);
      handleSelect(resolved);
    }
  };

  return (
    <div className="relative w-full lg:w-auto" ref={dropdownRef}>
      {/* Search Trigger Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 rounded-xl text-left transition-all shadow-sm group cursor-pointer w-full sm:w-auto justify-between sm:justify-start"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base tracking-tight">{currentStock.name}</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-blue-400 border border-slate-700/60 tabular-nums">
              {currentStock.symbol}
            </span>
            {isLoading && (
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            )}
          </div>

          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800 font-mono text-xs tabular-nums">
            <span className="text-white font-semibold">{currentStock.price.toFixed(2)}</span>
            <span
              className={
                currentStock.changePercent >= 0
                  ? 'text-red-400 font-medium'
                  : 'text-emerald-400 font-medium'
              }
            >
              {currentStock.changePercent >= 0 ? '+' : ''}
              {currentStock.changePercent.toFixed(2)}%
            </span>
          </div>

          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Quick Popular Switcher Pills */}
        <div className="hidden 2xl:flex flex-wrap items-center gap-1.5">
          {ALL_SUPPORTED_STOCKS.slice(0, 7).map((baseStock) => {
            const stock = getEffectiveStock(baseStock);
            const isSelected = stock.symbol === currentStock.symbol;
            return (
              <button
                key={stock.symbol}
                onClick={() => handleSelect(stock)}
                disabled={isLoading}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <span>{stock.name}</span>
                <span
                  className={`text-[11px] font-mono tabular-nums ${
                    stock.changePercent >= 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {stock.changePercent >= 0 ? '+' : ''}
                  {stock.changePercent.toFixed(1)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full sm:w-[440px] bg-[#111827] border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          {/* Search Input Box */}
          <div className="p-3 border-b border-slate-800 bg-[#0E1524] space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQueryCurrentInput();
                }}
                placeholder="输入股票代码/名称/拼音 (如 002172、澳洋健康、AYJK、600519)"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-14 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                autoFocus
              />
              <button
                onClick={handleQueryCurrentInput}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>查询</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Market Segment Tabs */}
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1">
                {(['ALL', 'CN', 'HK', 'US'] as const).map((m) => {
                  const label =
                    m === 'ALL' ? '全部' : m === 'CN' ? 'A股' : m === 'HK' ? '港股' : '美股';
                  return (
                    <button
                      key={m}
                      onClick={() => setMarketFilter(m)}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        marketFilter === m
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                {isSearching ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    <span>检索全市场中...</span>
                  </>
                ) : (
                  <span>支持 5000+ A股真实名称联想</span>
                )}
              </div>
            </div>
          </div>

          {/* Stocks List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50 p-1.5">
            {filteredStocks.map((baseStock) => {
              const stock = getEffectiveStock(baseStock);
              const isSelected = stock.symbol === currentStock.symbol;
              const isUp = stock.changePercent >= 0;

              return (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelect(stock)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-600/15 border border-blue-500/30' : 'hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 uppercase">
                      {stock.market}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span className="text-blue-300 font-bold">{stock.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                        <span className="text-slate-300">{stock.symbol}</span>
                        <span>·</span>
                        <span className="text-slate-400">{stock.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono tabular-nums">
                    <div className="text-xs font-semibold text-white">{stock.price > 0 ? stock.price.toFixed(2) : '--'}</div>
                    <div className={`text-[11px] ${isUp ? 'text-red-400' : 'text-emerald-400'}`}>
                      {stock.changePercent !== 0 ? (
                        <>
                          {isUp ? '+' : ''}
                          {stock.changePercent.toFixed(2)}%
                        </>
                      ) : (
                        '0.00%'
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Custom direct query row */}
            {searchTerm.trim().length > 0 && (
              <div className="p-2 border-t border-slate-800">
                <button
                  onClick={handleQueryCurrentInput}
                  className="w-full py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 rounded-xl text-xs text-blue-300 font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    点击立即加载标的: "{searchTerm.trim().toUpperCase()}"
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
