export type MarketType = 'CN' | 'HK' | 'US';

export type KlineInterval = 'timeline' | '1m' | '5m' | '15m' | '30m' | '60m' | '120m' | '1d' | '1w' | '1mo' | '1q' | '1y';

export interface IntradayMinutePoint {
  time: string; // e.g. "09:30"
  price: number;
  avgPrice: number; // 当日成交均价线 VWAP
  volume: number; // 分钟成交量
  amount: number; // 分钟成交额
  change: number;
  changePercent: number;
}

export type TechnicalIndicator = 'MA' | 'BOLL' | 'MACD' | 'RSI';

export interface StockSymbol {
  symbol: string;
  name: string;
  market: MarketType;
  pinyin: string;
  category: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number; // in shares or lots
  amount: number; // in RMB / USD
  turnoverRate: number; // %
  peTTM: number;
  pb: number;
  marketCap: number; // in 100 million (亿元)
  quoteId?: string; // Eastmoney / QuantDash quote id e.g. 0.002172 or 1.600519
}

export interface KlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  // Moving Averages
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma60?: number;
  // MACD
  dif?: number;
  dea?: number;
  macd?: number;
  // RSI
  rsi6?: number;
  rsi12?: number;
  rsi24?: number;
  // Bollinger
  bollUpper?: number;
  bollMid?: number;
  bollLower?: number;
}

export interface OrderBookItem {
  price: number;
  volume: number;
  ratio: number; // 0 to 1 for bar width
}

export interface OrderBook {
  bids: OrderBookItem[]; // Buy 1 to 5
  asks: OrderBookItem[]; // Sell 1 to 5
  timestamp: string;
}

export interface ValuationDataPoint {
  date: string;
  peTTM: number;
  pb: number;
  price: number;
  pePercentile: number; // 0 - 100%
  highBand: number; // 80% percentile
  midBand: number;  // 50% percentile
  lowBand: number;  // 20% percentile
}

export interface QuarterlyFinancial {
  quarter: string; // e.g. "2024Q3"
  revenue: number; // 亿元
  revenueYoY: number; // %
  netProfit: number; // 亿元
  profitYoY: number; // %
  roe: number; // %
  grossMargin: number; // %
}

export type CodeTab = 'sdk' | 'requests' | 'curl' | 'pandas_excel';
