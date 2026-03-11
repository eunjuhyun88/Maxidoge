#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  coordinationConfig,
  currentBranch,
  isFeatureBranch,
  listChangedFiles,
  loadConfig,
  normalizeRepoPath,
  readClaims,
  resolveRootDir,
} from './coordination-lib.mjs';
import { collectContracts } from './task-contract-lib.mjs';

const rootDir = resolveRootDir();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.stdio ?? 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`[autopilot] command failed (${result.status}): ${[command, ...args].join(' ')}`);
  }
  return result;
}

function sanitize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseArgs(argv) {
  const output = { stage: '', forceCheckpoint: false };
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!output.stage && !current.startsWith('-')) {
      output.stage = current;
      continue;
    }
    if (current === '--force-checkpoint') {
      output.forceCheckpoint = true;
      continue;
    }
    if (current === '-h' || current === '--help') {
      console.log('Usage: node scripts/dev/context-autopilot.mjs <stage> [--force-checkpoint]');
      process.exit(0);
    }
    throw new Error(`[autopilot] unknown option: ${current}`);
  }
  if (!output.stage) throw new Error('[autopilot] missing stage');
  return output;
}

function autopilotConfig(config) {
  return {
    enabled: config.autopilot?.enabled ?? true,
    agentId: process.env.CTX_AGENT_ID?.trim() || config.autopilot?.agentId || 'autopilot',
    autoCheckpoint: config.autopilot?.autoCheckpoint ?? true,
    autoClaim: config.autopilot?.autoClaim ?? true,
    autoContract: config.autopilot?.autoContract ?? true,
    minimumClaimPathDepth: Number(config.autopilot?.minimumClaimPathDepth ?? 2),
    defaultSurface: config.autopilot?.defaultSurface || (config.surfaces?.[0]?.id ?? 'core'),
    defaultObjectivePrefix: config.autopilot?.defaultObjectivePrefix || 'Resume branch work on',
    defaultDocs: config.autopilot?.defaultDocs ?? [
      'README.md',
      'AGENTS.md',
      'docs/README.md',
      'ARCHITECTURE.md',
      'docs/CONTEXT_ENGINEERING.md',
    ],
  };
}

function inferSurface(config, branchName, branchClaims, changedFiles, autopilot) {
  const envSurface = process.env.CTX_SURFACE?.trim();
  if (envSurface) return envSurface;
  if (branchClaims.length === 1 && branchClaims[0].surface) return branchClaims[0].surface;

  const surfaces = (config.surfaces ?? []).map((item) => item.id).filter(Boolean);
  if (surfaces.length === 0) return autopilot.defaultSurface || 'core';
  if (surfaces.length === 1) return surfaces[0];

  const branchLower = branchName.toLowerCase();
  for (const surface of surfaces) {
    if (branchLower.includes(surface.toLowerCase())) return surface;
  }

  for (const filePath of changedFiles) {
    const lower = filePath.toLowerCase();
    for (const surface of surfaces) {
      if (lower.includes(`/${surface.toLowerCase()}`) || lower.includes(`${surface.toLowerCase()}.`)) {
        return surface;
      }
    }
  }

  return autopilot.defaultSurface || surfaces[0];
}

function pointerWorkId(branchName) {
  const branchSafe = sanitize(branchName.replaceAll('/', '-'));
  const pointer = path.join(rootDir, '.agent-context', 'runtime', `${branchSafe}.work-id`);
  if (!fs.existsSync(pointer)) return '';
  return fs.readFileSync(pointer, 'utf8').trim();
}

function currentWorkId(branchName) {
  const explicit = process.env.CTX_WORK_ID?.trim();
  if (explicit) return explicit;
  const pointer = pointerWorkId(branchName);
  if (pointer) return pointer;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  return `AUTO-${stamp}-${sanitize(branchName.replaceAll('/', '-'))}`;
}

function branchContractId(branchName) {
  const explicit = process.env.CTX_CONTRACT_ID?.trim();
  if (explicit) return explicit;
  return sanitize(branchName.replaceAll('/', '-'));
}

function branchCheckpointPath(branchName) {
  return path.join(rootDir, '.agent-context', 'checkpoints', `${sanitize(branchName.replaceAll('/', '-'))}-latest.md`);
}

function changedFilesForAutopilot(mainBranch, coordination) {
  return listChangedFiles(rootDir, mainBranch)
    .map(normalizeRepoPath)
    .filter(Boolean)
    .filter((filePath) => !coordination.sharedPathPrefixes.some((prefix) => filePath === prefix || filePath.startsWith(`${prefix}/`)));
}

function commonPathPrefix(paths) {
  if (paths.length === 0) return '';
  const split = paths.map((item) => item.split('/').filter(Boolean));
  if (split.length === 1) {
    if (split[0].length <= 1) return split[0][0] ?? '';
    return split[0].slice(0, -1).join('/') || split[0].join('/');
  }
  const prefix = [];
  for (let index = 0; ; index += 1) {
    const candidate = split[0][index];
    if (!candidate) break;
    if (split.every((parts) => parts[index] === candidate)) {
      prefix.push(candidate);
      continue;
    }
    break;
  }
  return prefix.join('/');
}

function inferClaimPath(changedFiles, autopilot) {
  const explicit = process.env.CTX_AUTO_CLAIM_PATH?.trim();
  if (explicit) return normalizeRepoPath(explicit);
  const prefix = commonPathPrefix(changedFiles);
  if (!prefix) return '';
  const depth = prefix.split('/').filter(Boolean).length;
  if (depth < autopilot.minimumClaimPathDepth) return '';
  return prefix;
}

function ensureCheckpoint({ branchName, surface, workId, autopilot, forceCheckpoint }) {
  const checkpointLatest = branchCheckpointPath(branchName);
  if (!forceCheckpoint && fs.existsSync(checkpointLatest)) {
    console.log(`[autopilot] checkpoint already exists for branch ${branchName}`);
    return;
  }

  const objective = process.env.CTX_OBJECTIVE?.trim() || `${autopilot.defaultObjectivePrefix} ${branchName}`;
  const args = [
    'scripts/dev/context-checkpoint.sh',
    '--work-id', workId,
    '--surface', surface,
    '--objective', objective,
    '--status', 'in_progress',
    '--why', 'autopilot created a provisional checkpoint because the branch had no semantic checkpoint yet.',
    '--scope', 'Replace this provisional checkpoint with a task-specific objective and scope once the work intent is explicit.',
    '--next', 'Replace the provisional objective with the actual task objective.',
    '--next', 'Confirm or refine the owned path boundary before push.',
  ];
  for (const docPath of autopilot.defaultDocs) {
    args.push('--doc', docPath);
  }
  run('bash', args);
}

function ensureClaim({ branchName, surface, workId, autopilot, coordination, branchClaims, changedFiles }) {
  if (!coordination.requireClaimOnFeatureBranches || !isFeatureBranch(branchName, coordination.featureBranchPrefixes)) {
    return;
  }
  if (branchClaims.length > 0) {
    console.log(`[autopilot] claim already exists for branch ${branchName}`);
    return;
  }
  const claimPath = inferClaimPath(changedFiles, autopilot);
  if (!claimPath) {
    console.log(`[autopilot] no safe claim path inferred for branch ${branchName}; skipping provisional claim`);
    return;
  }
  run('node', [
    'scripts/dev/claim-work.mjs',
    '--work-id', workId,
    '--agent', autopilot.agentId,
    '--surface', surface,
    '--summary', `Autopilot provisional ownership for ${branchName}`,
    '--path', claimPath,
  ]);
}

function ensureContract({ branchName, surface, autopilot, coordination }) {
  if (!isFeatureBranch(branchName, coordination.featureBranchPrefixes)) {
    return;
  }
  const { active } = collectContracts(rootDir);
  if (active.some((item) => item.branch === branchName)) {
    console.log(`[autopilot] contract already exists for branch ${branchName}`);
    return;
  }
  run('node', [
    'scripts/dev/scaffold-task-contract.mjs',
    '--id', branchContractId(branchName),
    '--title', branchName.replace(/^codex\//, ''),
    '--surface', surface,
    '--branch', branchName,
    '--goal', `${autopilot.defaultObjectivePrefix} ${branchName}`,
    '--provisional',
  ]);
}

const { stage, forceCheckpoint } = parseArgs(process.argv.slice(2));
const config = loadConfig(rootDir);
const autopilot = autopilotConfig(config);

if (process.env.CTX_AUTOPILOT_DISABLED === '1' || !autopilot.enabled) {
  console.log('[autopilot] disabled');
  process.exit(0);
}

const branchName = currentBranch(rootDir);
if (!branchName || branchName === 'HEAD') {
  console.log('[autopilot] detached HEAD; skipping');
  process.exit(0);
}

const mainBranch = config.git?.mainBranch || 'main';
const coordination = coordinationConfig(config);
const changedFiles = changedFilesForAutopilot(mainBranch, coordination);
const claims = readClaims(rootDir);
const branchClaims = claims.filter((claim) => claim.branch === branchName);
const surface = inferSurface(config, branchName, branchClaims, changedFiles, autopilot);
const workId = currentWorkId(branchName);

if (autopilot.autoCheckpoint && ['safe-status', 'safe-sync-start', 'manual'].includes(stage)) {
  ensureCheckpoint({ branchName, surface, workId, autopilot, forceCheckpoint });
}

if (autopilot.autoContract && ['safe-status', 'pre-push', 'manual'].includes(stage)) {
  ensureContract({ branchName, surface, autopilot, coordination });
}

if (autopilot.autoClaim && ['safe-sync-end', 'pre-push', 'manual'].includes(stage)) {
  ensureClaim({ branchName, surface, workId, autopilot, coordination, branchClaims, changedFiles });
}

console.log(`[autopilot] stage=${stage} branch=${branchName} work_id=${workId} surface=${surface}`);
