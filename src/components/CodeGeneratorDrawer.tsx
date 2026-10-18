import React, { useState, useEffect, useRef } from 'react';
import { StockSymbol, KlineInterval, CodeTab, KlineBar } from '../types/stock';
import { generateSnippet } from '../services/codeSnippetService';
import { executePythonSnippet, PythonExecutionResult } from '../services/pythonRunnerService';
import { STRATEGY_TEMPLATES } from '../data/strategyTemplates';
import {
  Copy,
  Check,
  Terminal,
  ExternalLink,
  Sparkles,
  Play,
  RotateCcw,
  Table,
  CheckCircle2,
  FileCode2,
  Download,
  Flame,
  Zap,
  TrendingUp,
  Award,
  ShieldAlert,
} from 'lucide-react';

interface CodeGeneratorDrawerProps {
  stock: StockSymbol;
  interval: KlineInterval;
  apiKey: string;
  bars: KlineBar[];
  onOpenStrategyModal?: (strategyId?: string) => void;
  externalCode?: string;
  autoRunTrigger?: number;
}

export const CodeGeneratorDrawer: React.FC<CodeGeneratorDrawerProps> = ({
  stock,
  interval,
  apiKey,
  bars,
  onOpenStrategyModal,
  externalCode,
  autoRunTrigger,
}) => {
  const [activeTab, setActiveTab] = useState<CodeTab>('sdk');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [customCode, setCustomCode] = useState('');

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<PythonExecutionResult | null>(null);
  const [terminalView, setTerminalView] = useState<'console' | 'dataframe'>('console');

  // Generate standard snippet
  const standardSnippet = generateSnippet({
    symbol: stock.symbol,
    stockName: stock.name,
    interval,
    apiKey,
    tab: activeTab,
  });

  // Keep customCode updated if not explicitly modified
  useEffect(() => {
    if (!isEditing) {
      setCustomCode(standardSnippet);
    }
  }, [standardSnippet, isEditing]);

  // Handle external code injection from strategy showcase
  useEffect(() => {
    if (externalCode && externalCode.trim().length > 0) {
      setCustomCode(externalCode);
      setIsEditing(true);
    }
  }, [externalCode]);

  // Handle auto-run trigger from external strategy cards
  const prevTriggerRef = useRef(autoRunTrigger);
  useEffect(() => {
    if (autoRunTrigger && autoRunTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = autoRunTrigger;
      const codeToRun = externalCode || customCode || standardSnippet;
      setIsRunning(true);
      setExecutionResult(null);
      executePythonSnippet(codeToRun, stock, interval, bars, apiKey).then((result) => {
        setExecutionResult(result);
        setIsRunning(false);
      });
    }
  }, [autoRunTrigger, externalCode, customCode, standardSnippet, stock, interval, bars, apiKey]);

  const activeCode = isEditing ? customCode : standardSnippet;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRunCode = async (codeToRun?: string) => {
    setIsRunning(true);
    setExecutionResult(null);

    const target = codeToRun || activeCode;
    const result = await executePythonSnippet(target, stock, interval, bars, apiKey);
    setExecutionResult(result);
    setIsRunning(false);
  };

  const handleResetCode = () => {
    setIsEditing(false);
    setCustomCode(standardSnippet);
    setExecutionResult(null);
  };

  return (
    <div className="bg-[#0F172A]/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-0">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-slate-800 bg-[#12192B]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Python SDK 代码生成与在线执行沙盒</span>
              <span className="text-[11px] font-normal text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
                可在线直接运行
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              当前标的: <strong className="text-white">{stock.name} ({stock.symbol})</strong> · 周期:{' '}
              <strong className="text-white">{interval}</strong>
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              setActiveTab('sdk');
              setIsEditing(false);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'sdk' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Python SDK (官方)
          </button>
          <button
            onClick={() => {
              setActiveTab('pandas_excel');
              setIsEditing(false);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'pandas_excel' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            导出 Excel 脚本
          </button>
          <button
            onClick={() => {
              setActiveTab('requests');
              setIsEditing(false);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'requests' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            原生 Requests
          </button>
          <button
            onClick={() => {
              setActiveTab('curl');
              setIsEditing(false);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'curl' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            cURL 命令
          </button>
        </div>
      </div>

      {/* Strategy Templates Quick Shelf */}
      <div className="flex flex-wrap items-center gap-2 py-2.5 px-4 bg-[#0B0F19] border-b border-slate-800/80 text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1.5 shrink-0">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>小白策略一键装载:</span>
        </span>
        {STRATEGY_TEMPLATES.map((tmpl) => (
          <div key={tmpl.id} className="flex items-center rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 overflow-hidden">
            <button
              onClick={() => {
                const code = tmpl.getPythonCode(stock, apiKey);
                setCustomCode(code);
                setIsEditing(true);
              }}
              className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={tmpl.tagline}
            >
              {tmpl.title}
            </button>
            <button
              onClick={() => {
                const code = tmpl.getPythonCode(stock, apiKey);
                setCustomCode(code);
                setIsEditing(true);
                handleRunCode(code);
              }}
              className="px-1.5 py-1 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white transition-colors cursor-pointer border-l border-slate-800"
              title="立即运行此策略"
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
          </div>
        ))}
        {onOpenStrategyModal && (
          <button
            onClick={() => onOpenStrategyModal()}
            className="px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition-colors cursor-pointer flex items-center gap-1 font-medium sm:ml-auto"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>查看收益曲线与胜率大屏 &gt;</span>
          </button>
        )}
      </div>

      {/* 2. Code Editor Area */}
      <div className="relative bg-[#090D16] p-4 font-mono text-xs text-slate-200">
        {/* Top Right Action Buttons */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          {isEditing && (
            <button
              onClick={handleResetCode}
              className="px-2.5 py-1.5 rounded-lg text-xs font-sans font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 cursor-pointer"
              title="恢复为默认生成的代码"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重置</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>已复制全部代码！</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>一键复制代码</span>
              </>
            )}
          </button>

          {/* RUN BUTTON */}
          <button
            onClick={() => handleRunCode()}
            disabled={isRunning}
            className="px-4 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all flex items-center gap-1.5 shadow-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? '正在运行 Python...' : '▶ 立即在线运行 Python 代码'}</span>
          </button>
        </div>

        {/* Editable Textarea / Code Area */}
        <div className="pt-8">
          <textarea
            value={activeCode}
            onChange={(e) => {
              setIsEditing(true);
              setCustomCode(e.target.value);
            }}
            rows={13}
            className="w-full bg-transparent font-mono text-xs text-slate-300 leading-relaxed focus:outline-none resize-y selection:bg-blue-600 selection:text-white"
            placeholder="在此编辑 Python 代码并点击右上角运行..."
            spellCheck={false}
          />
        </div>
      </div>

      {/* 3. In-Browser Interactive Execution Terminal Output */}
      {executionResult && (
        <div className="border-t border-slate-800 bg-[#060A12] p-4 space-y-3">
          {/* Strategy Performance Highlights Banner (When strategy was executed) */}
          {executionResult.strategyResult && (
            <div className="bg-[#0E1526] border border-blue-900/60 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-white font-bold flex items-center gap-2">
                    <span>{executionResult.strategyResult.strategyName}</span>
                    <span className="text-[11px] text-blue-400 font-sans font-normal px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/40">
                      回测完成
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                    基于 {stock.name} 真实历史数据模拟
                  </div>
                </div>
              </div>

              {/* 4 Metrics Strip */}
              <div className="flex items-center gap-5 text-xs tabular-nums">
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">策略累计收益</div>
                  <div className={`font-bold ${executionResult.strategyResult.summary.strategyReturnPct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {executionResult.strategyResult.summary.strategyReturnPct >= 0 ? '+' : ''}
                    {executionResult.strategyResult.summary.strategyReturnPct.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">大盘基准</div>
                  <div className="font-medium text-slate-300">
                    {executionResult.strategyResult.summary.benchmarkReturnPct >= 0 ? '+' : ''}
                    {executionResult.strategyResult.summary.benchmarkReturnPct.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">策略胜率</div>
                  <div className="font-bold text-amber-300">
                    {executionResult.strategyResult.summary.winRate.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">最大回撤</div>
                  <div className="font-medium text-emerald-400">
                    {executionResult.strategyResult.summary.maxDrawdownPct.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Action Button to Open Full Visual Curve */}
              {onOpenStrategyModal && (
                <button
                  onClick={() => onOpenStrategyModal(executionResult.strategyResult?.strategyId)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-sans font-semibold transition-all shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>查看完整净值对比曲线图 &gt;</span>
                </button>
              )}
            </div>
          )}

          {/* Terminal Title Bar */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-white font-mono">
                终端执行输出 (Terminal stdout)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                · 运行耗时: {executionResult.executionTimeMs}ms
              </span>
            </div>

            {/* View switcher between console logs and DataFrame table */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setTerminalView('console')}
                className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  terminalView === 'console' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3 h-3" />
                <span>标准输出控制台</span>
              </button>
              <button
                onClick={() => setTerminalView('dataframe')}
                className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  terminalView === 'dataframe' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Table className="w-3 h-3" />
                <span>Pandas DataFrame 表格 ({executionResult.dataFrame?.totalRows} 行)</span>
              </button>
            </div>
          </div>

          {/* Terminal Console View */}
          {terminalView === 'console' && (
            <div className="p-3 bg-black/60 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-1 overflow-x-auto max-h-60 leading-relaxed">
              {executionResult.stdout.map((line, idx) => {
                let color = 'text-slate-300';
                if (line.includes('[INFO]')) color = 'text-cyan-400';
                if (line.includes('[AUTH]')) color = 'text-amber-400';
                if (line.includes('[API]')) color = 'text-blue-400';
                if (line.includes('[OK]')) color = 'text-emerald-400 font-semibold';
                if (line.includes('===') || line.includes('---')) color = 'text-slate-500 font-bold';
                if (line.includes('收益率') || line.includes('RSI') || line.includes('胜率') || line.includes('阿尔法')) color = 'text-amber-400 font-semibold';
                if (line.includes('金叉') || line.includes('买入') || line.includes('▲')) color = 'text-red-400 font-semibold';
                if (line.includes('死叉') || line.includes('平仓') || line.includes('▼')) color = 'text-emerald-400 font-semibold';
                return (
                  <div key={idx} className={color}>
                    {line}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pandas DataFrame Table View */}
          {terminalView === 'dataframe' && executionResult.dataFrame && (
            <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-60">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#121B2F] text-slate-400 text-[11px] uppercase tracking-wider sticky top-0">
                  <tr>
                    {executionResult.dataFrame.columns.map((col, idx) => (
                      <th key={idx} className="p-2 border-b border-slate-800 font-semibold">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-black/40">
                  {executionResult.dataFrame.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-800/30 transition-colors">
                      {row.map((val, cIdx) => (
                        <td key={cIdx} className="p-2 text-slate-300">
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Success Banner */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Python 脚本在当前运行环境执行成功</span>
            </div>
            {onOpenStrategyModal && (
              <button
                onClick={() => onOpenStrategyModal(executionResult.strategyResult?.strategyId)}
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer font-medium"
              >
                <span>在可视化图表中查看完整累计收益率与胜率</span>
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
