import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const label = 'com.partfinder.dev';
const launchAgentsDir = join(homedir(), 'Library', 'LaunchAgents');
const plistPath = join(launchAgentsDir, `${label}.plist`);
const logDir = join(repoRoot, 'logs');
const uid = process.getuid?.();
const domain = uid ? `gui/${uid}` : 'gui/501';
const shellCommand = `cd ${quoteForShell(repoRoot)} && npm run dev:all`;

const command = process.argv[2] || 'status';

function quoteForShell(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function runLaunchctl(args, options = {}) {
  return execFileSync('launchctl', args, {
    encoding: 'utf8',
    stdio: options.quiet ? ['ignore', 'pipe', 'pipe'] : 'pipe',
  });
}

function plistXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>${shellCommand}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${repoRoot}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${join(logDir, 'partfinder-launchd.out.log')}</string>
  <key>StandardErrorPath</key>
  <string>${join(logDir, 'partfinder-launchd.err.log')}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
`;
}

function printStatus() {
  console.log(`LaunchAgent: ${plistPath}`);
  console.log(`Installed: ${existsSync(plistPath) ? 'yes' : 'no'}`);
  try {
    const output = runLaunchctl(['print', `${domain}/${label}`], { quiet: true });
    const pid = output.match(/pid = (\d+)/)?.[1] || 'not running';
    console.log(`Loaded: yes`);
    console.log(`PID: ${pid}`);
  } catch {
    console.log('Loaded: no');
  }
  console.log(`Logs: ${logDir}`);
}

function install() {
  mkdirSync(launchAgentsDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });
  writeFileSync(plistPath, plistXml());

  try {
    runLaunchctl(['bootout', domain, plistPath], { quiet: true });
  } catch {
    // Not loaded yet.
  }

  runLaunchctl(['bootstrap', domain, plistPath]);
  runLaunchctl(['enable', `${domain}/${label}`]);
  runLaunchctl(['kickstart', '-k', `${domain}/${label}`]);

  console.log('PartFinder autostart installed and started.');
  printStatus();
}

function uninstall() {
  try {
    runLaunchctl(['bootout', domain, plistPath], { quiet: true });
  } catch {
    // Already unloaded.
  }

  if (existsSync(plistPath)) rmSync(plistPath);
  console.log('PartFinder autostart removed.');
  printStatus();
}

if (command === 'install') {
  install();
} else if (command === 'uninstall') {
  uninstall();
} else if (command === 'status') {
  printStatus();
} else if (command === 'plist') {
  process.stdout.write(existsSync(plistPath) ? readFileSync(plistPath, 'utf8') : plistXml());
} else {
  console.error('Usage: npm run autostart:install | autostart:uninstall | autostart:status');
  process.exit(1);
}
