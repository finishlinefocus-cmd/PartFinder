import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const services = [
  {
    name: 'api',
    command: npmCommand,
    args: ['run', 'dev:api'],
    url: `http://localhost:${process.env.PORT || 4001}`,
  },
  {
    name: 'client',
    command: npmCommand,
    args: ['--prefix', 'client', 'run', 'dev', '--', '--host', '0.0.0.0'],
    url: 'http://localhost:5173',
  },
];

const children = new Map();
let shuttingDown = false;

function prefixOutput(name, stream, chunk) {
  const lines = String(chunk).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line && index === lines.length - 1) return;
    stream.write(`[${name}] ${line}\n`);
  });
}

function stopAll(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children.values()) {
    if (!child.killed) child.kill(signal);
  }
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  children.set(service.name, child);
  child.stdout.on('data', chunk => prefixOutput(service.name, process.stdout, chunk));
  child.stderr.on('data', chunk => prefixOutput(service.name, process.stderr, chunk));
  child.on('exit', (code, signal) => {
    children.delete(service.name);
    if (!shuttingDown && code !== 0) {
      console.error(`[launcher] ${service.name} exited with ${signal || `code ${code}`}. Stopping remaining services.`);
      stopAll();
      process.exitCode = code || 1;
    }
  });
}

console.log('[launcher] PartFinder dev stack starting...');
services.forEach(service => console.log(`[launcher] ${service.name}: ${service.url}`));
console.log('[launcher] Press Ctrl-C to stop all services.');

process.on('SIGINT', () => {
  stopAll('SIGINT');
});

process.on('SIGTERM', () => {
  stopAll('SIGTERM');
});

process.on('exit', () => {
  stopAll();
});
