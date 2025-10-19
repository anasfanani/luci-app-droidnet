#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const wsScrcpyPath = path.join(__dirname, 'node_modules', 'ws-scrcpy', 'dist', 'index.js');

const server = spawn('node', [wsScrcpyPath, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ADB_HOST: '127.0.0.1',
    ADB_PORT: '5555'
  }
});

server.on('error', (err) => {
  console.error('Failed to start ws-scrcpy:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code);
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  server.kill('SIGINT');
});
