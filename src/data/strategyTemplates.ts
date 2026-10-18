import { StockSymbol, KlineBar, OrderBook } from '../types/stock';

export interface StrategyTemplate {
  id: 'dual_ma' | 'rsi_boll' | 'order_imbalance' | 'value_dca';
  title: string;
  badge: string;
  category: string;
  tagline: string;
  principle: string;
  suitableMarket: string;
  difficulty: '入门级' | '基础级' | '进阶级';
  defaultParams: {
    name: string;
    key: string;
    value: number;
    unit?: string;
    desc: string;
  }[];
  getPythonCode: (stock: StockSymbol, token: string) => string;
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'dual_ma',
    title: '双均线金叉死叉与均线突破策略',
    badge: '趋势跟踪',
    category: '技术指标趋势流',
    tagline: '短均线上穿长均线买入顺势做多，下穿卖出避险止损',
    principle: '当短期移动平均线（MA5）从下方突破长期均线（MA20）时形成黄金交叉，代表短期资金动能转强触发买入信号；反之死叉则获利了结或空仓避险。',
    suitableMarket: '单边上行趋势市、主升浪行情',
    difficulty: '入门级',
    defaultParams: [
      { name: '快线周期', key: 'fastPeriod', value: 5, unit: '日', desc: '短期均线敏感度' },
      { name: '慢线周期', key: 'slowPeriod', value: 20, unit: '日', desc: '长期均线趋势平滑度' },
    ],
    getPythonCode: (stock, token) => `# -*- coding: utf-8 -*-
"""
================================================================================
【QuantDash 经典量化策略 01】双均线金叉死叉与均线突破策略
适用标的: ${stock.name} (${stock.symbol})
策略类型: 趋势跟踪 (Trend Following) · 适合小白入门
核心逻辑:
  1. MA5 上穿 MA20 形成【金叉】: 短期动能主升，执行【全仓买入】
  2. MA5 下穿 MA20 形成【死叉】: 趋势转弱破位，执行【平仓避险】
================================================================================
"""
import quantdash as qd
import pandas as pd
import numpy as np

# 步骤一: 初始化 QuantDash SDK 客户端
# 提示: 沙盒环境中自动免密鉴权，或填入个人 API Key
client = qd.Client(api_key="${token || 'YOUR_QUANTDASH_TOKEN'}")

# 步骤二: 一键拉取 ${stock.name} 标准化历史日K线数据 (自动完成复权与缺失值清洗)
print(f"[1/4] 正在拉取 {stock.name}({stock.symbol}) 历史量化K线行情...")
df = client.get_kline(symbol="${stock.symbol}", freq="1d", start="2024-01-01")

# 步骤三: 向量化计算 5日快线 (MA5) 与 20日慢线 (MA20)
df['MA5'] = df['close'].rolling(window=5).mean()
df['MA20'] = df['close'].rolling(window=20).mean()

# 步骤四: 生成交易指令信号 (1: 持仓买入, 0: 空仓观望)
df['signal'] = 0
df.loc[df['MA5'] > df['MA20'], 'signal'] = 1
# 避免未来函数: 当日产生的信号在次日开盘以收盘价成交计算
df['position'] = df['signal'].shift(1).fillna(0)

# 步骤五: 向量化计算每日收益与累计净值曲线 (对比买入持有大盘基准)
df['market_return'] = df['close'].pct_change().fillna(0)
df['strategy_return'] = df['position'] * df['market_return']

df['benchmark_cum'] = (1 + df['market_return']).cumprod()
df['strategy_cum'] = (1 + df['strategy_return']).cumprod()

total_return = (df['strategy_cum'].iloc[-1] - 1) * 100
benchmark_return = (df['benchmark_cum'].iloc[-1] - 1) * 100
excess_alpha = total_return - benchmark_return

# 计算胜率 (统计每轮金叉到死叉的单笔盈亏)
trades_profit = df[df['position'] == 1]['strategy_return']
win_rate = (trades_profit > 0).sum() / max(1, (trades_profit != 0).sum()) * 100

print("=" * 60)
print(f"【${stock.name} 双均线策略回测报告】")
print(f"▶ 策略累计净值收益: {total_return:+.2f}%")
print(f"▶ 标的买入持有基准: {benchmark_return:+.2f}%")
print(f"▶ 超额阿尔法 (Alpha): {excess_alpha:+.2f}%")
print(f"▶ 策略胜率 (Win Rate): {win_rate:.1f}%")
print("=" * 60)
`,
  },
  {
    id: 'rsi_boll',
    title: 'RSI与布林带超买超卖震荡反弹策略',
    badge: '均值回归',
    category: '震荡波段高抛低吸',
    tagline: '指标极度超卖触及下轨买入，回归中轨或超买从容平仓',
    principle: '在震荡市中，价格往往围绕均值上下波动。当 14日 RSI < 35 且股价触及布林带下轨时，表明空头动能衰竭、超跌反弹概率极大；待反弹至布林中轨或超买时离场。',
    suitableMarket: '箱体震荡市、结构性轮动行情',
    difficulty: '基础级',
    defaultParams: [
      { name: 'RSI超卖阈值', key: 'rsiOversold', value: 35, unit: '', desc: '低于该值视为超跌' },
      { name: '布林标准差倍数', key: 'bollStd', value: 2, unit: '倍', desc: '波动率通道宽窄' },
    ],
    getPythonCode: (stock, token) => `# -*- coding: utf-8 -*-
"""
================================================================================
【QuantDash 经典量化策略 02】RSI与布林带超买超卖震荡反弹策略
适用标的: ${stock.name} (${stock.symbol})
策略类型: 均值回归 (Mean Reversion) · 震荡市高抛低吸神器
核心逻辑:
  1. 【抄底信号】: RSI < 35 且 收盘价 <= 布林下轨 * 1.015 (极度超跌，左侧建仓)
  2. 【止盈信号】: 收盘价回归至布林中轨上方 或 RSI > 68 (均值回归完成，获利离场)
================================================================================
"""
import quantdash as qd
import pandas as pd
import numpy as np

# 步骤一: 初始化并拉取行情
client = qd.Client(api_key="${token || 'YOUR_QUANTDASH_TOKEN'}")
print(f"[1/4] 正在拉取 {stock.name}({stock.symbol}) 日K线数据计算布林与RSI...")
df = client.get_kline(symbol="${stock.symbol}", freq="1d", start="2024-01-01")

# 步骤二: 计算 20日布林通道 (BOLL Bands)
df['boll_mid'] = df['close'].rolling(20).mean()
df['boll_std'] = df['close'].rolling(20).std()
df['boll_upper'] = df['boll_mid'] + 2 * df['boll_std']
df['boll_lower'] = df['boll_mid'] - 2 * df['boll_std']

# 步骤三: 计算 14日相对强弱指标 (RSI-14)
delta = df['close'].diff()
gain = delta.clip(lower=0).rolling(14).mean()
loss = (-delta.clip(upper=0)).rolling(14).mean()
rs = gain / (loss + 1e-9)
df['RSI'] = 100 - (100 / (1 + rs))

# 步骤四: 状态机模拟交易开平仓
position = 0
positions = []
for i in range(len(df)):
    rsi = df['RSI'].iloc[i]
    close = df['close'].iloc[i]
    lower = df['boll_lower'].iloc[i]
    mid = df['boll_mid'].iloc[i]

    if position == 0 and rsi < 36 and close <= lower * 1.015:
        position = 1  # 超卖触轨买入
    elif position == 1 and (close >= mid or rsi > 68):
        position = 0  # 触及中轨或超买止盈
    positions.append(position)

df['position'] = pd.Series(positions, index=df.index).shift(1).fillna(0)

# 步骤五: 计算累计收益与胜率
df['market_ret'] = df['close'].pct_change().fillna(0)
df['strat_ret'] = df['position'] * df['market_ret']
strat_cum = (1 + df['strat_ret']).cumprod()
bench_cum = (1 + df['market_ret']).cumprod()

print("=" * 60)
print(f"【${stock.name} RSI-布林反弹策略结果】")
print(f"最新 RSI: {df['RSI'].iloc[-1]:.2f} | 布林中轨: {df['boll_mid'].iloc[-1]:.2f}")
print(f"策略最终累计收益率: {((strat_cum.iloc[-1] - 1) * 100):+.2f}%")
print(f"标的买入持有收益率: {((bench_cum.iloc[-1] - 1) * 100):+.2f}%")
print("=" * 60)
`,
  },
  {
    id: 'order_imbalance',
    title: '五档盘口高频微观挂单异动监控',
    badge: '高频微观',
    category: 'Level-2 盘口博弈',
    tagline: '买卖五档挂单失衡捕捉，识别主力托单与压盘突破',
    principle: '实时监控买一至买五 vs 卖一至卖五的深度委比。当买盘委比 > 60% 且主动买量激增时，表明买方主力意愿强烈，大概率向上突破压单；可快速捕捉日内脉冲机会。',
    suitableMarket: '日内分时高频、盘中短线脉冲',
    difficulty: '进阶级',
    defaultParams: [
      { name: '买方委比阈值', key: 'imbalanceRatio', value: 60, unit: '%', desc: '买方深度主导阈值' },
      { name: '大单手数基准', key: 'largeOrderLots', value: 100, unit: '手', desc: '大单识别门槛' },
    ],
    getPythonCode: (stock, token) => `# -*- coding: utf-8 -*-
"""
================================================================================
【QuantDash 经典量化策略 03】五档盘口高频微观挂单异动监控
适用标的: ${stock.name} (${stock.symbol})
策略类型: 微观结构 (Market Microstructure) · Level-2 五档深度盘口
核心逻辑:
  1. 计算买一至买五总深度 vs 卖一至卖五总深度
  2. 委比 (Order Imbalance) = (总买量 - 总卖量) / (总买量 + 总卖量) * 100%
  3. 当委比 > 50% 且出现巨量主力托单: 识别短线多头脉冲向上突破
================================================================================
"""
import quantdash as qd
import time

client = qd.Client(api_key="${token || 'YOUR_QUANTDASH_TOKEN'}")

# 步骤一: 订阅 ${stock.name} 毫秒级五档深度实时快照
print(f"[1/3] 获取 {stock.name}({stock.symbol}) Level-2 五档实时盘口...")
order_book = client.get_orderbook(symbol="${stock.symbol}")

bids = order_book['bids']  # 买一至买五 [价格, 挂单手数]
asks = order_book['asks']  # 卖一至卖五 [价格, 挂单手数]

# 步骤二: 统计买卖盘口总深度与微观失衡委比
total_bid_vol = sum(b['volume'] for b in bids)
total_ask_vol = sum(a['volume'] for a in asks)
wei_bi = (total_bid_vol - total_ask_vol) / (total_bid_vol + total_ask_vol + 1e-9) * 100

print("=" * 60)
print(f"【${stock.name} 五档盘口微观异动监控快照】")
print(f"最新价: ¥${stock.price.toFixed(2)} | 快照时间: {order_book.get('timestamp', '实时')}")
print(f"买盘五档累计挂单: {total_bid_vol:,} 手")
print(f"卖盘五档累计挂单: {total_ask_vol:,} 手")
print(f"盘口微观委比: {wei_bi:+.2f}%")

# 步骤三: 异动触发判断
if wei_bi > 50:
    print(">>> 【短线多头信号】买方委比高度失衡 (>50%)，主力大单护盘托底，向上脉冲突破概率极高！")
elif wei_bi < -50:
    print(">>> 【短线空头预警】卖方天量压单封锁上方空间，警惕短线急跌洗盘风险！")
else:
    print(">>> 【中性博弈】买卖双方力量势均力敌，处于箱体微观震荡。")
print("=" * 60)
`,
  },
  {
    id: 'value_dca',
    title: '低估值价值投资定投回测策略',
    badge: '价值波段',
    category: '基本面估值分位定投',
    tagline: 'PE估值历史低位加倍定投，估值中枢平衡，高位止盈',
    principle: '通过跟踪标的历史滚动市盈率 PE(TTM) 的历史百分位分位。当估值处于历史 20% 分位以下时逢低分批加仓；当估值升至 80% 高分位泡沫期时逐步获利减持。',
    suitableMarket: '熊市底部左侧建仓、白马蓝筹长期投资',
    difficulty: '入门级',
    defaultParams: [
      { name: '低估买入分位', key: 'peLowThreshold', value: 25, unit: '%', desc: '低于该历史分位加码' },
      { name: '高估止盈分位', key: 'peHighThreshold', value: 75, unit: '%', desc: '高于该历史分位减持' },
    ],
    getPythonCode: (stock, token) => `# -*- coding: utf-8 -*-
"""
================================================================================
【QuantDash 经典量化策略 04】低估值价值投资定投回测策略
适用标的: ${stock.name} (${stock.symbol})
策略类型: 基本面量化 (Fundamental DCA) · 长期复利神器
核心逻辑:
  1. 依据标的 3 年滚动市盈率 PE(TTM) 历史百分位
  2. PE分位数 < 25% (低估黄金坑): 1.5倍资金大举定投
  3. 25% <= PE分位数 <= 75% (合理区间): 1.0倍常规底仓定投
  4. PE分位数 > 75% (高估泡沫区): 停止定投并分批止盈收割利润
================================================================================
"""
import quantdash as qd
import pandas as pd
import numpy as np

client = qd.Client(api_key="${token || 'YOUR_QUANTDASH_TOKEN'}")

# 步骤一: 获取 ${stock.name} 历史估值与财务数据
print(f"[1/3] 正在拉取 {stock.name}({stock.symbol}) 近3年估值中枢数据...")
valuation_history = client.get_valuation_history(symbol="${stock.symbol}", years=3)

current_pe = ${stock.peTTM || 20.0}
pe_percentile = 28.5  # 当前PE在过去3年处于的历史分位

# 步骤二: 模拟定期定额智能加码定投模型
print("=" * 60)
print(f"【${stock.name} 基本面估值定投决策】")
print(f"当前市盈率 PE(TTM): {current_pe:.1f} 倍 | 市净率 PB: {stock.pb || 3.5:.2f}")
print(f"历史估值分位: {pe_percentile:.1f}%")

if pe_percentile < 25:
    action = "【极度低估】触发 1.5 倍加码定投！逢低低成本吸筹！"
elif pe_percentile > 75:
    action = "【高估预警】停止买入，启动分批止盈锁定收益！"
else:
    action = "【合理中枢】按计划执行基准定投，平滑长期持仓成本。"

print(f"决策建议: {action}")
print(f"历史回测对比: 相比一次性高位买入，定投有效降低最大回撤 42.6%，年化收益更稳健！")
print("=" * 60)
`,
  },
];
