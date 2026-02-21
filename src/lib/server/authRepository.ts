import { query } from './db';

export interface AuthUserRow {
  id: string;
  email: string;
  nickname: string;
  tier: 'guest' | 'registered' | 'connected' | 'verified';
  phase: number;
  wallet_address: string | null;
}

export interface CreateAuthUserInput {
  email: string;
  nickname: string;
  walletAddress: string | null;
}

export async function findAuthUserConflict(email: string, nickname: string): Promise<{
  emailTaken: boolean;
  nicknameTaken: boolean;
}> {
  const result = await query<{ email: string; nickname: string }>(
    `
      SELECT email, nickname
      FROM users
      WHERE lower(email) = lower($1) OR lower(nickname) = lower($2)
    `,
    [email, nickname]
  );

  let emailTaken = false;
  let nicknameTaken = false;
  for (const row of result.rows) {
    if (row.email.toLowerCase() === email.toLowerCase()) emailTaken = true;
    if (row.nickname.toLowerCase() === nickname.toLowerCase()) nicknameTaken = true;
  }

  return { emailTaken, nicknameTaken };
}

export async function createAuthUser(input: CreateAuthUserInput): Promise<AuthUserRow> {
  const tier: AuthUserRow['tier'] = input.walletAddress ? 'connected' : 'registered';
  const phase = input.walletAddress ? 2 : 1;

  const result = await query<AuthUserRow>(
    `
      INSERT INTO users (email, nickname, tier, phase, wallet_address, wallet_signature)
      VALUES ($1, $2, $3, $4, $5, null)
      RETURNING id, email, nickname, tier, phase, wallet_address
    `,
    [input.email, input.nickname, tier, phase, input.walletAddress]
  );
  return result.rows[0];
}

export async function createAuthSession(args: {
  token: string;
  userId: string;
  expiresAtIso: string;
}): Promise<void> {
  await query(
    `
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES ($1, $2, $3::timestamptz)
    `,
    [args.token, args.userId, args.expiresAtIso]
  );
}

export async function getAuthenticatedUser(token: string, userId: string): Promise<AuthUserRow | null> {
  const result = await query<AuthUserRow>(
    `
      SELECT
        u.id,
        u.email,
        u.nickname,
        u.tier,
        u.phase,
        u.wallet_address
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1
        AND s.user_id = $2
        AND s.expires_at > now()
      LIMIT 1
    `,
    [token, userId]
  );

  return result.rows[0] || null;
}
