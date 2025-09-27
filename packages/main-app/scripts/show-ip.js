#!/usr/bin/env node

const os = require('os');

function getIPv4Addresses() {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  for (const interfaceName of Object.keys(networkInterfaces)) {
    const ifaceList = networkInterfaces[interfaceName] || [];
    for (const iface of ifaceList) {
      const isIPv4 = iface.family === 'IPv4' || iface.family === 4;
      if (isIPv4 && !iface.internal) {
        addresses.push({ name: interfaceName, address: iface.address });
      }
    }
  }
  return addresses;
}

function printAddresses() {
  const port = process.env.PORT || process.env.NEXT_DEV_PORT || 3002;
  const addresses = getIPv4Addresses();

  const header = '\nIPv4 アドレス (LAN) — 開発サーバーURL:';
  const localUrl = `  Local   : http://localhost:${port}`;

  console.log(header);
  console.log(localUrl);

  if (addresses.length === 0) {
    console.log('  Network : 検出できませんでした (Wi‑Fi/Ethernet 接続を確認してください)');
    console.log('');
    return;
  }

  for (const { name, address } of addresses) {
    console.log(`  Network : http://${address}:${port} (${name})`);
  }
  console.log('');
}

printAddresses();


