import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/suggest': {
          target: 'https://searchapi.eastmoney.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/suggest/, ''),
        },
        '/api/kline': {
          target: 'https://push2his.eastmoney.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/kline/, ''),
        },
        '/api/minute': {
          target: 'https://web.ifzq.gtimg.cn',
          changeOrigin: true,
          headers: {
            'Referer': 'https://gu.qq.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
          rewrite: (path) => path.replace(/^\/api\/minute/, ''),
        },
        '/api/sina-kline': {
          target: 'https://quotes.sina.cn',
          changeOrigin: true,
          headers: {
            'Referer': 'https://finance.sina.com.cn',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
          rewrite: (path) => path.replace(/^\/api\/sina-kline/, ''),
        },
        '/api/quote': {
          target: 'https://qt.gtimg.cn',
          changeOrigin: true,
          headers: {
            'Referer': 'https://finance.qq.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
          rewrite: (path) => path.replace(/^\/api\/quote/, ''),
        },
      },
    },
  };
});
