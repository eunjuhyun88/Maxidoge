import {
  PUBLIC_EVM_CHAIN_ID,
  PUBLIC_EVM_RPC_URL,
  PUBLIC_WALLETCONNECT_PROJECT_ID,
} from '$env/static/public';

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
  disconnect?: () => Promise<void>;
}

interface WalletWindow extends Window {
  ethereum?: Eip1193Provider;
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

let _walletConnectProvider: Eip1193Provider | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _walletConnectInitedProvider: any = null; // init'd but not connect'd
let _coinbaseProvider: Eip1193Provider | null = null;

// ═══ Phantom Browser SDK ═════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _phantomSdk: any = null;

async function getPhantomSdk() {
  if (_phantomSdk) return _phantomSdk;

  try {
    const { BrowserSDK, AddressType } = await import('@phantom/browser-sdk');
    _phantomSdk = new BrowserSDK({
      providers: ['injected'],
      addressTypes: [AddressType.solana, AddressType.ethereum],
    });
    return _phantomSdk;
  } catch {
    throw new Error('Phantom Browser SDK is not available.');
  }
}

// ═══ Popup Pre-open Helper ════════════════════════════════════
// Chrome blocks popups not opened in a synchronous user-gesture stack.
// Wallet SDKs call window.open() deep inside async chains, which
// Chrome considers "not user-initiated".  Fix: pre-open a blank
// popup **synchronously** from the click handler, then monkey-patch
// window.open so the SDK reuses it instead of opening a new one.

let _preOpenedPopup: Window | null = null;

// Lazily capture the real window.open (can't bind at module-load time
// because SvelteKit may load this module on the server where window
// is undefined).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _realWindowOpen: ((...args: any[]) => Window | null) | null = null;

function getRealWindowOpen() {
  if (!_realWindowOpen && typeof window !== 'undefined') {
    _realWindowOpen = window.open.bind(window);
  }
  return _realWindowOpen;
}

/**
 * Call this **synchronously** inside the wallet-button click handler,
 * BEFORE any awaits.  It opens a tiny blank popup (allowed because
 * we're still in the user-gesture call-stack) and patches
 * window.open so the next call reuses it.
 */
export function preOpenWalletPopup(): void {
  if (typeof window === 'undefined') return;
  const realOpen = getRealWindowOpen();
  if (!realOpen) return;

  // Don't stack multiple pre-opened popups
  if (_preOpenedPopup && !_preOpenedPopup.closed) return;

  _preOpenedPopup = realOpen(
    'about:blank',
    'wallet_popup',
    'width=460,height=730,left=200,top=100'
  );

  if (!_preOpenedPopup) return; // popup was blocked anyway

  // Patch window.open so the SDK reuses our pre-opened popup
  window.open = function (
    url?: string | URL,
    target?: string,
    features?: string,
  ): Window | null {
    const popup = _preOpenedPopup;
    if (popup && !popup.closed) {
      _preOpenedPopup = null;          // consumed
      window.open = getRealWindowOpen()!; // restore immediately
      try {
        if (url && url !== 'about:blank') {
          popup.location.href = typeof url === 'string' ? url : url.toString();
        }
      } catch {
        // cross-origin; SDK will handle it
      }
      return popup;
    }
    // Fallback: no pre-opened popup available → use real open
    const ro = getRealWindowOpen()!;
    window.open = ro;
    return ro(url, target, features);
  } as typeof window.open;
}

/**
 * Close the pre-opened popup (e.g. on error or if connection
 * succeeded without needing a popup).
 */
export function closePreOpenedPopup(): void {
  if (_preOpenedPopup && !_preOpenedPopup.closed) {
    _preOpenedPopup.close();
  }
  _preOpenedPopup = null;
  // Restore window.open in case it was patched but never consumed
  const realOpen = getRealWindowOpen();
  if (typeof window !== 'undefined' && realOpen) {
    window.open = realOpen;
  }
}

// ═══ SDK Preloading ══════════════════════════════════════════
// Eagerly import + init SDKs when modal opens so bundles are cached.

let _preloadPromise: Promise<void> | null = null;

/**
 * Call this EARLY (e.g. when wallet modal opens) so SDK bundles are
 * already loaded by the time the user clicks a wallet button.
 */
export function preloadWalletSdks(): void {
  if (_preloadPromise) return;
  _preloadPromise = _preloadAll();
}

async function _preloadAll(): Promise<void> {
  // Fire all imports in parallel — failures are silently swallowed
  await Promise.allSettled([
    _preloadCoinbase(),
    _preloadWalletConnect(),
    getPhantomSdk().catch(() => {}),
  ]);
}

async function _preloadCoinbase(): Promise<void> {
  if (_coinbaseProvider) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('@coinbase/wallet-sdk');
    const chainId = getPreferredChainId();
    const CoinbaseWalletSDK = mod?.default ?? mod?.CoinbaseWalletSDK;
    if (typeof CoinbaseWalletSDK === 'function') {
      const sdk = new CoinbaseWalletSDK({ appName: 'Stockclaw', appChainIds: [chainId] });
      const p = typeof sdk?.makeWeb3Provider === 'function'
        ? sdk.makeWeb3Provider({ options: 'all' })
        : typeof sdk?.getProvider === 'function' ? sdk.getProvider() : null;
      if (p && typeof (p as Record<string, unknown>).request === 'function') {
        _coinbaseProvider = p as Eip1193Provider;
      }
    } else if (typeof mod?.createCoinbaseWalletSDK === 'function') {
      const sdk = mod.createCoinbaseWalletSDK({ appName: 'Stockclaw', appChainIds: [chainId] });
      const p = typeof sdk?.makeWeb3Provider === 'function'
        ? sdk.makeWeb3Provider({ options: 'all' })
        : typeof sdk?.getProvider === 'function' ? sdk.getProvider() : null;
      if (p && typeof (p as Record<string, unknown>).request === 'function') {
        _coinbaseProvider = p as Eip1193Provider;
      }
    }
  } catch { /* swallow — getCoinbaseProvider() will retry */ }
}

async function _preloadWalletConnect(): Promise<void> {
  if (_walletConnectProvider || _walletConnectInitedProvider) return;
  if (!isWalletConnectConfigured()) return;
  try {
    const mod = await import('@walletconnect/ethereum-provider');
    const EthereumProvider = mod?.default ?? mod?.EthereumProvider ?? mod;
    if (!EthereumProvider || typeof EthereumProvider.init !== 'function') return;
    const projectId = getWalletConnectProjectId();
    const chainId = getPreferredChainId();
    const rpcUrl = getPreferredRpcUrl(chainId);
    _walletConnectInitedProvider = await EthereumProvider.init({
      projectId,
      showQrModal: true,
      chains: [chainId],
      optionalChains: [1, 10, 56, 137, 42161],
      methods: ['eth_requestAccounts', 'personal_sign', 'eth_sendTransaction'],
      rpcMap: { [chainId]: rpcUrl },
    });
  } catch { /* swallow */ }
}

// ═══ Config helpers ══════════════════════════════════════════

function isPlaceholderWalletConnectProjectId(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === ''
    || normalized === 'your_walletconnect_project_id'
    || normalized === 'walletconnect_project_id'
    || normalized === 'changeme';
}

export function isWalletConnectConfigured(): boolean {
  const projectId = PUBLIC_WALLETCONNECT_PROJECT_ID
    || import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
    || '';
  return !isPlaceholderWalletConnectProjectId(projectId);
}

function getWalletConnectProjectId(): string {
  const projectId = PUBLIC_WALLETCONNECT_PROJECT_ID
    || import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
    || '';
  if (isPlaceholderWalletConnectProjectId(projectId)) {
    throw new Error('WalletConnect project id is missing. Set PUBLIC_WALLETCONNECT_PROJECT_ID.');
  }
  return projectId;
}

function getPreferredChainId(): number {
  const raw = PUBLIC_EVM_CHAIN_ID
    || import.meta.env.VITE_EVM_CHAIN_ID
    || '';
  const value = raw ? Number(raw) : 8453;
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 8453;
}

function getPreferredRpcUrl(chainId: number): string {
  const envUrl = PUBLIC_EVM_RPC_URL
    || import.meta.env.VITE_EVM_RPC_URL
    || '';
  if (envUrl) return envUrl;

  if (chainId === 8453) return 'https://base-mainnet.g.alchemy.com/v2/F-WLNSBCJJ5xTefhTssUx';
  if (chainId === 42161) return 'https://arb1.arbitrum.io/rpc';
  if (chainId === 137) return 'https://polygon-rpc.com';
  return 'https://cloudflare-eth.com';
}

function mapChainIdToCode(chainId: number): string {
  if (chainId === 1) return 'ETH';
  if (chainId === 10) return 'OP';
  if (chainId === 56) return 'BSC';
  if (chainId === 137) return 'POL';
  if (chainId === 8453) return 'BASE';
  if (chainId === 42161) return 'ARB';
  return 'EVM';
}

export function getPreferredEvmChainCode(): string {
  return mapChainIdToCode(getPreferredChainId());
}

// ═══ WalletConnect ═══════════════════════════════════════════

async function getWalletConnectProvider(): Promise<Eip1193Provider> {
  if (_walletConnectProvider) return _walletConnectProvider;

  // Use preloaded init'd provider if available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let provider: any = _walletConnectInitedProvider;

  if (!provider) {
    // Fallback: init now (rare — preload should have done this)
    const mod = await import('@walletconnect/ethereum-provider');
    const EthereumProvider = mod?.default ?? mod?.EthereumProvider ?? mod;
    if (!EthereumProvider || typeof EthereumProvider.init !== 'function') {
      throw new Error('WalletConnect SDK initialization failed.');
    }
    const projectId = getWalletConnectProjectId();
    const chainId = getPreferredChainId();
    const rpcUrl = getPreferredRpcUrl(chainId);
    provider = await EthereumProvider.init({
      projectId, showQrModal: true, chains: [chainId],
      optionalChains: [1, 10, 56, 137, 42161],
      methods: ['eth_requestAccounts', 'personal_sign', 'eth_sendTransaction'],
      rpcMap: { [chainId]: rpcUrl },
    });
  }

  // connect() shows QR modal — MUST run in user-gesture call stack
  if (!provider.session) {
    await provider.connect();
  }

  _walletConnectProvider = provider as Eip1193Provider;
  _walletConnectInitedProvider = null; // consumed
  return _walletConnectProvider;
}

// ═══ Coinbase Wallet ═════════════════════════════════════════

async function getCoinbaseProvider(): Promise<Eip1193Provider> {
  // If preloaded, return immediately (keeps us in user-gesture stack)
  if (_coinbaseProvider) return _coinbaseProvider;

  // Fallback: init now (rare — preload should have done this)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('@coinbase/wallet-sdk');
  const chainId = getPreferredChainId();
  let provider: unknown;
  const CoinbaseWalletSDK = mod?.default ?? mod?.CoinbaseWalletSDK;

  if (typeof CoinbaseWalletSDK === 'function') {
    const sdk = new CoinbaseWalletSDK({ appName: 'Stockclaw', appChainIds: [chainId] });
    provider = typeof sdk?.makeWeb3Provider === 'function'
      ? sdk.makeWeb3Provider({ options: 'all' })
      : typeof sdk?.getProvider === 'function' ? sdk.getProvider() : null;
  } else if (typeof mod?.createCoinbaseWalletSDK === 'function') {
    const sdk = mod.createCoinbaseWalletSDK({ appName: 'Stockclaw', appChainIds: [chainId] });
    provider = typeof sdk?.makeWeb3Provider === 'function'
      ? sdk.makeWeb3Provider({ options: 'all' })
      : typeof sdk?.getProvider === 'function' ? sdk.getProvider() : null;
  } else {
    throw new Error('Coinbase Wallet SDK initialization failed.');
  }

  if (!provider || typeof (provider as Record<string, unknown>).request !== 'function') {
    throw new Error('Coinbase Wallet provider could not be created.');
  }

  _coinbaseProvider = provider as Eip1193Provider;
  return _coinbaseProvider;
}

// ═══ EVM Provider Resolution ═════════════════════════════════

/** Exposed for EIP-712 signing and chain switching modules */
export async function resolveEvmProvider(key: WalletProviderKey): Promise<Eip1193Provider | null> {
  if (key === 'walletconnect') {
    return getWalletConnectProvider();
  }

  if (key === 'coinbase') {
    try {
      return await getCoinbaseProvider();
    } catch (error) {
      const injected = resolveInjectedEvmProvider(key);
      if (injected) return injected;

      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Coinbase Wallet provider could not be initialized.');
    }
  }

  // For phantom EVM, try Phantom SDK's ethereum interface first
  if (key === 'phantom') {
    try {
      const sdk = await getPhantomSdk();
      if (sdk?.ethereum && typeof sdk.ethereum.request === 'function') {
        return sdk.ethereum as unknown as Eip1193Provider;
      }
    } catch {
      // fall through to injected
    }
  }

  return resolveInjectedEvmProvider(key);
}

export function hasInjectedEvmProvider(key: WalletProviderKey): boolean {
  if (key === 'walletconnect') return isWalletConnectConfigured();
  if (key === 'coinbase') return true;
  if (key === 'phantom') return true; // SDK handles extension detection
  return resolveInjectedEvmProvider(key) !== null;
}

export async function requestInjectedEvmAccount(key: WalletProviderKey): Promise<string> {
  const provider = await resolveEvmProvider(key);
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
  const provider = await resolveEvmProvider(key);
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

// ═══ Phantom SDK — Solana + EVM ══════════════════════════════

/**
 * Connect via Phantom Browser SDK.
 * Returns { addresses, chain } where addresses contain Solana and/or EVM addresses.
 */
export async function requestPhantomAccount(): Promise<{
  solanaAddress: string | null;
  evmAddress: string | null;
}> {
  const sdk = await getPhantomSdk();

  const result = await sdk.connect({ provider: 'injected' });
  const addresses: Array<{ address: string; type: string }> = result?.addresses ?? [];

  let solanaAddress: string | null = null;
  let evmAddress: string | null = null;

  for (const addr of addresses) {
    if (addr.type === 'solana' && !solanaAddress) {
      solanaAddress = addr.address;
    }
    if (addr.type === 'ethereum' && !evmAddress) {
      evmAddress = addr.address;
    }
  }

  if (!solanaAddress && !evmAddress) {
    throw new Error('Failed to read any Phantom address. Is the extension installed?');
  }

  return { solanaAddress, evmAddress };
}

/**
 * Sign a UTF-8 message via Phantom Solana.
 */
export async function signPhantomSolanaMessage(message: string): Promise<string> {
  const sdk = await getPhantomSdk();
  const signature = await sdk.solana.signMessage(message);

  if (!signature) {
    throw new Error('Phantom returned an empty Solana signature.');
  }

  // signature from SDK is already a base58 or hex string depending on version
  if (typeof signature === 'string') {
    return signature.startsWith('0x') ? signature : `0x${signature}`;
  }

  // If Uint8Array
  if (signature instanceof Uint8Array) {
    return `0x${Array.from(signature, (b: number) => b.toString(16).padStart(2, '0')).join('')}`;
  }

  // If object with signature property
  if (signature?.signature instanceof Uint8Array) {
    return `0x${Array.from(signature.signature, (b: number) => b.toString(16).padStart(2, '0')).join('')}`;
  }

  throw new Error('Phantom returned an unexpected signature format.');
}

/**
 * Sign a message via Phantom EVM (personal_sign).
 */
export async function signPhantomEvmMessage(message: string, address: string): Promise<string> {
  const sdk = await getPhantomSdk();
  const encoded = '0x' + Array.from(new TextEncoder().encode(message), (b) => b.toString(16).padStart(2, '0')).join('');
  const signature = await sdk.ethereum.signPersonalMessage(encoded, address);

  if (typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new Error('Phantom returned an invalid EVM signature.');
  }
  return signature;
}

// ═══ Legacy Phantom Solana (fallback) ════════════════════════

interface PhantomSolanaProvider {
  isPhantom?: boolean;
  connect: (args?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString: () => string } }>;
  signMessage: (message: Uint8Array, display?: 'utf8' | 'hex') => Promise<{ signature: Uint8Array }>;
  publicKey?: { toString: () => string };
}

interface PhantomWindow extends Window {
  solana?: PhantomSolanaProvider;
  phantom?: { solana?: PhantomSolanaProvider };
}

function getPhantomSolanaProvider(): PhantomSolanaProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as PhantomWindow;
  const provider = w?.solana || w?.phantom?.solana;
  if (!provider) return null;
  if (typeof provider.connect !== 'function' || typeof provider.signMessage !== 'function') return null;
  if (provider.isPhantom !== true) return null;
  return provider;
}

export async function requestPhantomSolanaAccount(): Promise<string> {
  // Try SDK first
  try {
    const { solanaAddress } = await requestPhantomAccount();
    if (solanaAddress) return solanaAddress;
  } catch {
    // fall through to legacy
  }

  // Legacy fallback via window.solana
  const provider = getPhantomSolanaProvider();
  if (!provider) {
    throw new Error('Phantom wallet not detected. Install Phantom extension or use another wallet.');
  }

  const connected = await provider.connect();
  const address = connected?.publicKey?.toString() || provider.publicKey?.toString();
  if (!address) {
    throw new Error('Failed to read Phantom Solana address.');
  }
  return address;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signPhantomSolanaUtf8Message(message: string): Promise<string> {
  // Try SDK first
  try {
    return await signPhantomSolanaMessage(message);
  } catch {
    // fall through to legacy
  }

  // Legacy fallback
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
