// Zips dist/ into release/deepvale-itch-v<version>.zip for upload to itch.io as an HTML game.
// Windows has no `zip` command, but Windows 10+ ships bsdtar (tar.exe), which writes zip files with forward-slash paths.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const out = resolve(`release/deepvale-itch-v${version}.zip`);
mkdirSync('release', { recursive: true });
rmSync(out, { force: true });
// zip the contents of dist/ (index.html at the root of the zip, as itch.io expects)
const entries = readdirSync('dist');
if (process.platform === 'win32') execFileSync('tar', ['-a', '-cf', out, ...entries], { cwd: 'dist', stdio: 'inherit' });
else execFileSync('zip', ['-qr', out, ...entries], { cwd: 'dist', stdio: 'inherit' });
console.log(`Packaged ${out}`);
