import type { AuthUser } from '$lib/contracts/auth';
import { hasWalletAuthProof } from '$lib/contracts/auth';
import {
  getWalletFunnelErrorReason,
  parseWalletSignupForm,
} from '$lib/auth/walletModalFlow';
import {
  connectWalletProvider,
  isWalletProviderKey,
  logoutWalletSession,
  resolveWalletAuth,
  signWalletOwnership,
  submitWalletSignup,
} from '$lib/auth/walletModalTransport';
import { WALLET_PROVIDER_LABEL } from '$lib/wallet/providers';
import type { WalletProviderKey } from '$lib/wallet/providers';
import type { AuthSessionState } from '$lib/stores/authSessionStore';
import type { WalletModalStep } from '$lib/stores/walletModalStore';
import type { WalletState } from '$lib/stores/walletStore';

type WalletFunnelStep = 'modal_open' | 'connect' | 'sign' | 'resolve' | 'auth' | 'disconnect';
type WalletFunnelStatus = 'view' | 'success' | 'error';

interface GTMWindow extends Window {
  dataLayer?: Array<Record<string, unknown>>;
}

interface WalletProof {
  walletMessage: string;
  walletSignature: string;
}

interface CreateWalletModalRuntimeOptions {
  getWalletState: () => WalletState;
  getAuthSession: () => AuthSessionState;
  getSignupInput: () => { emailInput: string; nicknameInput: string };
  getWalletProof: () => WalletProof | null;
  setWalletProof: (proof: WalletProof | null) => void;
  clearErrors: () => void;
  setEmailError: (message: string) => void;
  setActionError: (message: string) => void;
  setConnectingProvider: (provider: string) => void;
  setSigningMessage: (value: boolean) => void;
  setResolvingWallet: (value: boolean) => void;
  setAuthSubmitting: (value: boolean) => void;
  setModalStep: (step: WalletModalStep) => void;
  closeModal: () => void;
  applyAuthenticatedUser: (user: AuthUser) => void;
  clearAuthenticatedUser: () => void;
  connectWallet: (provider: string, address: string, chain: string) => void;
  disconnectWallet: () => void;
  markWalletSignatureComplete: () => void;
  trackWalletFunnel: (
    step: WalletFunnelStep,
    status: WalletFunnelStatus,
    payload?: Record<string, unknown>
  ) => void;
}

const STEP_TITLE: Record<string, string> = {
  'wallet-select': 'CONNECT WALLET',
  connecting: 'CONNECTING',
  'sign-message': 'VERIFY OWNERSHIP',
  resolving: 'CHECKING WALLET',
  signup: 'CREATE ACCOUNT',
  profile: 'MY PROFILE',
  welcome: 'WALLET ACCESS',
  connected: 'WALLET READY',
  login: 'LOG IN',
  'demo-intro': 'DEMO',
};

export function createWalletModalGtmTracker() {
  return function trackWalletFunnel(
    stepName: WalletFunnelStep,
    status: WalletFunnelStatus,
    payload: Record<string, unknown> = {}
  ) {
    if (typeof window === 'undefined') return;
    const w = window as GTMWindow;
    if (!Array.isArray(w.dataLayer)) return;
    w.dataLayer.push({
      event: 'wallet_funnel',
      area: 'wallet_modal',
      step: stepName,
      status,
      ...payload,
    });
  };
}

export function getWalletModalHeaderTitle(step: WalletModalStep): string {
  return STEP_TITLE[step] ?? 'WALLET ACCESS';
}

export function getWalletModalConnectStepState(
  walletConnected: boolean,
  step: WalletModalStep,
): 'active' | 'done' | 'idle' {
  if (walletConnected) return 'done';
  if (step === 'wallet-select' || step === 'connecting') return 'active';
  return 'idle';
}

export function getWalletModalVerifyStepState(
  walletProof: WalletProof | null,
  walletConnected: boolean,
  step: WalletModalStep,
): 'active' | 'done' | 'idle' {
  if (walletProof && hasWalletAuthProof(walletProof.walletMessage, walletProof.walletSignature)) {
    return 'done';
  }
  if (step === 'sign-message' || step === 'resolving') return 'active';
  if (!walletConnected) return 'idle';
  return 'idle';
}

export function getWalletModalDoneStepState(
  authenticated: boolean,
  step: WalletModalStep,
): 'active' | 'done' | 'idle' {
  if (authenticated) return 'done';
  if (step === 'signup' || step === 'profile') return 'active';
  return 'idle';
}

export function resolveLegacyWalletModalStep(
  step: WalletModalStep,
  walletConnected: boolean,
): WalletModalStep | null {
  if (step === 'welcome' || step === 'demo-intro') return 'wallet-select';
  if (step === 'connected') return walletConnected ? 'sign-message' : 'wallet-select';
  if (step === 'login') return 'signup';
  return null;
}

export function createWalletModalRuntime(options: CreateWalletModalRuntimeOptions) {
  function walletProofFallbackStep(wallet: WalletState): WalletModalStep {
    return wallet.connected ? 'sign-message' : 'wallet-select';
  }

  async function handleSignupSubmit() {
    options.clearErrors();
    const parsed = parseWalletSignupForm(options.getSignupInput());
    if (!parsed.ok) {
      options.setEmailError(parsed.error);
      return;
    }

    const walletState = options.getWalletState();
    const walletProof = options.getWalletProof();
    if (!walletProof || !walletState.address) {
      options.setActionError('Sign wallet message first.');
      options.setModalStep(walletProofFallbackStep(walletState));
      return;
    }

    options.setAuthSubmitting(true);
    try {
      const res = await submitWalletSignup({
        ...parsed.value,
        walletAddress: walletState.address,
        walletMessage: walletProof.walletMessage,
        walletSignature: walletProof.walletSignature,
      });
      options.applyAuthenticatedUser(res.user);
      options.trackWalletFunnel('auth', 'success', {
        auth_mode: 'signup',
        chain: walletState.chain,
      });
      options.closeModal();
    } catch (error) {
      options.setEmailError(error instanceof Error ? error.message : 'Failed to create account');
      options.trackWalletFunnel('auth', 'error', {
        auth_mode: 'signup',
        reason: getWalletFunnelErrorReason(error),
      });
    } finally {
      options.setAuthSubmitting(false);
    }
  }

  async function handleConnect(provider: string) {
    options.clearErrors();
    options.setWalletProof(null);

    if (!isWalletProviderKey(provider)) {
      options.setActionError('Unsupported wallet provider.');
      return;
    }

    options.setConnectingProvider(WALLET_PROVIDER_LABEL[provider]);
    options.setModalStep('connecting');

    try {
      const connectedWallet = await connectWalletProvider(provider);
      options.connectWallet(provider, connectedWallet.address, connectedWallet.chain);
      options.setModalStep('sign-message');
      options.trackWalletFunnel('connect', 'success', {
        provider,
        chain: connectedWallet.chain,
      });
    } catch (error) {
      options.setActionError(error instanceof Error ? error.message : 'Failed to connect wallet');
      options.trackWalletFunnel('connect', 'error', {
        provider,
        reason: getWalletFunnelErrorReason(error),
      });
      options.setModalStep('wallet-select');
    } finally {
      options.setConnectingProvider('');
    }
  }

  async function handleSignMessage() {
    options.setSigningMessage(true);
    options.setActionError('');

    try {
      const walletState = options.getWalletState();
      const authSession = options.getAuthSession();
      if (!walletState.address) {
        throw new Error('Wallet address is missing');
      }

      if (!walletState.provider || !isWalletProviderKey(walletState.provider)) {
        throw new Error('Wallet provider is missing');
      }

      const provider = walletState.provider as WalletProviderKey;
      const proof = await signWalletOwnership({
        address: walletState.address,
        provider,
        chain: walletState.chain,
        verifyLinkedSession: authSession.authenticated,
      });

      options.setWalletProof({
        walletMessage: proof.message,
        walletSignature: proof.signature,
      });
      options.markWalletSignatureComplete();
      options.trackWalletFunnel('sign', 'success', {
        provider,
        chain: walletState.chain,
      });

      if (authSession.authenticated) {
        options.setModalStep('profile');
      } else {
        await handleResolveWallet();
      }
    } catch (error) {
      options.setWalletProof(null);
      options.setActionError(error instanceof Error ? error.message : 'Failed to sign wallet message');
      options.trackWalletFunnel('sign', 'error', {
        reason: getWalletFunnelErrorReason(error),
      });
    } finally {
      options.setSigningMessage(false);
    }
  }

  async function handleResolveWallet() {
    const walletState = options.getWalletState();
    const walletProof = options.getWalletProof();
    if (!walletState.address || !walletProof) {
      options.setActionError('Missing wallet proof for resolution.');
      options.setModalStep(walletProofFallbackStep(walletState));
      return;
    }

    options.setResolvingWallet(true);
    options.setModalStep('resolving');

    try {
      const result = await resolveWalletAuth({
        walletAddress: walletState.address,
        walletMessage: walletProof.walletMessage,
        walletSignature: walletProof.walletSignature,
      });

      if (result.action === 'logged_in') {
        options.applyAuthenticatedUser(result.user);
        options.trackWalletFunnel('resolve', 'success', { outcome: 'logged_in' });
        options.closeModal();
      } else {
        options.trackWalletFunnel('resolve', 'success', { outcome: 'needs_signup' });
        options.setModalStep('signup');
      }
    } catch (error) {
      options.setActionError(error instanceof Error ? error.message : 'Failed to check wallet');
      options.trackWalletFunnel('resolve', 'error', {
        reason: getWalletFunnelErrorReason(error),
      });
      options.setModalStep(walletProofFallbackStep(walletState));
    } finally {
      options.setResolvingWallet(false);
    }
  }

  async function handleDisconnect() {
    const authSession = options.getAuthSession();
    await logoutWalletSession();
    options.setWalletProof(null);
    options.disconnectWallet();
    options.clearAuthenticatedUser();
    options.trackWalletFunnel('disconnect', 'success', {
      had_session: authSession.authenticated,
    });
    options.closeModal();
  }

  return {
    handleConnect,
    handleDisconnect,
    handleResolveWallet,
    handleSignMessage,
    handleSignupSubmit,
  };
}
