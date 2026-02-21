export type WalletProviderKey = 'metamask' | 'coinbase' | 'walletconnect' | 'phantom';

export const WALLET_PROVIDER_LABEL: Record<WalletProviderKey, string> = {
  metamask: 'MetaMask',
  coinbase: 'Coinbase Wallet',
  walletconnect: 'WalletConnect',
  phantom: 'Phantom',
};

type Eip1193RequestArgs = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

interface Eip1193Provider {
  request: (args: Eip1193RequestArgs) => Promise<unknown>;
  providers?: Eip1193Provider[];
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isWalletConnect?: boolean;
  isPhantom?: boolean;
  isPhantomEthereum?: boolean;
}

interface PhantomSolanaConnectResult {
  publicKey?: { toString: () => string };
}

interface PhantomSolanaSignResult {
  signature: Uint8Array;
}

interface PhantomSolanaProvider {
  isPhantom?: boolean;
  connect: (args?: { onlyIfTrusted?: boolean }) => Promise<PhantomSolanaConnectResult>;
  signMessage: (message: Uint8Array, display?: 'utf8' | 'hex') => Promise<PhantomSolanaSignResult>;
}

interface WalletWindow extends Window {
  ethereum?: Eip1193Provider;
  phantom?: {
    solana?: PhantomSolanaProvider;
  };
}

function getWalletWindow(): WalletWindow | null {
  if (typeof window === 'undefined') return null;
  return window as WalletWindow;
}

function getEthereumRoot(): Eip1193Provider | null {
  const w = getWalletWindow();
  const ethereum = w?.ethereum;
  if (!ethereum || typeof ethereum.request !== 'function') return null;
  return ethereum;
}

function getInjectedEvmProviders(): Eip1193Provider[] {
  const root = getEthereumRoot();
  if (!root) return [];
  if (Array.isArray(root.providers) && root.providers.length > 0) {
    return root.providers.filter((p) => typeof p?.request === 'function');
  }
  return [root];
}

function isProviderMatch(provider: Eip1193Provider, key: WalletProviderKey): boolean {
  if (key === 'metamask') return provider.isMetaMask === true;
  if (key === 'coinbase') return provider.isCoinbaseWallet === true;
  if (key === 'walletconnect') return provider.isWalletConnect === true;
  if (key === 'phantom') return provider.isPhantom === true || provider.isPhantomEthereum === true;
  return false;
}

function resolveInjectedEvmProvider(key: WalletProviderKey): Eip1193Provider | null {
  const providers = getInjectedEvmProviders();
  const exact = providers.find((p) => isProviderMatch(p, key));
  if (exact) return exact;

  // Fallback only for MetaMask when a single injected provider exists.
  if (key === 'metamask' && providers.length === 1) return providers[0];
  return null;
}

export function hasInjectedEvmProvider(key: WalletProviderKey): boolean {
  return resolveInjectedEvmProvider(key) !== null;
}

export async function requestInjectedEvmAccount(key: WalletProviderKey): Promise<string> {
  const provider = resolveInjectedEvmProvider(key);
  if (!provider) {
    throw new Error(`${WALLET_PROVIDER_LABEL[key]} provider not detected. Check extension/app connection.`);
  }

  const accountsRaw = await provider.request({ method: 'eth_requestAccounts' });
  const accounts = Array.isArray(accountsRaw) ? accountsRaw : [];
  const address = accounts.find((v) => typeof v === 'string' && v.startsWith('0x'));
  if (typeof address !== 'string') {
    throw new Error(`Failed to read ${WALLET_PROVIDER_LABEL[key]} account address.`);
  }
  return address;
}

export async function signInjectedEvmMessage(
  key: WalletProviderKey,
  message: string,
  address: string
): Promise<string> {
  const provider = resolveInjectedEvmProvider(key);
  if (!provider) {
    throw new Error(`${WALLET_PROVIDER_LABEL[key]} provider is unavailable for signing.`);
  }

  const signatureRaw = await provider.request({
    method: 'personal_sign',
    params: [message, address],
  });

  if (typeof signatureRaw !== 'string' || !signatureRaw.startsWith('0x')) {
    throw new Error(`${WALLET_PROVIDER_LABEL[key]} returned an invalid signature.`);
  }
  return signatureRaw;
}

function getPhantomSolanaProvider(): PhantomSolanaProvider | null {
  const w = getWalletWindow();
  const provider = w?.phantom?.solana;
  if (!provider) return null;
  if (typeof provider.connect !== 'function' || typeof provider.signMessage !== 'function') return null;
  if (provider.isPhantom !== true) return null;
  return provider;
}

export async function requestPhantomSolanaAccount(): Promise<string> {
  const provider = getPhantomSolanaProvider();
  if (!provider) {
    throw new Error('Phantom (Solana) provider not detected. Install/enable Phantom extension.');
  }

  const connected = await provider.connect();
  const address = connected?.publicKey?.toString();
  if (!address) {
    throw new Error('Failed to read Phantom Solana address.');
  }
  return address;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signPhantomSolanaUtf8Message(message: string): Promise<string> {
  const provider = getPhantomSolanaProvider();
  if (!provider) {
    throw new Error('Phantom (Solana) provider is unavailable for signing.');
  }

  const encoded = new TextEncoder().encode(message);
  const signed = await provider.signMessage(encoded, 'utf8');
  if (!signed?.signature || signed.signature.length === 0) {
    throw new Error('Phantom returned an empty signature.');
  }

  return `0x${bytesToHex(signed.signature)}`;
}
