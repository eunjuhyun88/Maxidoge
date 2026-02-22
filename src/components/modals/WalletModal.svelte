<script lang="ts">
  import {
    walletStore,
    closeWalletModal, setWalletModalStep,
    registerUser, completeDemoView,
    connectWallet, signMessage, skipWalletConnection,
    disconnectWallet
  } from '$lib/stores/walletStore';
  import { registerAuth, requestWalletNonce, verifyWalletSignature } from '$lib/api/auth';
  import {
    WALLET_PROVIDER_LABEL,
    getPreferredEvmChainCode,
    hasInjectedEvmProvider,
    requestInjectedEvmAccount,
    requestPhantomSolanaAccount,
    signInjectedEvmMessage,
    signPhantomSolanaUtf8Message,
    type WalletProviderKey
  } from '$lib/wallet/providers';

  $: state = $walletStore;
  $: step = state.walletModalStep;

  // Form state
  let emailInput = '';
  let nicknameInput = '';
  let emailError = '';
  let actionError = '';
  let connectingProvider = '';
  let signingMessage = false;

  const WALLET_SIGNATURE_RE = /^0x[0-9a-fA-F]{64,512}$/;
  const preferredEvmChain = getPreferredEvmChainCode();

  function isWalletProviderKey(value: string): value is WalletProviderKey {
    return value === 'metamask'
      || value === 'coinbase'
      || value === 'walletconnect'
      || value === 'phantom';
  }

  function isEvmAddress(address: string): boolean {
    return address.startsWith('0x');
  }

  async function handleSignup() {
    emailError = '';
    actionError = '';
    if (!emailInput.includes('@')) { emailError = 'Valid email required'; return; }
    if (nicknameInput.trim().length < 2) { emailError = 'Nickname: 2+ chars'; return; }

    try {
      await registerAuth({
        email: emailInput.trim(),
        nickname: nicknameInput.trim(),
        walletAddress: state.connected ? state.address || undefined : undefined,
        walletSignature: state.connected
          && typeof state.signature === 'string'
          && WALLET_SIGNATURE_RE.test(state.signature)
          ? state.signature
          : undefined,
      });
      registerUser(emailInput.trim(), nicknameInput.trim());
    } catch (error) {
      emailError = error instanceof Error ? error.message : 'Failed to register account';
    }
  }

  async function handleConnect(provider: string) {
    actionError = '';
    if (!isWalletProviderKey(provider)) {
      actionError = 'Unsupported wallet provider.';
      return;
    }

    connectingProvider = WALLET_PROVIDER_LABEL[provider];
    setWalletModalStep('connecting');

    try {
      if (provider === 'phantom') {
        // Prefer EVM-injected Phantom first. If unavailable, use Phantom Solana provider.
        if (hasInjectedEvmProvider('phantom')) {
          const walletAddress = await requestInjectedEvmAccount('phantom');
          connectWallet(provider, walletAddress, preferredEvmChain);
        } else {
          const solAddress = await requestPhantomSolanaAccount();
          connectWallet(provider, solAddress, 'SOL');
        }
      } else {
        const walletAddress = await requestInjectedEvmAccount(provider);
        connectWallet(provider, walletAddress, preferredEvmChain);
      }
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Failed to connect wallet';
      setWalletModalStep('wallet-select');
    } finally {
      connectingProvider = '';
    }
  }

  async function handleSignMessage() {
    signingMessage = true;
    actionError = '';

    try {
      if (!state.address) {
        throw new Error('Wallet address is missing');
      }

      if (!state.provider || !isWalletProviderKey(state.provider)) {
        throw new Error('Wallet provider is missing.');
      }

      const provider = state.provider;

      if (isEvmAddress(state.address)) {
        const noncePayload = await requestWalletNonce({
          address: state.address,
          provider,
          chain: state.chain,
        });

        const signature = await signInjectedEvmMessage(provider, noncePayload.message, state.address);

        await verifyWalletSignature({
          address: state.address,
          message: noncePayload.message,
          signature,
          provider,
          chain: state.chain,
        });

        signMessage(signature);
        return;
      }

      // Non-EVM wallets (e.g. Phantom Solana) use a direct verification call without nonce.
      if (provider === 'phantom') {
        const message = [
          'MAXI DOGE Wallet Verification',
          `Address: ${state.address}`,
          `Issued At: ${new Date().toISOString()}`,
          'Signing this message proves wallet ownership.',
        ].join('\n');

        const signature = await signPhantomSolanaUtf8Message(message);
        await verifyWalletSignature({
          address: state.address,
          message,
          signature,
          provider,
          chain: 'SOL',
        });
        signMessage(signature);
        return;
      }

      throw new Error(`${WALLET_PROVIDER_LABEL[provider]} does not support this signature flow yet.`);
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Failed to sign wallet message';
    } finally {
      signingMessage = false;
    }
  }

  function handleSkip() {
    skipWalletConnection();
  }

  function handleDisconnect() {
    disconnectWallet();
    closeWalletModal();
  }

  function handleClose() {
    closeWalletModal();
  }
</script>

{#if state.showWalletModal}
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-overlay" on:click={handleClose}>
  <div class="wallet-panel" on:click|stopPropagation>

    <!-- ═══ HEADER ═══ -->
    <div class="wh">
      <span class="whi">
        {#if step === 'welcome'}🐕
        {:else if step === 'signup'}📝
        {:else if step === 'demo-intro'}🎮
        {:else if step === 'wallet-select'}🔗
        {:else if step === 'sign-message'}✍️
        {:else if step === 'connecting'}⏳
        {:else if step === 'connected'}✨
        {:else}👤
        {/if}
      </span>
      <span class="wht">
        {#if step === 'welcome'}WELCOME TO MAXI⚡DOGE
        {:else if step === 'signup'}CREATE ACCOUNT
        {:else if step === 'demo-intro'}DEMO ROUND
        {:else if step === 'wallet-select'}CONNECT WALLET
        {:else if step === 'sign-message'}VERIFY OWNERSHIP
        {:else if step === 'connecting'}CONNECTING...
        {:else if step === 'connected'}CONNECTED!
        {:else}MY PROFILE
        {/if}
      </span>
      <button class="whc" on:click={handleClose}>✕</button>
    </div>

    {#if actionError}
      <div class="global-error">{actionError}</div>
    {/if}

    <!-- ═══ STEP: WELCOME (P0 - No wallet forced) ═══ -->
    {#if step === 'welcome'}
      <div class="wb step-welcome">
        <div class="welcome-hero">
          <div class="welcome-doge">🐕</div>
          <div class="welcome-title">MAXI⚡DOGE</div>
          <div class="welcome-sub">8 AI Agents. 1 Decision. Your Call.</div>
        </div>

        <div class="welcome-features">
          <div class="wf-item">
            <span class="wf-icon">🤖</span>
            <div>
              <div class="wf-label">Watch AI Agents Debate</div>
              <div class="wf-desc">7 specialized agents analyze the market in real-time</div>
            </div>
          </div>
          <div class="wf-item">
            <span class="wf-icon">🎯</span>
            <div>
              <div class="wf-label">Make Your Prediction First</div>
              <div class="wf-desc">Enter your hypothesis before seeing agent analysis</div>
            </div>
          </div>
          <div class="wf-item">
            <span class="wf-icon">🏆</span>
            <div>
              <div class="wf-label">Level Up & Compete</div>
              <div class="wf-desc">Build your Trading Passport and climb the leaderboard</div>
            </div>
          </div>
        </div>

        <button class="primary-btn" on:click={() => setWalletModalStep('wallet-select')}>
          🔗 GET STARTED
        </button>
        <button class="ghost-btn" on:click={handleClose}>
          Just Looking Around
        </button>

        <div class="step-hint">
          <span class="hint-icon">💡</span>
          Connect your wallet first, then create your trader profile.
        </div>
      </div>

    <!-- ═══ STEP: SIGNUP (Email + Nickname — after wallet) ═══ -->
    {:else if step === 'signup'}
      <div class="wb step-signup">
        <div class="signup-desc">
          {#if state.connected}
            Wallet connected! Now set up your trader profile.<br/>
            <span class="signup-note">Your email is used for notifications and recovery.</span>
          {:else}
            Create your trader profile with email and nickname.<br/>
            <span class="signup-note">You can connect a wallet later from settings.</span>
          {/if}
        </div>

        <div class="form-group">
          <label class="form-label">EMAIL</label>
          <input class="form-input" type="email" bind:value={emailInput} placeholder="your@email.com" />
        </div>

        <div class="form-group">
          <label class="form-label">NICKNAME</label>
          <input class="form-input" type="text" bind:value={nicknameInput} placeholder="DogeTrader42" maxlength="16" />
          <div class="form-hint">{nicknameInput.length}/16 characters</div>
        </div>

        {#if emailError}
          <div class="form-error">{emailError}</div>
        {/if}

        <button class="primary-btn" on:click={handleSignup}>
          CREATE ACCOUNT →
        </button>
        <button class="back-btn" on:click={() => setWalletModalStep(state.connected ? 'connected' : 'wallet-select')}>
          ← Back
        </button>
      </div>

    <!-- ═══ STEP: DEMO INTRO ═══ -->
    {:else if step === 'demo-intro'}
      <div class="wb step-demo">
        <div class="demo-hero">
          <div class="demo-icon">🎮</div>
          <div class="demo-title">YOUR FIRST ROUND</div>
        </div>

        <div class="demo-steps">
          <div class="demo-step">
            <span class="ds-num">1</span>
            <div>
              <div class="ds-title">Enter Your Hypothesis</div>
              <div class="ds-desc">Pick LONG or SHORT before seeing any data</div>
            </div>
          </div>
          <div class="demo-step">
            <span class="ds-num">2</span>
            <div>
              <div class="ds-title">Watch Agents Analyze</div>
              <div class="ds-desc">7 agents debate — they may DISSENT from each other</div>
            </div>
          </div>
          <div class="demo-step">
            <span class="ds-num">3</span>
            <div>
              <div class="ds-title">Compare & Learn</div>
              <div class="ds-desc">See how your prediction matches the agents' verdict</div>
            </div>
          </div>
        </div>

        <div class="demo-note">
          <span class="demo-note-icon">⚡</span>
          Agents don't always agree. Look for <strong>DISSENT</strong> — it's where the best insights hide.
        </div>

        <button class="primary-btn" on:click={completeDemoView}>
          START DEMO ROUND 🐕
        </button>
      </div>

    <!-- ═══ STEP: WALLET SELECT (P2 - Optional) ═══ -->
    {:else if step === 'wallet-select'}
      <div class="wb step-wallet">
        <div class="wallet-header-note">
          <span class="whn-badge">OPTIONAL</span>
          <span class="whn-text">Connect a wallet to unlock DeFi features</span>
        </div>

        <div class="wallet-list">
          <button class="wopt" on:click={() => handleConnect('metamask')}>
            <span class="wo-icon">🦊</span>
            <span class="wo-name">MetaMask</span>
            <span class="wo-pop">Popular</span>
          </button>
          <button class="wopt" on:click={() => handleConnect('phantom')}>
            <span class="wo-icon">👻</span>
            <span class="wo-name">Phantom</span>
            <span class="wo-chain">SOL</span>
          </button>
          <button class="wopt" on:click={() => handleConnect('walletconnect')}>
            <span class="wo-icon">🔵</span>
            <span class="wo-name">WalletConnect</span>
            <span class="wo-chain">Multi</span>
          </button>
          <button class="wopt" on:click={() => handleConnect('coinbase')}>
            <span class="wo-icon">🔷</span>
            <span class="wo-name">Coinbase Wallet</span>
            <span class="wo-chain">Multi</span>
          </button>
        </div>

        <button class="skip-btn" on:click={() => setWalletModalStep('signup')}>
          Skip wallet — register with email only
        </button>

        <div class="wallet-note">
          You can always connect a wallet from Settings or your Profile.
        </div>
      </div>

    <!-- ═══ STEP: CONNECTING ═══ -->
    {:else if step === 'connecting'}
      <div class="wb step-connecting">
        <div class="connecting-anim">
          <div class="conn-spinner"></div>
          <div class="conn-text">Connecting to {connectingProvider}...</div>
          <div class="conn-sub">Confirm in your wallet</div>
        </div>
      </div>

    <!-- ═══ STEP: SIGN MESSAGE (verify ownership) ═══ -->
    {:else if step === 'sign-message'}
      <div class="wb step-sign">
        <div class="sign-hero">
          <div class="sign-icon">✍️</div>
          <div class="sign-title">VERIFY OWNERSHIP</div>
          <div class="sign-sub">Sign a message to prove you own this wallet</div>
        </div>

        <div class="sign-details">
          <div class="sign-row">
            <span class="sign-label">ADDRESS</span>
            <span class="sign-val">{state.shortAddr}</span>
          </div>
          <div class="sign-row">
            <span class="sign-label">MESSAGE</span>
            <span class="sign-msg">"MAXI⚡DOGE verify {state.shortAddr} at {Date.now()}"</span>
          </div>
          <div class="sign-row">
            <span class="sign-label">CHAIN</span>
            <span class="sign-val">{state.chain}</span>
          </div>
        </div>

        <div class="sign-note">
          <span class="sign-note-icon">🔒</span>
          This is a free signature request — no gas fees.
        </div>

        <button class="primary-btn sign-btn" on:click={handleSignMessage} disabled={signingMessage}>
          {#if signingMessage}
            <span class="sign-spinner"></span> SIGNING...
          {:else}
            ✍️ SIGN MESSAGE
          {/if}
        </button>
        <button class="ghost-btn" on:click={() => setWalletModalStep('wallet-select')}>
          ← Use Different Wallet
        </button>
      </div>

    <!-- ═══ STEP: CONNECTED (wallet done → now signup) ═══ -->
    {:else if step === 'connected'}
      <div class="wb step-connected">
        <div class="connected-hero">
          <div class="conn-check">✓</div>
          <div class="conn-label">WALLET CONNECTED</div>
          <div class="conn-addr">{state.shortAddr}</div>
          <div class="conn-balance">{state.balance.toLocaleString()} USDT</div>
        </div>

        <div class="connected-features">
          <div class="cf-item unlock">🔓 DeFi Copilot Orders</div>
          <div class="cf-item unlock">🔓 On-chain Verification</div>
          <div class="cf-item unlock">🔓 Token-gated Challenges</div>
        </div>

        {#if state.email}
          <a class="primary-btn passport-link" href="/passport" on:click={handleClose}>
            🐕 VIEW PASSPORT →
          </a>
          <button class="ghost-btn" on:click={() => setWalletModalStep('profile')}>
            View Quick Profile
          </button>
        {:else}
          <button class="primary-btn" on:click={() => setWalletModalStep('signup')}>
            CREATE ACCOUNT →
          </button>
          <a class="ghost-btn passport-link" href="/passport" on:click={handleClose}>
            View Passport first
          </a>
          <button class="ghost-btn" on:click={handleClose}>
            Skip — I'll register later
          </button>
        {/if}
      </div>

    <!-- ═══ STEP: PROFILE (connected user) ═══ -->
    {:else if step === 'profile'}
      <div class="wb step-profile">
        <div class="profile-hero">
          <div class="profile-avatar">🐕</div>
          <div class="profile-name">{state.nickname || 'DOGE TRADER'}</div>
          <div class="profile-email">{state.email || ''}</div>
        </div>

        <div class="profile-stats">
          <div class="ps-item">
            <div class="ps-lbl">PHASE</div>
            <div class="ps-val">P{state.phase}</div>
          </div>
          <div class="ps-item">
            <div class="ps-lbl">MATCHES</div>
            <div class="ps-val">{state.matchesPlayed}</div>
          </div>
          <div class="ps-item">
            <div class="ps-lbl">LP</div>
            <div class="ps-val">{state.totalLP}</div>
          </div>
          <div class="ps-item">
            <div class="ps-lbl">TIER</div>
            <div class="ps-val tier-{state.tier}">{state.tier.toUpperCase()}</div>
          </div>
        </div>

        {#if state.connected}
          <div class="wallet-info">
            <div class="wi-row">
              <span class="wi-lbl">Wallet</span>
              <span class="wi-val">{state.shortAddr}</span>
            </div>
            <div class="wi-row">
              <span class="wi-lbl">Chain</span>
              <span class="wi-val">{state.chain}</span>
            </div>
            <div class="wi-row">
              <span class="wi-lbl">Balance</span>
              <span class="wi-val">{state.balance.toLocaleString()} USDT</span>
            </div>
          </div>
          <a class="primary-btn passport-link" href="/passport" on:click={handleClose}>
            🐕 VIEW FULL PASSPORT →
          </a>
          <button class="disconnect-btn" on:click={handleDisconnect}>
            Disconnect Wallet
          </button>
        {:else}
          <button class="primary-btn" on:click={() => setWalletModalStep('wallet-select')}>
            🔗 CONNECT WALLET
          </button>
          <a class="ghost-btn passport-link" href="/passport" on:click={handleClose}>
            View Passport →
          </a>
        {/if}
      </div>
    {/if}

    <!-- Phase indicator (new flow: wallet → signup) -->
    <div class="phase-dots">
      {#each ['welcome','wallet-select','connected','signup'] as s, i}
        <div class="pdot" class:active={step === s} class:done={
          (s === 'welcome' && (state.connected || state.email !== null)) ||
          (s === 'wallet-select' && state.connected) ||
          (s === 'connected' && state.connected) ||
          (s === 'signup' && state.email !== null)
        }></div>
      {/each}
    </div>
  </div>
</div>
{/if}

<style>
  .modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.75);
    backdrop-filter: blur(6px);
    z-index: 200;
    display: flex; align-items: center; justify-content: center;
  }
  .wallet-panel {
    width: 380px;
    max-height: 85vh;
    border: 4px solid #000; border-radius: 16px;
    overflow: hidden; box-shadow: 8px 8px 0 #000;
    background: #0a0a1a;
    display: flex;
    flex-direction: column;
  }

  /* Header */
  .wh {
    padding: 12px 16px;
    background: linear-gradient(90deg, #ffe600, #ffcc00);
    border-bottom: 4px solid #000;
    display: flex; align-items: center; gap: 8px;
    color: #000;
    flex-shrink: 0;
  }
  .whi { font-size: 18px; }
  .wht { font-size: 11px; font-weight: 900; font-family: var(--fd); letter-spacing: 1.5px; }
  .whc {
    margin-left: auto; font-size: 16px; cursor: pointer;
    background: none; border: 2px solid #000; width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 6px; transition: all .15s;
  }
  .whc:hover { background: #000; color: #ffe600; }

  /* Body */
  .wb {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }

  /* ═══ WELCOME STEP ═══ */
  .welcome-hero { text-align: center; margin-bottom: 16px; }
  .welcome-doge { font-size: 42px; margin-bottom: 4px; }
  .welcome-title { font-family: var(--fd); font-size: 22px; letter-spacing: 3px; color: var(--yel); }
  .welcome-sub { font-family: var(--fm); font-size: 10px; color: rgba(255,255,255,.5); letter-spacing: 1px; margin-top: 4px; }

  .welcome-features { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .wf-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; border-radius: 8px;
    background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06);
  }
  .wf-icon { font-size: 18px; flex-shrink: 0; }
  .wf-label { font-family: var(--fm); font-size: 10px; font-weight: 700; color: #fff; margin-bottom: 2px; }
  .wf-desc { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.45); line-height: 1.4; }

  .step-hint {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 12px; margin-top: 10px;
    background: rgba(255,230,0,.05); border: 1px dashed rgba(255,230,0,.2); border-radius: 8px;
    font-family: var(--fm); font-size: 8px; color: rgba(255,230,0,.6); line-height: 1.4;
  }
  .hint-icon { font-size: 12px; }

  /* ═══ SIGNUP STEP ═══ */
  .signup-desc {
    font-family: var(--fm); font-size: 10px; color: rgba(255,255,255,.6);
    line-height: 1.5; margin-bottom: 14px; text-align: center;
  }
  .signup-note { color: rgba(255,230,0,.5); font-weight: 700; }

  .form-group { margin-bottom: 10px; }
  .form-label {
    display: block; font-family: var(--fm); font-size: 8px; font-weight: 700;
    letter-spacing: 2px; color: rgba(255,255,255,.4); margin-bottom: 4px;
  }
  .form-input {
    width: 100%; padding: 10px 12px; border-radius: 8px;
    background: rgba(255,255,255,.06); border: 2px solid rgba(255,255,255,.1);
    color: #fff; font-size: 12px; font-family: var(--fm); outline: none;
    box-sizing: border-box;
    transition: border-color .2s;
  }
  .form-input:focus { border-color: var(--yel); }
  .form-input::placeholder { color: #444; }
  .form-hint { font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.25); text-align: right; margin-top: 2px; }
  .global-error,
  .form-error {
    font-family: var(--fm); font-size: 9px; color: var(--red);
    padding: 4px 8px; background: rgba(255,45,85,.1); border-radius: 4px; margin-bottom: 8px;
  }
  .global-error {
    margin: 8px 12px 0;
  }

  /* ═══ DEMO STEP ═══ */
  .demo-hero { text-align: center; margin-bottom: 14px; }
  .demo-icon { font-size: 32px; margin-bottom: 4px; }
  .demo-title { font-family: var(--fd); font-size: 16px; letter-spacing: 3px; color: #fff; }

  .demo-steps { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
  .demo-step {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; border-radius: 8px;
    background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06);
  }
  .ds-num {
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--yel); color: #000;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--fd); font-size: 11px; font-weight: 900;
    flex-shrink: 0;
  }
  .ds-title { font-family: var(--fm); font-size: 10px; font-weight: 700; color: #fff; }
  .ds-desc { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.45); line-height: 1.4; }

  .demo-note {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 12px; margin-bottom: 14px;
    background: rgba(255,45,85,.06); border: 1px solid rgba(255,45,85,.2); border-radius: 8px;
    font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.6); line-height: 1.4;
  }
  .demo-note-icon { font-size: 12px; }
  .demo-note strong { color: var(--red); letter-spacing: 1px; }

  /* ═══ WALLET SELECT STEP ═══ */
  .wallet-header-note {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 12px;
  }
  .whn-badge {
    font-family: var(--fm); font-size: 7px; font-weight: 700;
    background: rgba(0,255,136,.15); color: var(--grn);
    border: 1px solid rgba(0,255,136,.3); padding: 2px 6px;
    letter-spacing: 1.5px;
  }
  .whn-text { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.5); }

  .wallet-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
  .wopt {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; border-radius: 10px;
    background: rgba(255,255,255,.03); border: 2px solid rgba(255,255,255,.08);
    color: #fff; cursor: pointer; transition: all .15s;
    font-family: var(--fm);
  }
  .wopt:hover { background: rgba(255,255,255,.08); border-color: var(--yel); }
  .wo-icon { font-size: 20px; }
  .wo-name { font-size: 11px; font-weight: 700; flex: 1; text-align: left; }
  .wo-pop, .wo-chain {
    font-size: 7px; padding: 2px 6px; border-radius: 4px;
    background: rgba(255,230,0,.1); color: var(--yel);
    font-weight: 700; letter-spacing: .5px;
  }

  .skip-btn {
    width: 100%; padding: 8px;
    background: none; border: 1px dashed rgba(255,255,255,.15);
    color: rgba(255,255,255,.35); font-family: var(--fm); font-size: 9px;
    cursor: pointer; border-radius: 8px; transition: all .15s;
  }
  .skip-btn:hover { color: rgba(255,255,255,.6); border-color: rgba(255,255,255,.3); }

  .wallet-note {
    text-align: center; font-family: var(--fm); font-size: 7px;
    color: rgba(255,255,255,.25); margin-top: 8px;
  }

  /* ═══ CONNECTING STEP ═══ */
  .connecting-anim { text-align: center; padding: 30px 0; }
  .conn-spinner {
    width: 40px; height: 40px; margin: 0 auto 12px;
    border: 3px solid rgba(255,230,0,.2);
    border-top-color: var(--yel);
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .conn-text { font-family: var(--fm); font-size: 12px; font-weight: 700; color: #fff; }
  .conn-sub { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.4); margin-top: 4px; }

  /* ═══ SIGN MESSAGE STEP ═══ */
  .sign-hero { text-align: center; margin-bottom: 14px; }
  .sign-icon { font-size: 36px; margin-bottom: 6px; }
  .sign-title {
    font-family: var(--fd);
    font-size: 16px; font-weight: 900; letter-spacing: 2px; color: #fff;
  }
  .sign-sub {
    font-family: var(--fm);
    font-size: 9px; color: rgba(255,255,255,.5); margin-top: 4px;
  }
  .sign-details {
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 10px;
    padding: 10px;
    margin-bottom: 10px;
  }
  .sign-row {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,.04);
  }
  .sign-row:last-child { border-bottom: none; }
  .sign-label {
    font-family: var(--fm);
    font-size: 7px; font-weight: 900; letter-spacing: 1.5px;
    color: rgba(255,255,255,.3); min-width: 55px;
  }
  .sign-val {
    font-family: var(--fd);
    font-size: 10px; font-weight: 900; color: var(--yel);
  }
  .sign-msg {
    font-family: var(--fm);
    font-size: 8px; color: rgba(255,255,255,.6);
    word-break: break-all;
  }
  .sign-note {
    display: flex; align-items: center; gap: 6px;
    background: rgba(0,255,136,.06);
    border: 1px solid rgba(0,255,136,.15);
    border-radius: 8px; padding: 8px 10px; margin-bottom: 12px;
    font-family: var(--fm);
    font-size: 8px; color: rgba(255,255,255,.6);
  }
  .sign-note-icon { font-size: 12px; }
  .sign-btn:disabled { opacity: .6; cursor: not-allowed; }
  .sign-spinner {
    display: inline-block;
    width: 10px; height: 10px;
    border: 2px solid rgba(255,255,255,.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin .6s linear infinite;
  }

  /* ═══ CONNECTED STEP ═══ */
  .connected-hero { text-align: center; margin-bottom: 14px; }
  .conn-check {
    width: 48px; height: 48px; border-radius: 50%;
    background: rgba(0,255,136,.15); border: 3px solid var(--grn);
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; color: var(--grn); margin: 0 auto 8px;
    animation: checkPop .4s ease;
  }
  @keyframes checkPop { 0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
  .conn-label { font-family: var(--fd); font-size: 14px; color: var(--grn); letter-spacing: 2px; }
  .conn-addr { font-family: var(--fm); font-size: 10px; color: rgba(255,255,255,.5); margin-top: 4px; }
  .conn-balance { font-family: var(--fd); font-size: 16px; color: var(--yel); margin-top: 4px; }

  .connected-features { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
  .cf-item {
    font-family: var(--fm); font-size: 9px; padding: 6px 10px;
    background: rgba(0,255,136,.05); border: 1px solid rgba(0,255,136,.15);
    border-radius: 6px; color: rgba(0,255,136,.7);
  }

  /* ═══ PROFILE STEP ═══ */
  .profile-hero { text-align: center; margin-bottom: 14px; }
  .profile-avatar {
    font-size: 40px; width: 60px; height: 60px;
    border-radius: 50%; background: rgba(255,230,0,.1);
    border: 3px solid var(--yel); margin: 0 auto 6px;
    display: flex; align-items: center; justify-content: center;
  }
  .profile-name { font-family: var(--fd); font-size: 16px; color: #fff; letter-spacing: 2px; }
  .profile-email { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.35); margin-top: 2px; }

  .profile-stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
    margin-bottom: 12px;
  }
  .ps-item { text-align: center; padding: 6px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); }
  .ps-lbl { font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.35); letter-spacing: 1px; }
  .ps-val { font-family: var(--fd); font-size: 14px; color: var(--yel); }
  .ps-val.tier-guest { color: #888; }
  .ps-val.tier-registered { color: #8b5cf6; }
  .ps-val.tier-connected { color: var(--grn); }
  .ps-val.tier-verified { color: var(--yel); }

  .wallet-info {
    background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06);
    border-radius: 8px; padding: 8px 10px; margin-bottom: 10px;
  }
  .wi-row { display: flex; justify-content: space-between; padding: 3px 0; }
  .wi-lbl { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.35); }
  .wi-val { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.7); font-weight: 700; }

  .passport-link {
    display: block;
    text-align: center;
    text-decoration: none;
    box-sizing: border-box;
  }

  .disconnect-btn {
    width: 100%; padding: 8px;
    background: rgba(255,45,85,.1); border: 2px solid rgba(255,45,85,.3);
    color: var(--red); font-family: var(--fm); font-size: 9px; font-weight: 700;
    cursor: pointer; border-radius: 8px; transition: all .15s;
    margin-top: 6px;
  }
  .disconnect-btn:hover { background: rgba(255,45,85,.2); }

  /* ═══ SHARED BUTTONS ═══ */
  .primary-btn {
    width: 100%; padding: 12px;
    background: var(--yel); color: #000;
    border: 3px solid #000; border-radius: 10px;
    font-family: var(--fd); font-size: 12px; font-weight: 900;
    letter-spacing: 2px; cursor: pointer;
    box-shadow: 3px 3px 0 #000;
    transition: all .15s;
    margin-top: 6px;
  }
  .primary-btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 #000; }

  .ghost-btn {
    width: 100%; padding: 8px;
    background: none; border: none;
    color: rgba(255,255,255,.35); font-family: var(--fm); font-size: 9px;
    cursor: pointer; margin-top: 4px;
    transition: color .15s;
  }
  .ghost-btn:hover { color: rgba(255,255,255,.6); }

  .back-btn {
    width: 100%; padding: 6px;
    background: none; border: none;
    color: rgba(255,255,255,.3); font-family: var(--fm); font-size: 9px;
    cursor: pointer; margin-top: 4px;
    transition: color .15s;
  }
  .back-btn:hover { color: rgba(255,255,255,.5); }

  /* ═══ PHASE DOTS ═══ */
  .phase-dots {
    display: flex; justify-content: center; gap: 6px;
    padding: 8px; border-top: 1px solid rgba(255,255,255,.06);
    flex-shrink: 0;
  }
  .pdot {
    width: 6px; height: 6px; border-radius: 50%;
    background: rgba(255,255,255,.15);
    transition: all .2s;
  }
  .pdot.active { background: var(--yel); box-shadow: 0 0 6px var(--yel); }
  .pdot.done { background: var(--grn); }
</style>
