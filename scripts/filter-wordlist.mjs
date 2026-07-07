#!/usr/bin/env node
// Filter a `WORD;score` crossword wordlist (e.g. the Crossword Nexus
// collaborative list) to A–Z answers of length 3–15. Reads stdin, writes
// stdout. See data/fill-wordlist/PROVENANCE.md.
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { buf += c; });
process.stdin.on('end', () => {
  const out = [];
  for (const line of buf.split('\n')) {
    const i = line.indexOf(';');
    if (i < 0) continue;
    const w = line.slice(0, i).toUpperCase();
    const s = line.slice(i + 1).trim();
    if (!/^[A-Z]+$/.test(w) || w.length < 3 || w.length > 15) continue;
    out.push(`${w};${s}`);
  }
  process.stdout.write(out.join('\n') + '\n');
});
