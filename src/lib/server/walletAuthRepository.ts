import { query } from './db';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

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

export function normalizeEthAddress(address: string): string {
  return address.toLowerCase();
}

export function extractNonceFromMessage(message: string): string | null {
  const match = message.match(/Nonce:\s*([A-Za-z0-9-]+)/i);
  return match?.[1] || null;
}

export async function issueWalletNonce(args: {
  address: string;
  provider?: string | null;
  userAgent?: string | null;
  issuedIp?: string | null;
  ttlMinutes?: number;
}): Promise<IssueWalletNonceResult> {
  const address = normalizeEthAddress(args.address);
  const ttlMinutes = Number.isFinite(args.ttlMinutes) ? Math.max(1, Math.min(30, Number(args.ttlMinutes))) : 10;

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
      args.issuedIp || null,
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
}): Promise<void> {
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
          provider,
          signature,
          verified,
          connected_at,
          meta
        )
        VALUES ($1, $2, $3, $4, true, now(), '{}'::jsonb)
      `,
      [args.userId, args.address, args.provider || null, args.signature]
    );
  } catch (error: any) {
    // wallet_connections is optional in some environments.
    if (error?.code !== '42P01') {
      throw error;
    }
  }
}
