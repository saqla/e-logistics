#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const port = process.env.PORT || process.env.NEXT_DEV_PORT || '3002';
const host = process.env.HOST || '0.0.0.0';

function waitForHttp(url, { timeoutMs = 120000, intervalMs = 500 } = {}) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for ${url}`));
          return;
        }
        setTimeout(check, intervalMs);
      });
      req.setTimeout(3000, () => {
        req.destroy(new Error('Request timeout'));
      });
    };
    check();
  });
}

async function main() {
  const nextBin = require.resolve('next/dist/bin/next');

  const child = spawn(process.execPath, [nextBin, 'dev', '-p', String(port), '-H', host], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) },
    shell: false,
  });

  child.on('exit', (code, signal) => {
    if (code !== null) process.exit(code);
    if (signal) {
      const signals = ['SIGINT', 'SIGTERM'];
      process.exit(signals.includes(signal) ? 0 : 1);
    }
  });

  try {
    await waitForHttp(`http://localhost:${port}`);
  } catch (err) {
    // 失敗してもサーバーは起動中の可能性があるので、そのまま終了を待つ
    return;
  }

  try {
    const showIpPath = path.resolve(__dirname, './show-ip.js');
    require(showIpPath);
  } catch (_) {
    // 何もしない（IP表示は必須ではない）
  }
}

main();


