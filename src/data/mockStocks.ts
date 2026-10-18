import { StockSymbol, KlineBar, OrderBook, ValuationDataPoint, QuarterlyFinancial, KlineInterval, IntradayMinutePoint } from '../types/stock';
import { enrichAllIndicators } from '../utils/indicators';

export const POPULAR_STOCKS: StockSymbol[] = [
  {
    symbol: '600519.SH',
    name: '贵州茅台',
    market: 'CN',
    pinyin: 'GZMT',
    category: '白酒消费',
    price: 1329.00,
    change: 16.03,
    changePercent: 1.22,
    high: 1335.00,
    low: 1303.18,
    open: 1311.57,
    prevClose: 1312.97,
    volume: 38502,
    amount: 5120000000,
    turnoverRate: 0.31,
    peTTM: 21.2,
    pb: 7.2,
    marketCap: 16700,
  },
  {
    symbol: '300750.SZ',
    name: '宁德时代',
    market: 'CN',
    pinyin: 'NDSD',
    category: '新能源电池',
    price: 277.00,
    change: -1.50,
    changePercent: -0.54,
    high: 282.00,
    low: 274.50,
    open: 278.50,
    prevClose: 278.50,
    volume: 312000,
    amount: 8650000000,
    turnoverRate: 0.95,
    peTTM: 22.1,
    pb: 4.8,
    marketCap: 12180,
  },
  {
    symbol: '000001.SZ',
    name: '平安银行',
    market: 'CN',
    pinyin: 'PAYH',
    category: '银行金融',
    price: 11.50,
    change: 0.09,
    changePercent: 0.79,
    high: 11.62,
    low: 11.38,
    open: 11.45,
    prevClose: 11.41,
    volume: 1250000,
    amount: 1440000000,
    turnoverRate: 0.65,
    peTTM: 4.8,
    pb: 0.52,
    marketCap: 2221,
  },
  {
    symbol: '600036.SH',
    name: '招商银行',
    market: 'CN',
    pinyin: 'ZSYH',
    category: '零售银行',
    price: 42.45,
    change: -0.21,
    changePercent: -0.49,
    high: 43.10,
    low: 42.00,
    open: 42.66,
    prevClose: 42.66,
    volume: 680000,
    amount: 2880000000,
    turnoverRate: 0.35,
    peTTM: 6.8,
    pb: 0.96,
    marketCap: 10700,
  },
  {
    symbol: '688981.SH',
    name: '中芯国际',
    market: 'CN',
    pinyin: 'ZXGJ',
    category: '半导体芯片',
    price: 102.66,
    change: -1.77,
    changePercent: -1.70,
    high: 105.80,
    low: 101.20,
    open: 104.50,
    prevClose: 104.43,
    volume: 720000,
    amount: 7390000000,
    turnoverRate: 3.85,
    peTTM: 92.0,
    pb: 5.2,
    marketCap: 8150,
  },
  {
    symbol: '002594.SZ',
    name: '比亚迪',
    market: 'CN',
    pinyin: 'BYD',
    category: '新能源汽车',
    price: 82.72,
    change: 0.48,
    changePercent: 0.58,
    high: 291.50,
    low: 282.00,
    open: 283.50,
    prevClose: 283.40,
    volume: 240000,
    amount: 6890000000,
    turnoverRate: 1.32,
    peTTM: 23.4,
    pb: 5.1,
    marketCap: 8390,
  },
  {
    symbol: '00700.HK',
    name: '腾讯控股',
    market: 'HK',
    pinyin: 'TXKG',
    category: '互联网科技',
    price: 432.40,
    change: 8.60,
    changePercent: 2.03,
    high: 436.00,
    low: 425.20,
    open: 426.00,
    prevClose: 423.80,
    volume: 1850000,
    amount: 7980000000,
    turnoverRate: 0.20,
    peTTM: 21.2,
    pb: 4.3,
    marketCap: 40500,
  },
  {
    symbol: '000001.SH',
    name: '上证指数',
    market: 'CN',
    pinyin: 'SZZS',
    category: '核心宽基指数',
    price: 3385.20,
    change: 23.40,
    changePercent: 0.70,
    high: 3392.10,
    low: 3360.50,
    open: 3365.80,
    prevClose: 3361.80,
    volume: 38500000,
    amount: 520000000000,
    turnoverRate: 1.15,
    peTTM: 13.8,
    pb: 1.35,
    marketCap: 520000,
  },
  {
    symbol: 'NVDA',
    name: '英伟达 (NVIDIA)',
    market: 'US',
    pinyin: 'YWD',
    category: 'AI算力芯片',
    price: 214.13,
    change: -3.11,
    changePercent: -1.43,
    high: 218.68,
    low: 213.32,
    open: 216.56,
    prevClose: 217.24,
    volume: 58000000,
    amount: 26145000000,
    turnoverRate: 0.50,
    peTTM: 27.1,
    pb: 28.5,
    marketCap: 52400,
  },
  {
    symbol: 'AAPL',
    name: '苹果 (Apple)',
    market: 'US',
    pinyin: 'PG',
    category: '消费电子科技',
    price: 234.80,
    change: -1.20,
    changePercent: -0.51,
    high: 236.90,
    low: 233.50,
    open: 235.50,
    prevClose: 236.00,
    volume: 42000000,
    amount: 9850000000,
    turnoverRate: 0.28,
    peTTM: 32.4,
    pb: 45.2,
    marketCap: 35800,
  }
];

// Simple deterministic pseudo-random number generator for consistent chart generation by symbol
function pseudoRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
}

/**
 * Generate historical K-line bars for any stock and interval
 */
function generateTradingTimestamps(interval: KlineInterval, count: number): string[] {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const chinaDate = new Date(utc + 3600000 * 8);

  let d = new Date(chinaDate);
  // If weekend, roll back to Friday 15:00
  if (d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
    d.setHours(15, 0, 0, 0);
  } else if (d.getDay() === 0) {
    d.setDate(d.getDate() - 2);
    d.setHours(15, 0, 0, 0);
  } else {
    const mins = d.getHours() * 60 + d.getMinutes();
    if (mins > 15 * 60) {
      d.setHours(15, 0, 0, 0);
    } else if (mins < 9 * 60 + 30) {
      d.setDate(d.getDate() - (d.getDay() === 1 ? 3 : 1));
      d.setHours(15, 0, 0, 0);
    } else if (mins > 11 * 60 + 30 && mins < 13 * 60) {
      d.setHours(11, 30, 0, 0);
    }
  }

  if (interval === '1d') {
    const results: string[] = [];
    let cur = new Date(d);
    while (results.length < count) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const day = String(cur.getDate()).padStart(2, '0');
        results.unshift(`${y}-${m}-${day}`);
      }
      cur.setDate(cur.getDate() - 1);
    }
    return results;
  }

  if (interval === '1w') {
    const results: string[] = [];
    let cur = new Date(d);
    while (cur.getDay() !== 5) {
      cur.setDate(cur.getDate() - 1);
    }
    while (results.length < count) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const day = String(cur.getDate()).padStart(2, '0');
      results.unshift(`${y}-${m}-${day}`);
      cur.setDate(cur.getDate() - 7);
    }
    return results;
  }

  if (interval === '1y') {
    const results: string[] = [];
    let curYear = d.getFullYear();
    for (let i = 0; i < count; i++) {
      results.unshift(`${curYear - i}-12-31`);
    }
    return results;
  }

  if (interval === '1q') {
    const results: string[] = [];
    let cur = new Date(d);
    for (let i = 0; i < count; i++) {
      const y = cur.getFullYear();
      const q = Math.floor(cur.getMonth() / 3);
      const qEndMonths = ['03-31', '06-30', '09-30', '12-31'];
      results.unshift(`${y}-${qEndMonths[q]}`);
      cur.setMonth(cur.getMonth() - 3);
    }
    return results;
  }

  if (interval === '1mo') {
    const results: string[] = [];
    let cur = new Date(d);
    for (let i = 0; i < count; i++) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      results.unshift(`${y}-${m}-28`);
      cur.setMonth(cur.getMonth() - 1);
    }
    return results;
  }

  const getSlotsForDay = (dayStr: string, interv: KlineInterval): string[] => {
    if (interv === '120m') {
      return [
        `${dayStr} 11:30`,
        `${dayStr} 15:00`,
      ];
    }
    if (interv === '60m') {
      return [
        `${dayStr} 10:30`,
        `${dayStr} 11:30`,
        `${dayStr} 14:00`,
        `${dayStr} 15:00`,
      ];
    }
    if (interv === '30m') {
      return [
        `${dayStr} 10:00`,
        `${dayStr} 10:30`,
        `${dayStr} 11:00`,
        `${dayStr} 11:30`,
        `${dayStr} 13:30`,
        `${dayStr} 14:00`,
        `${dayStr} 14:30`,
        `${dayStr} 15:00`,
      ];
    }
    if (interv === '15m') {
      const slots: string[] = [];
      for (let m = 585; m <= 690; m += 15) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        slots.push(`${dayStr} ${hh}:${mm}`);
      }
      for (let m = 795; m <= 900; m += 15) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        slots.push(`${dayStr} ${hh}:${mm}`);
      }
      return slots;
    }
    if (interv === '5m') {
      const slots: string[] = [];
      for (let m = 575; m <= 690; m += 5) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        slots.push(`${dayStr} ${hh}:${mm}`);
      }
      for (let m = 785; m <= 900; m += 5) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        slots.push(`${dayStr} ${hh}:${mm}`);
      }
      return slots;
    }
    // 1m
    const slots: string[] = [];
    for (let m = 571; m <= 690; m += 1) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      slots.push(`${dayStr} ${hh}:${mm}`);
    }
    for (let m = 781; m <= 900; m += 1) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      slots.push(`${dayStr} ${hh}:${mm}`);
    }
    return slots;
  };

  let cur = new Date(d);
  let allSlots: string[] = [];
  while (allSlots.length < count + 60) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const day = String(cur.getDate()).padStart(2, '0');
      const dayStr = `${y}-${m}-${day}`;
      const daySlots = getSlotsForDay(dayStr, interval);
      allSlots = [...daySlots, ...allSlots];
    }
    cur.setDate(cur.getDate() - 1);
  }

  return allSlots.slice(allSlots.length - count);
}

/**
 * Generate historical K-line bars dynamically anchored to the stock's actual latest market price
 */
export function generateKlineData(
  stockOrSymbol: string | StockSymbol,
  interval: KlineInterval = '1d',
  barCount: number = 80
): KlineBar[] {
  let symbol: string;
  let targetPrice: number;
  let volumeBase: number;

  if (typeof stockOrSymbol === 'object' && stockOrSymbol !== null) {
    symbol = stockOrSymbol.symbol;
    targetPrice = stockOrSymbol.price > 0 ? stockOrSymbol.price : 50.0;
    volumeBase = stockOrSymbol.volume > 0 ? stockOrSymbol.volume : 100000;
  } else {
    symbol = String(stockOrSymbol);
    const found = POPULAR_STOCKS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
    targetPrice = found?.price || 50.0;
    volumeBase = found?.volume || 100000;
  }

  const seed = stringToSeed(symbol + interval);
  let currentPrice = targetPrice * 0.78; // start from earlier level
  const bars: KlineBar[] = [];

  const timestamps = generateTradingTimestamps(interval, barCount);

  for (let i = 0; i < timestamps.length; i++) {
    const dateStr = timestamps[i];

    const rand1 = pseudoRandom(seed + i * 3);
    const rand2 = pseudoRandom(seed + i * 3 + 1);
    const rand3 = pseudoRandom(seed + i * 3 + 2);

    let changePct = (rand1 - 0.48) * 0.05;
    if (interval === '1m') {
      changePct = (rand1 - 0.49) * 0.007;
    } else if (interval === '5m') {
      changePct = (rand1 - 0.48) * 0.015;
    } else if (interval === '15m') {
      changePct = (rand1 - 0.48) * 0.025;
    } else if (interval === '60m') {
      changePct = (rand1 - 0.48) * 0.04;
    } else if (interval === '120m') {
      changePct = (rand1 - 0.48) * 0.055;
    } else if (interval === '1w') {
      changePct = (rand1 - 0.48) * 0.09;
    } else if (interval === '1mo') {
      changePct = (rand1 - 0.48) * 0.15;
    } else if (interval === '1q') {
      changePct = (rand1 - 0.48) * 0.24;
    } else if (interval === '1y') {
      changePct = (rand1 - 0.48) * 0.38;
    }

    const open = currentPrice;
    let close = +(open * (1 + changePct)).toFixed(2);
    if (close <= 0.5) close = 0.5;

    const shadowScale = interval === '1m' ? 0.004 : interval === '5m' ? 0.008 : 0.02;
    const high = +(Math.max(open, close) * (1 + rand2 * shadowScale)).toFixed(2);
    const low = +(Math.min(open, close) * (1 - rand3 * shadowScale)).toFixed(2);

    let volMultiplier = 1;
    if (interval === '1m') volMultiplier = 1 / 200;
    else if (interval === '5m') volMultiplier = 5 / 200;
    else if (interval === '15m') volMultiplier = 15 / 200;
    else if (interval === '60m') volMultiplier = 60 / 200;
    else if (interval === '120m') volMultiplier = 120 / 200;
    else if (interval === '1w') volMultiplier = 4.8;
    else if (interval === '1mo') volMultiplier = 20;
    else if (interval === '1q') volMultiplier = 60;
    else if (interval === '1y') volMultiplier = 240;

    const volume = Math.max(50, Math.floor(volumeBase * volMultiplier * (0.6 + rand1 * 0.8)));
    const amount = +(volume * close).toFixed(0);

    bars.push({
      date: dateStr,
      open,
      high,
      low,
      close,
      volume,
      amount,
    });

    currentPrice = close;
  }

  // Crucial: strictly scale entire series so the latest bar's close price equals targetPrice!
  if (bars.length > 0 && targetPrice > 0) {
    const lastBar = bars[bars.length - 1];
    const ratio = targetPrice / (lastBar.close || 1);
    bars.forEach((b) => {
      b.open = +(b.open * ratio).toFixed(2);
      b.high = +(b.high * ratio).toFixed(2);
      b.low = +(b.low * ratio).toFixed(2);
      b.close = +(b.close * ratio).toFixed(2);
    });
    // Pin latest bar close to targetPrice precisely
    bars[bars.length - 1].close = +(targetPrice).toFixed(2);
  }

  return enrichAllIndicators(bars);
}

/**
 * Generate 240 intraday minute points strictly anchored to the stock's actual latest market price
 */
export function generateMinutePoints(stock: StockSymbol): IntradayMinutePoint[] {
  const basePrice = stock.price > 0 ? stock.price : 50.0;
  const prevClose = stock.prevClose > 0 ? stock.prevClose : basePrice;
  const openPrice = stock.open > 0 ? stock.open : +(prevClose * 0.998).toFixed(2);
  const totalMinutes = 240;
  const points: IntradayMinutePoint[] = [];

  const seed = stringToSeed(stock.symbol + '_minute_' + Math.round(basePrice * 100));
  let curPrice = openPrice;
  let cumVol = 0;
  let cumAmount = 0;

  for (let m = 0; m < totalMinutes; m++) {
    const isMorning = m < 120;
    const h = isMorning ? Math.floor(m / 60) + 9 : Math.floor((m - 120) / 60) + 13;
    const min = isMorning ? (m % 60) + (h === 9 ? 30 : 0) : m % 60;
    const hh = String(h).padStart(2, '0');
    const mm = String(min % 60).padStart(2, '0');

    // Pseudo-random drift towards target close
    const progress = (m + 1) / totalMinutes;
    const idealPrice = openPrice + (basePrice - openPrice) * progress;
    const noise = (pseudoRandom(seed + m * 5) - 0.49) * (basePrice * 0.0035);
    const wave = Math.sin(m * 0.08) * (basePrice * 0.002);
    curPrice = +(idealPrice + noise + wave).toFixed(2);
    if (curPrice <= 0.1) curPrice = 0.1;

    const minVol = Math.floor(pseudoRandom(seed + m * 5 + 1) * 300 + 40);
    const minAmt = +(minVol * curPrice * 100).toFixed(0);
    cumVol += minVol;
    cumAmount += minAmt;
    const avgPrice = +(cumAmount / (cumVol * 100 || 1)).toFixed(2);

    points.push({
      time: `${hh}:${mm}`,
      price: curPrice,
      avgPrice,
      volume: minVol,
      amount: minAmt,
      change: +(curPrice - prevClose).toFixed(2),
      changePercent: prevClose > 0 ? +(((curPrice - prevClose) / prevClose) * 100).toFixed(2) : 0,
    });
  }

  // Strictly align the terminal point and curve to stock.price
  if (points.length > 0) {
    const lastP = points[points.length - 1];
    const diff = +(basePrice - lastP.price).toFixed(2);
    points.forEach((p, idx) => {
      const weight = (idx + 1) / points.length;
      p.price = +(p.price + diff * weight).toFixed(2);
      p.change = +(p.price - prevClose).toFixed(2);
      p.changePercent = prevClose > 0 ? +(((p.price - prevClose) / prevClose) * 100).toFixed(2) : 0;
    });
    points[points.length - 1].price = +(basePrice).toFixed(2);
    points[points.length - 1].change = +(basePrice - prevClose).toFixed(2);
    points[points.length - 1].changePercent = prevClose > 0 ? +(((basePrice - prevClose) / prevClose) * 100).toFixed(2) : 0;
  }

  return points;
}

/**
 * Generate 5-level Order Book for real-time market simulator
 */
export function generateOrderBook(basePrice: number): OrderBook {
  const step = basePrice > 500 ? 0.5 : basePrice > 100 ? 0.1 : 0.01;
  const asks = [];
  const bids = [];

  let maxVol = 0;
  for (let i = 5; i >= 1; i--) {
    const vol = Math.floor(100 + Math.random() * 800) * 10;
    if (vol > maxVol) maxVol = vol;
    asks.push({
      price: +(basePrice + i * step).toFixed(2),
      volume: vol,
      ratio: 0,
    });
  }

  for (let i = 1; i <= 5; i++) {
    const vol = Math.floor(100 + Math.random() * 850) * 10;
    if (vol > maxVol) maxVol = vol;
    bids.push({
      price: +(basePrice - i * step).toFixed(2),
      volume: vol,
      ratio: 0,
    });
  }

  asks.forEach(a => a.ratio = Math.max(0.15, +(a.volume / maxVol).toFixed(2)));
  bids.forEach(b => b.ratio = Math.max(0.15, +(b.volume / maxVol).toFixed(2)));

  return {
    asks,
    bids,
    timestamp: new Date().toLocaleTimeString(),
  };
}

/**
 * Generate 3-year Valuation Percentile Bands
 */
export function generateValuationHistory(stock: StockSymbol): ValuationDataPoint[] {
  const points: ValuationDataPoint[] = [];
  const basePe = stock.peTTM > 0 ? stock.peTTM : 25;
  const basePb = stock.pb > 0 ? stock.pb : 2.5;

  const quarters = [
    '2022-Q1', '2022-Q2', '2022-Q3', '2022-Q4',
    '2023-Q1', '2023-Q2', '2023-Q3', '2023-Q4',
    '2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4',
    '2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4',
    '2026-Q1', '2026-Q2', '2026-Q3'
  ];

  quarters.forEach((q, idx) => {
    const wave = Math.sin(idx * 0.45) * 0.25;
    const pe = +(basePe * (0.85 + wave)).toFixed(1);
    const pb = +(basePb * (0.9 + wave * 0.8)).toFixed(2);
    const price = +(stock.price * (0.7 + idx * 0.02 + wave * 0.15)).toFixed(2);
    
    // Percentile bands
    const lowBand = +(basePe * 0.75).toFixed(1);
    const midBand = +(basePe * 1.0).toFixed(1);
    const highBand = +(basePe * 1.35).toFixed(1);
    const pePercentile = Math.min(98, Math.max(8, Math.round(((pe - lowBand) / (highBand - lowBand)) * 100)));

    points.push({
      date: q,
      peTTM: pe,
      pb,
      price,
      pePercentile,
      lowBand,
      midBand,
      highBand,
    });
  });

  return points;
}

/**
 * Generate DuPont and quarterly financial analysis
 */
export function generateFinancialReports(stock: StockSymbol): QuarterlyFinancial[] {
  const reports: QuarterlyFinancial[] = [
    {
      quarter: '2024-Q1',
      revenue: +(stock.marketCap * 0.08).toFixed(1),
      revenueYoY: 14.8,
      netProfit: +(stock.marketCap * 0.035).toFixed(1),
      profitYoY: 15.6,
      roe: 7.2,
      grossMargin: 82.5,
    },
    {
      quarter: '2024-Q2',
      revenue: +(stock.marketCap * 0.085).toFixed(1),
      revenueYoY: 16.2,
      netProfit: +(stock.marketCap * 0.038).toFixed(1),
      profitYoY: 17.1,
      roe: 14.8,
      grossMargin: 83.1,
    },
    {
      quarter: '2024-Q3',
      revenue: +(stock.marketCap * 0.092).toFixed(1),
      revenueYoY: 15.3,
      netProfit: +(stock.marketCap * 0.041).toFixed(1),
      profitYoY: 16.4,
      roe: 22.4,
      grossMargin: 83.8,
    },
    {
      quarter: '2024-Q4',
      revenue: +(stock.marketCap * 0.105).toFixed(1),
      revenueYoY: 17.8,
      netProfit: +(stock.marketCap * 0.046).toFixed(1),
      profitYoY: 18.2,
      roe: 29.5,
      grossMargin: 84.2,
    },
    {
      quarter: '2025-Q1',
      revenue: +(stock.marketCap * 0.096).toFixed(1),
      revenueYoY: 15.9,
      netProfit: +(stock.marketCap * 0.042).toFixed(1),
      profitYoY: 17.5,
      roe: 7.8,
      grossMargin: 84.6,
    },
    {
      quarter: '2025-Q2',
      revenue: +(stock.marketCap * 0.102).toFixed(1),
      revenueYoY: 18.4,
      netProfit: +(stock.marketCap * 0.047).toFixed(1),
      profitYoY: 19.8,
      roe: 15.9,
      grossMargin: 85.0,
    },
    {
      quarter: '2025-Q3',
      revenue: +(stock.marketCap * 0.110).toFixed(1),
      revenueYoY: 19.5,
      netProfit: +(stock.marketCap * 0.051).toFixed(1),
      profitYoY: 21.2,
      roe: 24.1,
      grossMargin: 85.4,
    }
  ];

  return reports;
}
