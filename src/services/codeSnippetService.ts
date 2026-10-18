import { CodeTab, KlineInterval } from '../types/stock';

export interface CodeSnippetOptions {
  symbol: string;
  stockName: string;
  interval: KlineInterval;
  apiKey?: string;
  tab: CodeTab;
}

export function generateSnippet({ symbol, stockName, interval, apiKey, tab }: CodeSnippetOptions): string {
  const token = apiKey && apiKey.trim().length > 0 ? apiKey.trim() : 'YOUR_QUANTDASH_TOKEN';

  switch (tab) {
    case 'sdk':
      return `# -*- coding: utf-8 -*-
"""
QuantDash Python SDK 极速上手示例
官方文档: https://docs.quantdash.net/zh-Hans
获取 Token: https://quantdash.net/
安装库: pip install quantdash
"""
import quantdash as qd

# 1. 创建客户端实例
client = qd.Client(api_key="${token}")

# 2. 查询【${stockName} (${symbol})】的行情数据
# 支持周期: timeline(分时), 1m(1分k), 5m, 15m, 60m, 120m(120分), 1d(日k), 1w(周k), 1mo(月k), 1q(季k), 1y(年k)
# 当前选择: ${interval}
df = client.get_kline(
    symbol="${symbol}",
    freq="${interval === 'timeline' ? 'minute' : interval}",
    start="2024-01-01"
)

# 3. 输出前 10 条量化数据 (包含 open, high, low, close, volume 等蜡烛图关键字段)
print("--- ${stockName} 数据概览 ---")
print(df.tail(10))

# 4. 计算常用技术指标 (如 5 日均线与 20 日均线)
df['MA5'] = df['close'].rolling(window=5).mean()
df['MA20'] = df['close'].rolling(window=20).mean()
print("最新收盘价:", df['close'].iloc[-1], "MA5:", round(df['MA5'].iloc[-1], 2))
`;

    case 'requests':
      return `# -*- coding: utf-8 -*-
"""
使用原生 Python requests 发送 HTTP 请求
无需安装任何复杂框架，仅需标准网络库
"""
import requests
import json

endpoint = "https://api.quantdash.net/v1/market/kline"
headers = {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json"
}
params = {
    "symbol": "${symbol}",
    "freq": "${interval}",
    "limit": 100
}

try:
    response = requests.get(endpoint, headers=headers, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()
    
    print("状态码:", response.status_code)
    print("标的代码:", data.get("symbol", "${symbol}"))
    print("返回记录数:", len(data.get("data", [])))
    print("最新一条数据:", json.dumps(data.get("data", [])[-1], indent=2, ensure_ascii=False))
except Exception as e:
    print("请求失败，请检查 API Token 是否正确:", e)
`;

    case 'curl':
      return `curl -X GET "https://api.quantdash.net/v1/market/kline?symbol=${symbol}&freq=${interval}&limit=100" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Accept: application/json"`;

    case 'pandas_excel':
      return `# -*- coding: utf-8 -*-
"""
零门槛将 QuantDash 量化数据直接导出为 Excel 表格
适合非程序员、财务分析师及投资顾问离线分析
运行前确保已安装: pip install quantdash pandas openpyxl
"""
import quantdash as qd
import pandas as pd

# 1. 登录 QuantDash
client = qd.Client(api_key="${token}")

print("正在从 QuantDash 云端拉取【${stockName}】历史量化数据...")
df = client.get_kline(symbol="${symbol}", freq="${interval}", start="2024-01-01")

# 2. 导出为 Excel 文件
filename = "${stockName}_${symbol}_行情数据.xlsx"
df.to_excel(filename, index=False, sheet_name="行情K线")

print(f"🎉 导出成功！已将数据保存到本地文件: {filename}")
print(f"总记录数: {len(df)} 行，可以用 Excel 双击打开做透视表或画图！")
`;

    default:
      return '';
  }
}
