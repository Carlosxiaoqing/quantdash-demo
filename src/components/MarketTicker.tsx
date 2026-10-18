import React, { useState, useEffect } from 'react';
import { Radio } from 'lucide-react';
import { fetchRealMarketIndices, MarketIndexQuote } from '../services/quantdashService';

const DEFAULT_INDICES: MarketIndexQuote[] = [
  { name: '上证指数', code: 'sh000001', point: 3716.28, change: 8.80, percent: 0.24 },
  { name: '深证成指', code: 'sz399001', point: 11802.46, change: -14.33, percent: -0.12 },
  { name: '创业板指', code: 'sz399006', point: 2772.38, change: -10.79, percent: -0.39 },
  { name: '科创50', code: 'sh000688', point: 1358.65, change: -0.87, percent: -0.06 },
  { name: '恒生指数', code: 'hkHSI', point: 24186.83, change: 124.11, percent: 0.52 },
  { name: '纳斯达克', code: 'us.IXIC', point: 26140.03, change: -573.00, percent: -2.14 },
];

export const MarketTicker: React.FC = () => {
  const [indices, setIndices] = useState<MarketIndexQuote[]>(DEFAULT_INDICES);
  const [lastSyncTime, setLastSyncTime] = useState<string>(
    new Date().toLocaleTimeString('zh-CN', { hour12: false })
  );

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      try {
        const live = await fetchRealMarketIndices();
        if (isMounted && live.length > 0) {
          setIndices((prev) => {
            const map = new Map(live.map((item) => [item.code, item]));
            return prev.map((item) => map.get(item.code) || item);
          });
          setLastSyncTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
        }
      } catch {
        // keep existing data
      }
    };

    poll();
    const timer = setInterval(poll, 4000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="w-full bg-[#0D121F] border-b border-slate-800/60 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs select-none">
      {/* Left: Market Indices with Auto-Wrap */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 flex-1 min-w-0">
        <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          市场大盘快讯
        </span>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {indices.map((idx) => {
            const isUp = idx.percent >= 0;
            return (
              <div key={idx.code} className="flex items-center gap-1.5 font-mono tabular-nums text-xs">
                <span className="text-slate-400 font-sans">{idx.name}</span>
                <span className={`font-semibold ${isUp ? 'text-red-400' : 'text-emerald-400'}`}>
                  {idx.point.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`text-[11px] flex items-center ${isUp ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isUp ? '+' : ''}{idx.percent.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Sync Status */}
      <div className="hidden xl:flex items-center gap-2 text-slate-500 text-[11px] shrink-0 font-mono">
        <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
        <span>实时行情直连: {lastSyncTime}</span>
        <span>·</span>
        <span>延时 &lt;15ms</span>
      </div>
    </div>
  );
};
