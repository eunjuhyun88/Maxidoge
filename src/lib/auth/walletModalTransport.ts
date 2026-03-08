import { loginAuth, logoutAuth, registerAuth, requestWalletNonce, verifyWalletSignature } from '$lib/api/auth';
import {
  getPreferredEvmChainCode,
  hasInjectedEvmProvider,
  isWalletConnectConfigured,
  requestInjectedEvmAccount,
  requestPhantomSolanaAccount,
  signInjectedEvmMessage,
  type WalletProviderKey,
} from '$lib/wallet/providers';

export function isWalletProviderKey(value: string): value is WalletProviderKey {
  return value === 'metamask'
    || value === 'coinbase'
    || value === 'walletconnect'
    || value === 'phantom';
}

function isEvmAddress(address: string): boolean {
  return address.startsWith('0x');
}

export async function connectWalletProvider(provider: WalletProviderKey): Promise<{
  address: string;
  chain: string;
}> {
  const preferredEvmChain = getPreferredEvmChainCode();

  if (provider === 'walletconnect' && !isWalletConnectConfigured()) {
    throw new Error('WalletConnect project id is missing. Set PUBLIC_WALLETCONNECT_PROJECT_ID first.');
  }

  if (provider === 'phantom') {
    if (hasInjectedEvmProvider('phantom')) {
      return {
        address: await requestInjectedEvmAccount('phantom'),
        chain: preferredEvmChain,
      };
    }

    return {
      address: await requestPhantomSolanaAccount(),
      chain: 'SOL',
    };
  }

  return {
    address: await requestInjectedEvmAccount(provider),
    chain: preferredEvmChain,
  };
}

export async function signWalletOwnership(args: {
  address: string;
  provider: WalletProviderKey;
  chain: string;
  verifyLinkedSession: boolean;
}): Promise<{ message: string; signature: string }> {
  if (!isEvmAddress(args.address)) {
    throw new Error('Solana wallet auth is temporarily unavailable. Use an EVM wallet.');
  }

  const noncePayload = await requestWalletNonce({
    address: args.address,
    provider: args.provider,
    chain: args.chain,
  });

  const signature = await signInjectedEvmMessage(args.provider, noncePayload.message, args.address);

  if (args.verifyLinkedSession) {
    await verifyWalletSignature({
      address: args.address,
      message: noncePayload.message,
      signature,
      provider: args.provider,
      chain: args.chain,
    });
  }

  return {
    message: noncePayload.message,
    signature,
  };
}

export function submitWalletSignup(args: {
  email: string;
  nickname: string;
  walletAddress: string;
  walletMessage: string;
  walletSignature: string;
}) {
  return registerAuth(args);
}

export function submitWalletLogin(args: {
  email: string;
  nickname?: string;
  walletAddress: string;
  walletMessage: string;
  walletSignature: string;
}) {
  return loginAuth({
    email: args.email,
    nickname: args.nickname ?? '',
    walletAddress: args.walletAddress,
    walletMessage: args.walletMessage,
    walletSignature: args.walletSignature,
  });
}

export async function logoutWalletSession(): Promise<void> {
  try {
    await logoutAuth();
  } catch (error) {
    console.warn('[WalletModal] logout api failed', error);
  }
}
