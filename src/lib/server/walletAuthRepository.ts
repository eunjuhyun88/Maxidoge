import { query } from './db';
import { isIP } from 'node:net';
import { recoverMessageAddress, type Hex } from 'viem';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SOL_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
let _nonceInfraReady = false;

export interface IssueWalletNonceResult {
  nonce: string;
  message: string;
  expiresAt: string;
}

function buildNonceMessage(address: string, nonce: string, issuedAtIso: string): string {
  return [
    'MAXI DOGE Wallet Verification',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAtIso}`,
    'Signing this message proves wallet ownership. No blockchain transaction is sent.',
  ].join('\n');
}

export function isValidEthAddress(address: string): boolean {
  return ETH_ADDRESS_RE.test(address);
}

export function isValidSolAddress(address: string): boolean {
  return SOL_ADDRESS_RE.test(address);
}

export function isValidWalletAddress(address: string): boolean {
  return isValidEthAddress(address) || isValidSolAddress(address);
}

export function normalizeEthAddress(address: string): string {
  return address.toLowerCase();
}

export function extractNonceFromMessage(message: string): string | null {
  const match = message.match(/Nonce:\s*([A-Za-z0-9-]+)/i);
  return match?.[1] || null;
}

export async function verifyEvmMessageSignature(args: {
  address: string;
  message: string;
  signature: string;
}): Promise<boolean> {
  if (!isValidEthAddress(args.address)) return false;
  try {
    const recovered = await recoverMessageAddress({
      message: args.message,
      signature: args.signature as Hex,
    });
    return normalizeEthAddress(recovered) === normalizeEthAddress(args.address);
  } catch {
    return false;
  }
}

export async function verifyAndConsumeEvmNonce(args: {
  address: string;
  message: string;
  signature: string;
}): Promise<'ok' | 'missing_nonce' | 'invalid_signature' | 'invalid_nonce'> {
  const address = normalizeEthAddress(args.address);
  const nonce = extractNonceFromMessage(args.message);
  if (!nonce) return 'missing_nonce';

  const verified = await verifyEvmMessageSignature({
    address,
    message: args.message,
    signature: args.signature,
  });
  if (!verified) return 'invalid_signature';

  const consumed = await consumeWalletNonce({
    address,
    nonce,
    message: args.message,
  });

  return consumed ? 'ok' : 'invalid_nonce';
}

function sanitizeIssuedIp(raw?: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim() || '';
  if (!first) return null;

  // Common proxy format: "1.2.3.4:5678"
  const ipv4WithPort = first.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (ipv4WithPort?.[1] && isIP(ipv4WithPort[1]) === 4) {
    return ipv4WithPort[1];
  }

  // Common proxy format: "[2001:db8::1]:443"
  const bracketedIpv6 = first.match(/^\[([0-9a-fA-F:]+)\](?::\d+)?$/);
  if (bracketedIpv6?.[1] && isIP(bracketedIpv6[1]) === 6) {
    return bracketedIpv6[1];
  }

  if (isIP(first) > 0) return first;
  return null;
}

async function ensureNonceInfrastructure(): Promise<void> {
  if (_nonceInfraReady) return;

  await query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await query(
    `
      CREATE TABLE IF NOT EXISTS auth_nonces (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        address text NOT NULL,
        nonce text NOT NULL,
        message text NOT NULL,
        provider text,
        issued_ip inet,
        user_agent text,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (address ~ '^0x[0-9a-fA-F]{40}$'),
        CHECK (char_length(nonce) BETWEEN 16 AND 128),
        CHECK (expires_at > created_at)
      )
    `
  );
  await query(
    `
      CREATE INDEX IF NOT EXISTS idx_auth_nonces_address_created_at
      ON auth_nonces (lower(address), created_at DESC)
    `
  );
  await query(
    `
      CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_nonces_active_address_nonce
      ON auth_nonces (lower(address), nonce)
      WHERE consumed_at IS NULL
    `
  );

  _nonceInfraReady = true;
}

export async function issueWalletNonce(args: {
  address: string;
  provider?: string | null;
  userAgent?: string | null;
  issuedIp?: string | null;
  ttlMinutes?: number;
}): Promise<IssueWalletNonceResult> {
  await ensureNonceInfrastructure();

  const address = normalizeEthAddress(args.address);
  const ttlMinutes = Number.isFinite(args.ttlMinutes) ? Math.max(1, Math.min(30, Number(args.ttlMinutes))) : 10;
  const issuedIp = sanitizeIssuedIp(args.issuedIp);

  const nonce = crypto.randomUUID().replace(/-/g, '');
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttlMinutes * 60 * 1000);
  const message = buildNonceMessage(address, nonce, issuedAt.toISOString());

  await query(
    `
      UPDATE auth_nonces
      SET consumed_at = now()
      WHERE lower(address) = lower($1)
        AND consumed_at IS NULL
    `,
    [address]
  );

  await query(
    `
      INSERT INTO auth_nonces (address, nonce, message, provider, user_agent, issued_ip, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6::inet, $7::timestamptz)
    `,
    [
      address,
      nonce,
      message,
      args.provider || null,
      args.userAgent || null,
      issuedIp,
      expiresAt.toISOString(),
    ]
  );

  return {
    nonce,
    message,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function consumeWalletNonce(args: {
  address: string;
  nonce: string;
  message: string;
}): Promise<boolean> {
  await ensureNonceInfrastructure();

  const result = await query<{ id: string }>(
    `
      UPDATE auth_nonces
      SET consumed_at = now()
      WHERE id = (
        SELECT id
        FROM auth_nonces
        WHERE lower(address) = lower($1)
          AND nonce = $2
          AND message = $3
          AND consumed_at IS NULL
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id
    `,
    [args.address, args.nonce, args.message]
  );

  return result.rowCount > 0;
}

export async function linkWalletToUser(args: {
  userId: string;
  address: string;
  signature: string;
  provider?: string | null;
  chain?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  const chain = args.chain?.trim() || 'ARB';
  const metaJson = JSON.stringify(args.meta ?? {});

  await query(
    `
      UPDATE users
      SET
        wallet_address = $1,
        wallet_signature = $2,
        tier = 'verified',
        phase = GREATEST(phase, 2),
        updated_at = now()
      WHERE id = $3
      `,
    [args.address, args.signature, args.userId]
  );

  try {
    await query(
      `
        INSERT INTO wallet_connections (
          user_id,
          address,
          chain,
          provider,
          signature,
          verified,
          connected_at,
          meta
        )
        VALUES ($1, $2, $3, $4, $5, true, now(), $6::jsonb)
      `,
      [
        args.userId,
        args.address,
        chain,
        args.provider || null,
        args.signature,
        metaJson,
      ]
    );
  } catch (error: any) {
    // wallet_connections is optional in some environments.
    if (error?.code !== '42P01') {
      throw error;
    }
  }
}
