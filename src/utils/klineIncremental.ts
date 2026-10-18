import { KlineBar, KlineInterval, IntradayMinutePoint, StockSymbol, MarketType } from '../types/stock';

/**
 * China Standard Time (UTC+8) helper
 */
export function getChinaDateTime(d: Date = new Date()): {
  year: number;
  month: number;
  date: number;
  day: number; // 0: Sunday, 6: Saturday
  hour: number;
  minute: number;
  second: number;
  totalMinutes: number;
  dateStr: string;
  timeStr: string;
} {
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const chinaDate = new Date(utc + 3600000 * 8);
  const year = chinaDate.getFullYear();
  const month = chinaDate.getMonth() + 1;
  const date = chinaDate.getDate();
  const day = chinaDate.getDay();
  const hour = chinaDate.getHours();
  const minute = chinaDate.getMinutes();
  const second = chinaDate.getSeconds();
  const totalMinutes = hour * 60 + minute;
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return { year, month, date, day, hour, minute, second, totalMinutes, dateStr, timeStr };
}

/**
 * Check if the current time falls within official A-share continuous auction trading hours:
 * Monday to Friday:
 * Morning:   09:30 - 11:30
 * Afternoon: 13:00 - 15:00
 */
export function isAsharesTradingTime(d: Date = new Date()): boolean {
  const c = getChinaDateTime(d);
  // Weekends are closed
  if (c.day === 0 || c.day === 6) return false;

  // Morning: 09:30:00 - 11:30:00 (570m to 690m)
  const isMorning = c.totalMinutes >= 570 && c.totalMinutes <= 690;
  // Afternoon: 13:00:00 - 15:00:00 (780m to 900m)
  const isAfternoon = c.totalMinutes >= 780 && c.totalMinutes <= 900;

  return isMorning || isAfternoon;
}

/**
 * Universal market check: support adaptive 24/7 continuous dynamic simulation & live updates for all markets
 */
export function isMarketTradingTime(market: MarketType = 'CN', d: Date = new Date()): boolean {
  // Support 24/7 live polling and responsive updates as selected by user
  return true;
}

/**
 * Dynamic market status label based on actual stock market
 */
export function getMarketStatusBadge(stock: StockSymbol, d: Date = new Date()): { label: string; isActive: boolean } {
  if (stock.market === 'US') {
    return { label: '美股行情 · 动态同步中', isActive: true };
  }
  if (stock.market === 'HK') {
    return { label: '港股行情 · 动态同步中', isActive: true };
  }
  const isA = isAsharesTradingTime(d);
  return {
    label: isA ? 'A股连续竞价 · 实时交易中' : 'A股收盘 · 盘后动态更新',
    isActive: isA,
  };
}

/**
 * Tracks the wall-clock minute bucket of the currently open candle during an active trading session.
 */
let sessionActiveBarMinuteBucket: number | null = null;
let sessionActiveBarInterval: KlineInterval | null = null;

/**
 * Reset session bar bucket (called when switching stocks or timeframes)
 */
export function resetSessionBarBucket(): void {
  sessionActiveBarMinuteBucket = null;
  sessionActiveBarInterval = null;
}

/**
 * Check if the latest tick timestamp belongs to the same candle interval as lastBar.
 * Reverse-engineered from Eastmoney (东方财富) logic:
 * 1. Outside A-share trading hours, NEVER advance the bucket or spawn new candles.
 * 2. Daily ('1d') and Weekly ('1w'): Active candle is always the last candle of the session.
 * 3. Minute bars ('1m', '5m', '15m', '30m', '60m'):
 *    Advances ONLY when wall-clock moves into a new valid trading bucket during official hours.
 */
export function isSameIntervalBucket(lastDateStr: string, interval: KlineInterval, now: Date = new Date()): boolean {
  if (!lastDateStr) return true;

  // If market is closed, lock the bucket completely! NEVER spawn new bars in non-trading periods.
  if (!isAsharesTradingTime(now)) {
    return true;
  }

  // Daily, weekly, monthly, quarterly and yearly bars are ALWAYS the same candle during the active session
  if (interval === '1d' || interval === '1w' || interval === '1mo' || interval === '1q' || interval === '1y') {
    return true;
  }

  const c = getChinaDateTime(now);
  let stepMinutes = 1;
  if (interval === '5m') stepMinutes = 5;
  else if (interval === '15m') stepMinutes = 15;
  else if (interval === '30m') stepMinutes = 30;
  else if (interval === '60m') stepMinutes = 60;
  else if (interval === '120m') stepMinutes = 120;

  // Bucket within the trading day based on trading minutes since 09:30
  // Morning: 09:30 - 11:30 (0 to 120 mins)
  // Afternoon: 13:00 - 15:00 (120 to 240 mins)
  let sessionMinuteOffset = 0;
  if (c.totalMinutes >= 570 && c.totalMinutes <= 690) {
    sessionMinuteOffset = c.totalMinutes - 570;
  } else if (c.totalMinutes >= 780 && c.totalMinutes <= 900) {
    sessionMinuteOffset = 120 + (c.totalMinutes - 780);
  } else {
    // Lunch break or outside session: keep in same bucket
    return true;
  }

  const currentBucket = Math.floor(sessionMinuteOffset / stepMinutes);

  // If interval switched or first tick in session, anchor the bucket
  if (sessionActiveBarMinuteBucket === null || sessionActiveBarInterval !== interval) {
    sessionActiveBarMinuteBucket = currentBucket;
    sessionActiveBarInterval = interval;
    return true;
  }

  // If we are still within the same time bucket, update in place
  if (currentBucket === sessionActiveBarMinuteBucket) {
    return true;
  }

  // Bucket has genuinely advanced during market hours! Advance tracker and permit new bar
  sessionActiveBarMinuteBucket = currentBucket;
  return false;
}

/**
 * Format timestamp for a newly opened candle in Eastmoney format:
 * 'YYYY-MM-DD HH:mm' for minute bars, 'YYYY-MM-DD' for daily bars
 */
export function formatNewCandleDate(interval: KlineInterval, now: Date = new Date()): string {
  const c = getChinaDateTime(now);

  if (interval === '1d' || interval === '1w' || interval === '1mo' || interval === '1q' || interval === '1y') {
    return c.dateStr;
  }

  if (interval === '1m') {
    return `${c.dateStr} ${c.timeStr}`;
  } else if (interval === '5m') {
    const bucketMin = Math.floor(c.minute / 5) * 5;
    return `${c.dateStr} ${String(c.hour).padStart(2, '0')}:${String(bucketMin).padStart(2, '0')}`;
  } else if (interval === '15m') {
    const bucketMin = Math.floor(c.minute / 15) * 15;
    return `${c.dateStr} ${String(c.hour).padStart(2, '0')}:${String(bucketMin).padStart(2, '0')}`;
  } else if (interval === '30m') {
    const bucketMin = Math.floor(c.minute / 30) * 30;
    return `${c.dateStr} ${String(c.hour).padStart(2, '0')}:${String(bucketMin).padStart(2, '0')}`;
  } else if (interval === '60m') {
    return `${c.dateStr} ${String(c.hour).padStart(2, '0')}:00`;
  } else if (interval === '120m') {
    return `${c.dateStr} ${c.hour < 12 ? '11:30' : '15:00'}`;
  }

  return c.dateStr;
}

/**
 * Incrementally update the last bar in-place with O(1) indicators
 * Historical bars (0 to n-2) are 100% IMMUTABLE and UNTOUCHED!
 */
export function applyIncrementalBarUpdate(
  bars: KlineBar[],
  tick: {
    price: number;
    deltaVolume?: number;
    deltaAmount?: number;
    high?: number;
    low?: number;
    timestamp?: Date;
  },
  interval: KlineInterval
): KlineBar[] {
  if (!bars || bars.length === 0) return bars;

  const now = tick.timestamp || new Date();
  const lastIndex = bars.length - 1;
  const lastBar = bars[lastIndex];

  // If outside trading hours, DO NOT append new bars.
  // In-place update is only allowed if price changed and we remain strictly on last bar.
  const tradingActive = isAsharesTradingTime(now);
  const sameBucket = !tradingActive || isSameIntervalBucket(lastBar.date, interval, now);

  if (sameBucket) {
    // 1. Same candle interval: mutate ONLY the last bar! Historical bars are completely untouched
    const newPrice = +tick.price.toFixed(2);
    const newHigh = tick.high !== undefined ? Math.max(lastBar.high, tick.high, newPrice) : Math.max(lastBar.high, newPrice);
    const newLow = tick.low !== undefined ? Math.min(lastBar.low, tick.low, newPrice) : Math.min(lastBar.low, newPrice);
    const addVol = tick.deltaVolume ?? 0;
    const addAmt = tick.deltaAmount ?? (addVol * newPrice * 100);

    const updatedLast: KlineBar = {
      ...lastBar,
      close: newPrice,
      high: +newHigh.toFixed(2),
      low: +newLow.toFixed(2),
      volume: lastBar.volume + addVol,
      amount: +(lastBar.amount + addAmt).toFixed(2),
    };

    // Fast O(1) Moving Average update for the last bar
    if (bars.length >= 5) {
      const sum5 = bars.slice(bars.length - 4).reduce((s, b) => s + b.close, 0) + newPrice;
      updatedLast.ma5 = +(sum5 / 5).toFixed(2);
    }
    if (bars.length >= 10) {
      const sum10 = bars.slice(bars.length - 9).reduce((s, b) => s + b.close, 0) + newPrice;
      updatedLast.ma10 = +(sum10 / 10).toFixed(2);
    }
    if (bars.length >= 20) {
      const sum20 = bars.slice(bars.length - 19).reduce((s, b) => s + b.close, 0) + newPrice;
      const ma20 = sum20 / 20;
      updatedLast.ma20 = +ma20.toFixed(2);

      // Fast Bollinger bands on last bar
      const prices = [...bars.slice(bars.length - 19).map((b) => b.close), newPrice];
      const variance = prices.reduce((s, p) => s + Math.pow(p - ma20, 2), 0) / 20;
      const stdDev = Math.sqrt(variance);
      updatedLast.bollMid = +ma20.toFixed(2);
      updatedLast.bollUpper = +(ma20 + 2 * stdDev).toFixed(2);
      updatedLast.bollLower = +(ma20 - 2 * stdDev).toFixed(2);
    }
    if (bars.length >= 60) {
      const sum60 = bars.slice(bars.length - 59).reduce((s, b) => s + b.close, 0) + newPrice;
      updatedLast.ma60 = +(sum60 / 60).toFixed(2);
    }

    // Fast MACD for last bar
    if (bars.length >= 2) {
      const prevBar = bars[bars.length - 2];
      const k12 = 2 / 13;
      const k26 = 2 / 27;
      const k9 = 2 / 10;
      const prevEma12 = prevBar.ma5 ?? prevBar.close;
      const prevEma26 = prevBar.ma20 ?? prevBar.close;
      const ema12 = newPrice * k12 + prevEma12 * (1 - k12);
      const ema26 = newPrice * k26 + prevEma26 * (1 - k26);
      const dif = ema12 - ema26;
      const dea = dif * k9 + (prevBar.dea ?? 0) * (1 - k9);

      updatedLast.dif = +dif.toFixed(3);
      updatedLast.dea = +dea.toFixed(3);
      updatedLast.macd = +((dif - dea) * 2).toFixed(3);
    }

    // Keep previous bars reference identity intact: ONLY replace the last element
    const result = bars.slice(0, lastIndex);
    result.push(updatedLast);
    return result;
  } else {
    // 2. New interval reached strictly during trading hours: finalize previous bar, append ONE new bar
    const newPrice = +tick.price.toFixed(2);
    const newDate = formatNewCandleDate(interval, now);
    const openPrice = lastBar.close;

    const newBar: KlineBar = {
      date: newDate,
      open: openPrice,
      close: newPrice,
      high: Math.max(openPrice, newPrice),
      low: Math.min(openPrice, newPrice),
      volume: Math.max(1, tick.deltaVolume ?? 20),
      amount: Math.max(1, tick.deltaAmount ?? ((tick.deltaVolume ?? 20) * newPrice * 100)),
    };

    // Calculate MA for new bar
    if (bars.length >= 4) {
      const sum5 = bars.slice(bars.length - 4).reduce((s, b) => s + b.close, 0) + newPrice;
      newBar.ma5 = +(sum5 / 5).toFixed(2);
    }
    if (bars.length >= 9) {
      const sum10 = bars.slice(bars.length - 9).reduce((s, b) => s + b.close, 0) + newPrice;
      newBar.ma10 = +(sum10 / 10).toFixed(2);
    }
    if (bars.length >= 19) {
      const sum20 = bars.slice(bars.length - 19).reduce((s, b) => s + b.close, 0) + newPrice;
      newBar.ma20 = +(sum20 / 20).toFixed(2);
    }
    if (bars.length >= 59) {
      const sum60 = bars.slice(bars.length - 59).reduce((s, b) => s + b.close, 0) + newPrice;
      newBar.ma60 = +(sum60 / 60).toFixed(2);
    }

    // Keep max 100 bars to prevent SVG bloat
    const maxBars = 100;
    const trimmed = bars.length >= maxBars ? bars.slice(bars.length - maxBars + 1) : bars;
    return [...trimmed, newBar];
  }
}

/**
 * Incrementally update Intraday Minute Points (Timeline 240m)
 */
export function applyIncrementalMinutePoint(
  points: IntradayMinutePoint[],
  newPrice: number,
  prevClose: number,
  deltaVolume: number = 0,
  deltaAmount: number = 0
): IntradayMinutePoint[] {
  if (!points || points.length === 0) return points;

  const now = new Date();
  const c = getChinaDateTime(now);
  const currentMinuteStr = c.timeStr;

  const lastIndex = points.length - 1;
  const lastPoint = points[lastIndex];

  // If outside trading hours, or already reaching 240 points, or within same minute:
  if (!isAsharesTradingTime(now) || lastPoint.time === currentMinuteStr || points.length >= 240) {
    const updatedPrice = +newPrice.toFixed(2);
    const updatedVol = lastPoint.volume + deltaVolume;
    const updatedAmt = lastPoint.amount + (deltaAmount || deltaVolume * updatedPrice * 100);
    const change = +(updatedPrice - prevClose).toFixed(2);
    const changePercent = prevClose > 0 ? +((change / prevClose) * 100).toFixed(2) : 0;

    const updatedPoint: IntradayMinutePoint = {
      ...lastPoint,
      price: updatedPrice,
      volume: updatedVol,
      amount: updatedAmt,
      change,
      changePercent,
    };

    const result = points.slice(0, lastIndex);
    result.push(updatedPoint);
    return result;
  } else {
    // New trading minute reached during open hours
    const updatedPrice = +newPrice.toFixed(2);
    const change = +(updatedPrice - prevClose).toFixed(2);
    const changePercent = prevClose > 0 ? +((change / prevClose) * 100).toFixed(2) : 0;

    const newPoint: IntradayMinutePoint = {
      time: currentMinuteStr,
      price: updatedPrice,
      avgPrice: updatedPrice,
      volume: Math.max(1, deltaVolume),
      amount: Math.max(1, deltaAmount || deltaVolume * updatedPrice * 100),
      change,
      changePercent,
    };

    return [...points, newPoint];
  }
}
