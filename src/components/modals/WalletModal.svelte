<script lang="ts">
  import {
    walletStore,
    connectWallet,
    disconnectWallet
  } from '$lib/stores/walletStore';
  import { applyAuthenticatedUser, authSessionIdentity, authSessionStore, clearAuthenticatedUser } from '$lib/stores/authSessionStore';
  import { markWalletSignatureComplete, userLifecycleStore } from '$lib/stores/userLifecycleStore';
  import {
    walletModalStore,
    closeWalletModal,
    setWalletModalStep,
    type WalletModalStep,
  } from '$lib/stores/walletModalStore';
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
  import {
    WALLET_PROVIDER_LABEL,
    isWalletConnectConfigured,
    type WalletProviderKey
  } from '$lib/wallet/providers';

  type WalletFunnelStep = 'modal_open' | 'connect' | 'sign' | 'resolve' | 'auth' | 'disconnect';
  type WalletFunnelStatus = 'view' | 'success' | 'error';

  const STEP_TITLE: Record<string, string> = {
    'wallet-select': 'CONNECT WALLET',
    connecting: 'CONNECTING',
    'sign-message': 'VERIFY OWNERSHIP',
    resolving: 'CHECKING WALLET',
    signup: 'CREATE ACCOUNT',
    profile: 'MY PROFILE',
    // Legacy fallbacks
    welcome: 'WALLET ACCESS',
    connected: 'WALLET READY',
    login: 'LOG IN',
    'demo-intro': 'DEMO',
  };

  const walletConnectReady = isWalletConnectConfigured();
  const walletState = $derived($walletStore);
  const modalState = $derived($walletModalStore);
  const authSession = $derived($authSessionStore);
  const authIdentity = $derived($authSessionIdentity);
  const lifecycle = $derived($userLifecycleStore);
  const step = $derived(modalState.step);

  let emailInput = $state('');
  let nicknameInput = $state('');
  let emailError = $state('');
  let actionError = $state('');
  let connectingProvider = $state('');
  let signingMessage = $state(false);
  let resolvingWallet = $state(false);
  let authSubmitting = $state(false);
  let signedWalletMessage = $state('');
  let signedWalletSignature = $state('');
  let trackedModalOpen = $state(false);

  const headerTitle = $derived(STEP_TITLE[step] ?? 'WALLET ACCESS');

  interface GTMWindow extends Window {
    dataLayer?: Array<Record<string, unknown>>;
  }

  function gtmEvent(event: string, payload: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;
    const w = window as GTMWindow;
    if (!Array.isArray(w.dataLayer)) return;
    w.dataLayer.push({
      event,
      area: 'wallet_modal',
      ...payload,
    });
  }

  function trackWalletFunnel(
    stepName: WalletFunnelStep,
    status: WalletFunnelStatus,
    payload: Record<string, unknown> = {}
  ) {
    gtmEvent('wallet_funnel', {
      step: stepName,
      status,
      ...payload,
    });
  }

  function clearErrors() {
    emailError = '';
    actionError = '';
  }

  function clearWalletProof() {
    signedWalletMessage = '';
    signedWalletSignature = '';
  }

  function hasWalletProof(): boolean {
    return hasWalletAuthProof(signedWalletMessage, signedWalletSignature);
  }

  function getSignedWalletProof(): { walletMessage: string; walletSignature: string } | null {
    if (!hasWalletProof()) return null;
    return {
      walletMessage: signedWalletMessage,
      walletSignature: signedWalletSignature,
    };
  }

  async function handleSignupSubmit() {
    clearErrors();
    const parsed = parseWalletSignupForm({
      emailInput,
      nicknameInput,
    });
    if (!parsed.ok) {
      emailError = parsed.error;
      return;
    }

    const walletProof = getSignedWalletProof();
    if (!walletProof || !walletState.address) {
      actionError = 'Sign wallet message first.';
      setWalletModalStep(walletState.connected ? 'sign-message' : 'wallet-select');
      return;
    }

    authSubmitting = true;
    try {
      const res = await submitWalletSignup({
        ...parsed.value,
        walletAddress: walletState.address,
        walletMessage: walletProof.walletMessage,
        walletSignature: walletProof.walletSignature,
      });
      applyAuthenticatedUser(res.user);
      trackWalletFunnel('auth', 'success', {
        auth_mode: 'signup',
        chain: walletState.chain,
      });
      closeWalletModal();
    } catch (error) {
      emailError = error instanceof Error ? error.message : 'Failed to create account';
      trackWalletFunnel('auth', 'error', {
        auth_mode: 'signup',
        reason: getWalletFunnelErrorReason(error),
      });
    } finally {
      authSubmitting = false;
    }
  }

  async function handleConnect(provider: string) {
    clearErrors();
    clearWalletProof();

    if (!isWalletProviderKey(provider)) {
      actionError = 'Unsupported wallet provider.';
      return;
    }

    connectingProvider = WALLET_PROVIDER_LABEL[provider];
    setWalletModalStep('connecting');

    try {
      const connectedWallet = await connectWalletProvider(provider);
      connectWallet(provider, connectedWallet.address, connectedWallet.chain);
      setWalletModalStep('sign-message');
      trackWalletFunnel('connect', 'success', {
        provider,
        chain: connectedWallet.chain,
      });
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Failed to connect wallet';
      trackWalletFunnel('connect', 'error', {
        provider,
        reason: getWalletFunnelErrorReason(error),
      });
      setWalletModalStep('wallet-select');
    } finally {
      connectingProvider = '';
    }
  }

  async function handleSignMessage() {
    signingMessage = true;
    actionError = '';

    try {
      if (!walletState.address) {
        throw new Error('Wallet address is missing');
      }

      if (!walletState.provider || !isWalletProviderKey(walletState.provider)) {
        throw new Error('Wallet provider is missing');
      }

      const provider = walletState.provider;
      const proof = await signWalletOwnership({
        address: walletState.address,
        provider,
        chain: walletState.chain,
        verifyLinkedSession: authSession.authenticated,
      });

      signedWalletMessage = proof.message;
      signedWalletSignature = proof.signature;
      markWalletSignatureComplete();

      trackWalletFunnel('sign', 'success', { provider, chain: walletState.chain });

      if (authSession.authenticated) {
        setWalletModalStep('profile');
      } else {
        // Wallet-first flow: auto-resolve after signature
        await handleResolveWallet();
      }
    } catch (error) {
      clearWalletProof();
      actionError = error instanceof Error ? error.message : 'Failed to sign wallet message';
      trackWalletFunnel('sign', 'error', { reason: getWalletFunnelErrorReason(error) });
    } finally {
      signingMessage = false;
    }
  }

  async function handleResolveWallet() {
    if (!walletState.address || !signedWalletMessage || !signedWalletSignature) {
      actionError = 'Missing wallet proof for resolution.';
      setWalletModalStep(walletState.connected ? 'sign-message' : 'wallet-select');
      return;
    }

    resolvingWallet = true;
    setWalletModalStep('resolving');

    try {
      const result = await resolveWalletAuth({
        walletAddress: walletState.address,
        walletMessage: signedWalletMessage,
        walletSignature: signedWalletSignature,
      });

      if (result.action === 'logged_in') {
        applyAuthenticatedUser(result.user);
        trackWalletFunnel('resolve', 'success', { outcome: 'logged_in' });
        closeWalletModal();
      } else {
        // New wallet — show signup form
        trackWalletFunnel('resolve', 'success', { outcome: 'needs_signup' });
        setWalletModalStep('signup');
      }
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Failed to check wallet';
      trackWalletFunnel('resolve', 'error', { reason: getWalletFunnelErrorReason(error) });
      setWalletModalStep(walletState.connected ? 'sign-message' : 'wallet-select');
    } finally {
      resolvingWallet = false;
    }
  }

  async function handleDisconnect() {
    await logoutWalletSession();
    clearWalletProof();
    disconnectWallet();
    clearAuthenticatedUser();
    trackWalletFunnel('disconnect', 'success', {
      had_session: authSession.authenticated,
    });
    closeWalletModal();
  }

  function handleClose() {
    closeWalletModal();
  }

  function connectStepState(): 'active' | 'done' | 'idle' {
    if (walletState.connected) return 'done';
    if (step === 'wallet-select' || step === 'connecting') return 'active';
    return 'idle';
  }

  function verifyStepState(): 'active' | 'done' | 'idle' {
    if (hasWalletProof()) return 'done';
    if (step === 'sign-message' || step === 'resolving') return 'active';
    if (!walletState.connected) return 'idle';
    return 'idle';
  }

  function doneStepState(): 'active' | 'done' | 'idle' {
    if (authSession.authenticated) return 'done';
    if (step === 'signup' || step === 'profile') return 'active';
    return 'idle';
  }

  // Redirect legacy steps to new flow
  $effect(() => {
    if (!modalState.open) return;
    if (step === 'welcome' || step === 'demo-intro') {
      setWalletModalStep('wallet-select');
    } else if (step === 'connected') {
      setWalletModalStep(walletState.connected ? 'sign-message' : 'wallet-select');
    } else if (step === 'login') {
      setWalletModalStep('signup');
    }
  });

  $effect(() => {
    if (modalState.open && !trackedModalOpen) {
      trackWalletFunnel('modal_open', 'view', { entry_step: step });
      trackedModalOpen = true;
    }
  });

  $effect(() => {
    if (!modalState.open) {
      authSubmitting = false;
      signingMessage = false;
      resolvingWallet = false;
      connectingProvider = '';
      trackedModalOpen = false;
      clearErrors();
      clearWalletProof();
    }
  });
</script>

{#if modalState.open}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={handleClose}>
  <div class="wallet-panel" onclick={(e: MouseEvent) => e.stopPropagation()}>
    <div class="wh">
      <div class="wh-left">
        <span class="wh-tag">//WALLET AUTH</span>
        <span class="wht">{headerTitle}</span>
      </div>

      <button class="whc" type="button" aria-label="Close wallet modal" onclick={handleClose}>&#x2715;</button>
    </div>

    {#if actionError}
      <div class="global-error">{actionError}</div>
    {/if}

    <div class="progress-row" aria-hidden="true">
      <div class="pstep" class:active={connectStepState() === 'active'} class:done={connectStepState() === 'done'}>1 CONNECT</div>
      <div class="pstep" class:active={verifyStepState() === 'active'} class:done={verifyStepState() === 'done'}>2 VERIFY</div>
      <div class="pstep" class:active={doneStepState() === 'active'} class:done={doneStepState() === 'done'}>3 DONE</div>
    </div>

    {#if step === 'wallet-select'}
      <div class="wb">
        <div class="step-hero">
          <span class="hero-kicker">STEP 1</span>
          <h3 class="hero-title">Connect your wallet</h3>
          <p class="hero-sub">Select a wallet to verify ownership. If you already have an account, you'll be logged in automatically.</p>
        </div>

        <div class="wallet-list">
          <button class="wopt" type="button" onclick={() => handleConnect('metamask')}>
            <span class="wo-icon">&#x1F98A;</span>
            <span class="wo-name">MetaMask</span>
            <span class="wo-chain">EVM</span>
          </button>
          <button
            class="wopt"
            type="button"
            onclick={() => handleConnect('walletconnect')}
            disabled={!walletConnectReady}
            title={!walletConnectReady ? 'Set PUBLIC_WALLETCONNECT_PROJECT_ID in env first.' : undefined}
          >
            <span class="wo-icon">&#x1F535;</span>
            <span class="wo-name">WalletConnect</span>
            <span class="wo-chain">{walletConnectReady ? 'EVM' : 'SETUP REQUIRED'}</span>
          </button>
          <button class="wopt" type="button" onclick={() => handleConnect('coinbase')}>
            <span class="wo-icon">&#x1F537;</span>
            <span class="wo-name">Coinbase Wallet</span>
            <span class="wo-chain">EVM</span>
          </button>
          <button class="wopt" type="button" onclick={() => handleConnect('phantom')}>
            <span class="wo-icon">&#x1F47B;</span>
            <span class="wo-name">Phantom</span>
            <span class="wo-chain">SOL/EVM</span>
          </button>
        </div>
      </div>

    {:else if step === 'connecting'}
      <div class="wb">
        <div class="connecting-anim">
          <div class="conn-spinner"></div>
          <div class="conn-text">Connecting {connectingProvider || 'wallet'}...</div>
          <div class="conn-sub">Approve the connection request in wallet</div>
        </div>
      </div>

    {:else if step === 'sign-message'}
      <div class="wb">
        <div class="step-hero">
          <span class="hero-kicker">STEP 2</span>
          <h3 class="hero-title">Sign to verify ownership</h3>
          <p class="hero-sub">This signature is free and used only for account authentication.</p>
        </div>

        <div class="info-box">
          <div class="info-row">
            <span class="info-k">WALLET</span>
            <span class="info-v">{walletState.shortAddr || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-k">CHAIN</span>
            <span class="info-v">{walletState.chain}</span>
          </div>
        </div>

        <button class="btn-primary" type="button" onclick={handleSignMessage} disabled={signingMessage}>
          {#if signingMessage}SIGNING...{:else}SIGN MESSAGE{/if}
        </button>
        <button class="btn-ghost" type="button" onclick={() => setWalletModalStep('wallet-select')}>
          USE DIFFERENT WALLET
        </button>
      </div>

    {:else if step === 'resolving'}
      <div class="wb">
        <div class="connecting-anim">
          <div class="conn-spinner"></div>
          <div class="conn-text">Checking wallet...</div>
          <div class="conn-sub">Looking up your account</div>
        </div>
      </div>

    {:else if step === 'signup'}
      <div class="wb">
        <div class="step-hero">
          <span class="hero-kicker">STEP 3</span>
          <h3 class="hero-title">Create account</h3>
          <p class="hero-sub">New wallet detected. Complete registration below.</p>
        </div>

        <div class="info-box">
          <div class="info-row">
            <span class="info-k">WALLET</span>
            <span class="info-v">{walletState.shortAddr || '-'}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="signup-email">EMAIL</label>
          <input id="signup-email" class="form-input" type="email" bind:value={emailInput} placeholder="you@example.com" />
        </div>

        <div class="form-group">
          <label class="form-label" for="signup-nickname">NICKNAME</label>
          <input id="signup-nickname" class="form-input" type="text" bind:value={nicknameInput} maxlength="32" placeholder="TraderDoge" />
        </div>

        {#if emailError}
          <div class="form-error">{emailError}</div>
        {/if}

        <button class="btn-primary" type="button" onclick={handleSignupSubmit} disabled={authSubmitting}>
          {#if authSubmitting}CREATING...{:else}CREATE ACCOUNT{/if}
        </button>
        <button class="btn-ghost" type="button" onclick={() => setWalletModalStep('wallet-select')}>USE DIFFERENT WALLET</button>
      </div>

    {:else}
      <div class="wb">
        <div class="step-hero">
          <span class="hero-kicker">ACCOUNT</span>
          <h3 class="hero-title">{authIdentity.nickname || 'TRADER'}</h3>
          <p class="hero-sub">Core profile information only.</p>
        </div>

        <div class="info-box">
          <div class="info-row">
            <span class="info-k">EMAIL</span>
            <span class="info-v">{authIdentity.email || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-k">NICKNAME</span>
            <span class="info-v">{authIdentity.nickname || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-k">TIER</span>
            <span class="info-v">{(authIdentity.tier || (walletState.connected ? 'connected' : 'guest')).toUpperCase()}</span>
          </div>
          <div class="info-row">
            <span class="info-k">PHASE</span>
            <span class="info-v">P{authIdentity.phase ?? lifecycle.phase}</span>
          </div>
          <div class="info-row">
            <span class="info-k">WALLET</span>
            <span class="info-v">{walletState.connected ? walletState.shortAddr : 'NOT CONNECTED'}</span>
          </div>
        </div>

        {#if walletState.connected}
          <a class="btn-primary passport-link" href="/passport" onclick={handleClose}>VIEW PASSPORT</a>
          <button class="btn-ghost" type="button" onclick={handleDisconnect}>LOG OUT & DISCONNECT</button>
        {:else}
          <button class="btn-primary" type="button" onclick={() => setWalletModalStep('wallet-select')}>CONNECT WALLET</button>
          <a class="btn-ghost passport-link" href="/passport" onclick={handleClose}>OPEN PASSPORT</a>
        {/if}
      </div>
    {/if}
  </div>
</div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(2, 8, 5, 0.78);
    backdrop-filter: blur(8px);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px 12px;
  }

  .wallet-panel {
    --wm-bg: #08180d;
    --wm-bg-2: #0f2616;
    --wm-card: rgba(232, 150, 125, 0.08);
    --wm-border: rgba(232, 150, 125, 0.3);
    --wm-accent: #e8967d;
    --wm-text: #f0ede4;
    --wm-muted: rgba(240, 237, 228, 0.62);
    --wm-kicker: rgba(232, 150, 125, 0.82);
    width: min(440px, 100%);
    max-height: min(88vh, 780px);
    border: 1px solid var(--wm-border);
    border-radius: 14px;
    overflow: hidden;
    background: linear-gradient(180deg, var(--wm-bg-2), var(--wm-bg));
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45), 0 0 24px rgba(232, 150, 125, 0.14);
    display: flex;
    flex-direction: column;
  }

  .wh {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(232, 150, 125, 0.2);
    background: linear-gradient(180deg, rgba(232, 150, 125, 0.08), rgba(232, 150, 125, 0.02));
  }

  .wh-left {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .wh-tag {
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1.4px;
    color: var(--wm-kicker);
  }

  .wht {
    font-family: var(--fp);
    font-size: 10px;
    letter-spacing: 1.8px;
    color: var(--wm-text);
    text-shadow: 0 0 8px rgba(232, 150, 125, 0.2);
  }

  .whc {
    border: 1px solid rgba(232, 150, 125, 0.35);
    background: rgba(232, 150, 125, 0.05);
    color: var(--wm-text);
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    flex-shrink: 0;
  }

  .whc:hover {
    background: rgba(232, 150, 125, 0.16);
  }

  .global-error,
  .form-error {
    margin: 8px 12px 0;
    padding: 8px 10px;
    border: 1px solid rgba(255, 89, 89, 0.45);
    border-radius: 8px;
    background: rgba(255, 89, 89, 0.08);
    color: #ff9b9b;
    font-family: var(--fv);
    font-size: 14px;
    line-height: 1.35;
    letter-spacing: 0.2px;
  }

  .form-error {
    margin: 0 0 6px;
  }

  .progress-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(232, 150, 125, 0.14);
  }

  .pstep {
    border: 1px solid rgba(232, 150, 125, 0.18);
    border-radius: 999px;
    text-align: center;
    padding: 5px 8px;
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1px;
    color: rgba(240, 237, 228, 0.44);
  }

  .pstep.active {
    color: var(--wm-text);
    border-color: rgba(232, 150, 125, 0.44);
    background: rgba(232, 150, 125, 0.12);
  }

  .pstep.done {
    color: #89f4be;
    border-color: rgba(137, 244, 190, 0.45);
    background: rgba(137, 244, 190, 0.1);
  }

  .wb {
    padding: 14px;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .step-hero {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .hero-kicker {
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1.5px;
    color: var(--wm-kicker);
  }

  .hero-title {
    font-family: var(--fp);
    font-size: clamp(11px, 1.2vw, 13px);
    letter-spacing: 1.2px;
    color: var(--wm-text);
    line-height: 1.35;
  }

  .hero-sub {
    font-family: var(--fv);
    font-size: 16px;
    color: var(--wm-muted);
    letter-spacing: 0.3px;
    line-height: 1.32;
  }

  .info-box {
    border: 1px solid rgba(232, 150, 125, 0.2);
    border-radius: 10px;
    background: rgba(232, 150, 125, 0.05);
    padding: 10px;
  }

  .wallet-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .wopt {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: 1px solid rgba(232, 150, 125, 0.22);
    border-radius: 10px;
    background: rgba(232, 150, 125, 0.04);
    color: var(--wm-text);
    padding: 10px 12px;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.16s ease, background 0.16s ease;
  }

  .wopt:hover {
    border-color: rgba(232, 150, 125, 0.5);
    background: rgba(232, 150, 125, 0.1);
  }

  .wopt:disabled {
    opacity: 0.56;
    cursor: not-allowed;
  }

  .wo-icon {
    font-size: 18px;
  }

  .wo-name {
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1.1px;
    flex: 1;
  }

  .wo-chain {
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.8px;
    border: 1px solid rgba(232, 150, 125, 0.4);
    border-radius: 999px;
    padding: 3px 6px;
    color: var(--wm-kicker);
  }

  .connecting-anim {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 0;
  }

  .conn-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(232, 150, 125, 0.2);
    border-top-color: var(--wm-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .conn-text {
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1.1px;
    color: var(--wm-text);
  }

  .conn-sub {
    font-family: var(--fv);
    font-size: 15px;
    color: var(--wm-muted);
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 6px 2px;
    border-bottom: 1px solid rgba(232, 150, 125, 0.12);
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-k {
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1px;
    color: rgba(240, 237, 228, 0.55);
  }

  .info-v {
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1px;
    color: var(--wm-text);
    text-align: right;
    word-break: break-word;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .form-label {
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1.2px;
    color: rgba(240, 237, 228, 0.56);
  }

  .form-input {
    width: 100%;
    border: 1px solid rgba(232, 150, 125, 0.24);
    border-radius: 9px;
    background: rgba(232, 150, 125, 0.03);
    color: var(--wm-text);
    padding: 10px 11px;
    font-family: var(--fv);
    font-size: 18px;
    outline: none;
    transition: border-color 0.16s ease, box-shadow 0.16s ease;
  }

  .form-input:focus {
    border-color: rgba(232, 150, 125, 0.56);
    box-shadow: 0 0 0 2px rgba(232, 150, 125, 0.14);
  }

  .form-input::placeholder {
    color: rgba(240, 237, 228, 0.5);
  }

  .btn-primary,
  .btn-ghost {
    width: 100%;
    border-radius: 10px;
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1.4px;
    padding: 12px 12px;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
  }

  .btn-primary {
    border: 1px solid rgba(232, 150, 125, 0.65);
    background: rgba(232, 150, 125, 0.92);
    color: #0a1a0d;
    box-shadow: 0 0 18px rgba(232, 150, 125, 0.24);
  }

  .btn-primary:hover {
    background: #efab95;
  }

  .btn-primary:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .btn-ghost {
    border: 1px solid rgba(232, 150, 125, 0.2);
    background: transparent;
    color: rgba(240, 237, 228, 0.72);
  }

  .btn-ghost:hover {
    color: var(--wm-text);
    border-color: rgba(232, 150, 125, 0.4);
  }

  .passport-link {
    display: block;
    box-sizing: border-box;
  }

  @media (max-width: 480px) {
    .modal-overlay {
      padding: 12px;
    }

    .wallet-panel {
      width: 100%;
      max-height: 92vh;
      border-radius: 12px;
    }

    .wh {
      padding: 10px 10px;
      gap: 8px;
      flex-wrap: wrap;
    }

    .whc {
      margin-left: auto;
    }

    .wb {
      padding: 12px;
      gap: 10px;
    }

    .btn-primary,
    .btn-ghost {
      font-size: 9px;
      letter-spacing: 1.1px;
      padding: 11px 10px;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
