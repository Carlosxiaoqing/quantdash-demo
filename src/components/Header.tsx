import React from 'react';
import { KeyRound, ExternalLink, BookOpen, Sparkles, Terminal } from 'lucide-react';

interface HeaderProps {
  hasCustomKey: boolean;
  onOpenKeyModal: () => void;
  onOpenQuickStart: () => void;
  onOpenStrategyModal: () => void;
  activeView: 'kline' | 'valuation' | 'financial' | 'depth';
  setActiveView: (view: 'kline' | 'valuation' | 'financial' | 'depth') => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasCustomKey,
  onOpenKeyModal,
  onOpenQuickStart,
  onOpenStrategyModal,
  activeView,
  setActiveView,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800/80 bg-[#0E131F]/90 backdrop-blur-md sticky top-0 z-40">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20">
          QD
        </div>
        <a href="/" className="text-base font-bold tracking-tight text-white whitespace-nowrap hover:text-blue-400 transition-colors flex items-center gap-2">
          <span>QuantDash</span>
          <span className="text-xs font-normal text-slate-400 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">
            零代码量化体验台
          </span>
        </a>
      </div>

      {/* Zone 2: 4–5 clean single-line text navigation links */}
      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
        <button
          onClick={() => setActiveView('kline')}
          className={`cursor-pointer whitespace-nowrap transition-colors pb-1 border-b-2 ${
            activeView === 'kline'
              ? 'text-blue-400 border-blue-500 font-semibold'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          行情K线与指标
        </button>
        <button
          onClick={() => setActiveView('valuation')}
          className={`cursor-pointer whitespace-nowrap transition-colors pb-1 border-b-2 ${
            activeView === 'valuation'
              ? 'text-blue-400 border-blue-500 font-semibold'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          估值波段分析
        </button>
        <button
          onClick={() => setActiveView('financial')}
          className={`cursor-pointer whitespace-nowrap transition-colors pb-1 border-b-2 ${
            activeView === 'financial'
              ? 'text-blue-400 border-blue-500 font-semibold'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          杜邦财务透视
        </button>
        <button
          onClick={() => setActiveView('depth')}
          className={`cursor-pointer whitespace-nowrap transition-colors pb-1 border-b-2 ${
            activeView === 'depth'
              ? 'text-blue-400 border-blue-500 font-semibold'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          五档深度盘口
        </button>
        <button
          onClick={onOpenStrategyModal}
          className="cursor-pointer whitespace-nowrap text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 font-medium"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>量化策略回测</span>
        </button>
        <button
          onClick={onOpenQuickStart}
          className="cursor-pointer whitespace-nowrap text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>新手3分钟指引</span>
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenKeyModal}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            hasCustomKey
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/40'
              : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="配置您的专属 QuantDash API Key"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>{hasCustomKey ? '已连接专属 Key' : '沙盒模式 (可配置Key)'}</span>
        </button>

        <a
          href="https://quantdash.net/"
          target="_blank"
          rel="noreferrer"
          className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 active:bg-blue-700 transition-colors whitespace-nowrap shadow-sm shadow-blue-500/30 flex items-center gap-1.5"
        >
          <span>申请 QuantDash API</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </header>
  );
};
