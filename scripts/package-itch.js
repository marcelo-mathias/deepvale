// Zips dist/ into release/deepvale-itch-v<version>.zip for upload to itch.io as an HTML game.
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const out = `release/deepvale-itch-v${version}.zip`;
mkdirSync('release', { recursive: true });
rmSync(out, { force: true });
execSync(`cd dist && zip -qr ../${out} .`, { stdio: 'inherit' });
console.log(`Packaged ${out}`);
