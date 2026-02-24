#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'docs', 'FRONT_BACK_SEPARATION_AUDIT.md');

const UI_DIRS = [
  path.join(ROOT, 'src', 'components'),
  path.join(ROOT, 'src', 'routes'),
];

const API_DIR = path.join(ROOT, 'src', 'lib', 'api');

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, predicate) {
  if (!(await exists(dir))) return [];

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath, predicate));
      continue;
    }
    if (predicate(fullPath)) files.push(fullPath);
  }

  return files;
}

function collectLineMatches(content, matcher) {
  const rows = content.split(/\r?\n/);
  const matches = [];

  for (let i = 0; i < rows.length; i += 1) {
    const line = rows[i];
    if (matcher.test(line)) {
      matches.push({ line: i + 1, text: line.trim() });
    }
    matcher.lastIndex = 0;
  }

  return matches;
}

function formatFindings(findings) {
  if (findings.length === 0) return '- none';
  return findings
    .map((item) => `- \`${item.file}:${item.line}\` ${item.text}`)
    .join('\n');
}

async function main() {
  const uiFiles = [];
  for (const dir of UI_DIRS) {
    const files = await walk(dir, (file) => file.endsWith('.svelte') || file.endsWith('+page.ts') || file.endsWith('+layout.ts'));
    uiFiles.push(...files);
  }

  const apiFiles = await walk(API_DIR, (file) => file.endsWith('.ts') || file.endsWith('.js'));

  const uiFetchFindings = [];
  const serverImportFindings = [];
  const externalApiFindings = [];

  for (const file of uiFiles) {
    const rel = toPosix(path.relative(ROOT, file));

    if (rel.startsWith('src/routes/api/')) continue;
    if (rel.endsWith('+server.ts')) continue;

    const source = await fs.readFile(file, 'utf8');

    const fetchHits = collectLineMatches(source, /\bfetch\s*\(/g);
    for (const hit of fetchHits) {
      uiFetchFindings.push({ file: rel, ...hit });
    }

    const serverImportHits = collectLineMatches(source, /from\s+['"]\$lib\/server\//g);
    for (const hit of serverImportHits) {
      serverImportFindings.push({ file: rel, ...hit });
    }
  }

  for (const file of apiFiles) {
    const rel = toPosix(path.relative(ROOT, file));
    const source = await fs.readFile(file, 'utf8');

    const externalHits = collectLineMatches(source, /(https?:\/\/|wss:\/\/)/g);
    for (const hit of externalHits) {
      externalApiFindings.push({ file: rel, ...hit });
    }
  }

  const generatedAt = new Date().toISOString();
  const report = [
    '# Front/Back Separation Audit',
    '',
    `- Generated at (UTC): ${generatedAt}`,
    `- Scope: \`src/components\`, \`src/routes\`, \`src/lib/api\``,
    '',
    '## Summary',
    `- UI direct fetch calls: ${uiFetchFindings.length}`,
    `- Client API external vendor calls: ${externalApiFindings.length}`,
    `- Client files importing $lib/server: ${serverImportFindings.length}`,
    '',
    '## UI Direct Fetch Findings',
    formatFindings(uiFetchFindings),
    '',
    '## External Vendor Calls in Client API Layer',
    formatFindings(externalApiFindings),
    '',
    '## Client Importing Server Modules',
    formatFindings(serverImportFindings),
    '',
    '## Notes',
    '- `UI direct fetch`는 컴포넌트/페이지가 API 세부사항을 직접 가지므로 API 래퍼 계층으로 이동하는 것이 권장됩니다.',
    '- `Client API external vendor calls`는 브라우저가 외부 벤더 API를 직접 호출한다는 의미이며, 운영 환경에서는 서버 프록시(`/api/*`) 경유가 안정적입니다.',
    '- `$lib/server` import는 브라우저 번들 경계 위반 가능성이 높으므로 즉시 제거 대상입니다.',
    '',
  ].join('\n');

  await fs.writeFile(OUTPUT, report, 'utf8');

  console.log('[audit-front-back-separation] report generated:', toPosix(path.relative(ROOT, OUTPUT)));
  console.log('[audit-front-back-separation] uiDirectFetch:', uiFetchFindings.length);
  console.log('[audit-front-back-separation] apiExternalVendorCalls:', externalApiFindings.length);
  console.log('[audit-front-back-separation] clientServerImports:', serverImportFindings.length);
}

main().catch((error) => {
  console.error('[audit-front-back-separation] failed:', error);
  process.exitCode = 1;
});
