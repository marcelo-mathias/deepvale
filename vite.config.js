import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

// src/main.js lists the parts of the game (src/game/**) in order. This plugin replaces main.js with
// those parts joined end to end, so they run exactly as one file would, and maps errors back to the part.
function gameParts(){
  const isMain = id => id.replace(/\\/g, '/').endsWith('/src/main.js');
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const vlq = n => { let v = n < 0 ? (-n << 1) | 1 : n << 1, out = ''; do { let d = v & 31; v >>>= 5; if (v) d |= 32; out += B64[d]; } while (v); return out; };
  let partFiles = [];
  return {
    name: 'deepvale-game-parts',
    enforce: 'pre',
    transform(code, id){
      if (!isMain(id)) return null;
      const dir = dirname(id), list = code.split('\n').filter(l => /^\/\/ game\//.test(l)).map(l => l.slice(3).trim());
      if (!code.includes('//#parts') || !list.length) return null;
      partFiles = list.map(p => resolve(dir, p));
      let out = '', mappings = [], prevSrc = 0, prevLine = 0;
      partFiles.forEach((file, si) => {
        this.addWatchFile(file);
        const text = readFileSync(file, 'utf8'), n = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
        out += text.endsWith('\n') ? text : text + '\n';
        for (let ln = 0; ln < n; ln++){ mappings.push('A' + vlq(si - prevSrc) + vlq(ln - prevLine) + 'A'); prevSrc = si; prevLine = ln; }
      });
      return { code: out, map: { version: 3, file: 'main.js', sources: partFiles.map(f => relative(dir, f).replace(/\\/g, '/')), sourcesContent: partFiles.map(f => readFileSync(f, 'utf8')), names: [], mappings: mappings.join(';') } };
    },
    // editing a part reloads the page (the parts are one module, so there is nothing smaller to hot-swap)
    handleHotUpdate({ file, server }){
      const f = file.replace(/\\/g, '/');
      if (!partFiles.some(p => p.replace(/\\/g, '/') === f)) return;
      const mod = [...server.moduleGraph.idToModuleMap.values()].find(m => m.id && isMain(m.id));
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

// Relative base so the build runs from any subfolder: itch.io, GitHub Pages, or a local file server.
export default defineConfig({
  base: './',
  plugins: [gameParts()],
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
