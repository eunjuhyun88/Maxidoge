<script lang="ts">
  import type { PassportHeaderStat } from '$lib/passport/passportSummaryViewModel';

  interface Props {
    avatar: string;
    username: string;
    tierColor: string;
    tierLabel: string;
    tierEmoji: string;
    walletConnected: boolean;
    walletShortAddr: string | null;
    walletChain: string | null;
    portfolioValue: string;
    totalPnlPct: number;
    headerStats: PassportHeaderStat[];
    showAvatarPicker: boolean;
    avatarOptions: string[];
    editingName: boolean;
    nameInput: string;
    onToggleAvatarPicker: () => void;
    onPickAvatar: (path: string) => void;
    onStartEditName: () => void;
    onSaveName: () => void;
    onNameInput: (value: string) => void;
    onOpenWalletModal: () => void;
  }

  let {
    avatar,
    username,
    tierColor,
    tierLabel,
    tierEmoji,
    walletConnected,
    walletShortAddr,
    walletChain,
    portfolioValue,
    totalPnlPct,
    headerStats,
    showAvatarPicker,
    avatarOptions,
    editingName,
    nameInput,
    onToggleAvatarPicker,
    onPickAvatar,
    onStartEditName,
    onSaveName,
    onNameInput,
    onOpenWalletModal,
  }: Props = $props();
</script>

<div class="passport-header-section">
  <div class="unified-header">
    <div class="uh-left">
      <button class="doge-avatar" onclick={onToggleAvatarPicker}>
        <img src={avatar} alt="avatar" class="doge-img" />
        <span class="avatar-edit">✏️</span>
      </button>

      <div class="player-info">
        {#if editingName}
          <div class="name-edit">
            <input
              class="name-input"
              type="text"
              value={nameInput}
              maxlength="16"
              oninput={(event) => onNameInput((event.currentTarget as HTMLInputElement).value)}
              onkeydown={(event) => event.key === 'Enter' && onSaveName()}
            />
            <button class="name-save" onclick={onSaveName}>✓</button>
          </div>
        {:else}
          <button class="player-name" onclick={onStartEditName}>
            {username} <span class="name-pen">✏️</span>
          </button>
        {/if}
        <div class="player-tier" style="color:{tierColor}">
          {tierEmoji} {tierLabel}
        </div>
        {#if walletConnected}
          <div class="player-addr">{walletShortAddr} · {walletChain}</div>
        {:else}
          <button class="connect-mini" onclick={onOpenWalletModal}>CONNECT WALLET</button>
        {/if}
      </div>
    </div>

    <div class="uh-right">
      <div class="port-val">
        <div class="pv-label">PORTFOLIO</div>
        <div class="pv-amount">${portfolioValue}</div>
        <div class="pv-pnl" class:up={totalPnlPct >= 0} class:down={totalPnlPct < 0}>
          {totalPnlPct >= 0 ? '▲' : '▼'} {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
        </div>
      </div>
      <div class="uh-stats">
        {#each headerStats as stat (stat.label)}
          <div class="uhs">
            <span class="uhs-val" style:color={stat.color}>{stat.value}</span>
            <span class="uhs-lbl">{stat.label}</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="passport-stamp">
      <span class="stamp-text">{walletConnected ? 'VERIFIED' : 'UNVERIFIED'}</span>
      <span class="stamp-icon">●</span>
    </div>
  </div>

  {#if showAvatarPicker}
    <div class="avatar-picker">
      <div class="ap-title">SELECT AVATAR</div>
      <div class="ap-grid">
        {#each avatarOptions as opt}
          <button class="ap-opt" class:selected={avatar === opt} onclick={() => onPickAvatar(opt)}>
            <img src={opt} alt="avatar option" loading="lazy" />
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .passport-header-section {
    position: relative;
    z-index: 2;
  }

  .unified-header {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--sp-space-3);
    padding: var(--sp-space-5);
    border-bottom: 1px solid var(--sp-line);
    background: rgba(8, 22, 14, 0.72);
  }

  .uh-left {
    display: flex;
    gap: var(--sp-space-2);
    min-width: 0;
    align-items: center;
  }

  .uh-right {
    display: flex;
    flex-direction: column;
    gap: var(--sp-space-2);
    width: min(430px, 100%);
    min-width: min(320px, 100%);
    align-items: stretch;
  }

  .doge-avatar {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--sp-line);
    background: rgba(255, 255, 255, 0.04);
    cursor: pointer;
    padding: 0;
    transition: transform 0.15s ease;
  }

  .doge-avatar:hover {
    transform: translateY(-1px);
  }

  .doge-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .avatar-edit {
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--sp-pk);
    color: #111;
  }

  .player-info {
    min-width: 0;
  }

  .player-name {
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: clamp(17px, 2vw, 22px);
    font-weight: 700;
    letter-spacing: 0.06px;
  }

  .name-pen {
    font-size: 11px;
    opacity: 0.55;
  }

  .name-edit {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .name-input {
    width: 160px;
    border-radius: 7px;
    border: 1px solid var(--sp-line);
    background: rgba(0, 0, 0, 0.35);
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 11px;
    padding: 6px 8px;
    outline: none;
  }

  .name-save {
    border: 1px solid var(--sp-pk);
    background: rgba(255, 140, 121, 0.15);
    color: var(--sp-pk-l);
    border-radius: 7px;
    padding: 5px 8px;
    font-family: var(--fp);
    font-size: 10px;
    cursor: pointer;
  }

  .player-tier {
    margin-top: 2px;
    font-family: var(--fp);
    font-size: 10px;
    letter-spacing: 0.12px;
  }

  .player-addr {
    margin-top: 5px;
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 11px;
  }

  .connect-mini {
    margin-top: 5px;
    border: 1px solid var(--sp-pk);
    background: rgba(255, 140, 121, 0.12);
    color: var(--sp-pk-l);
    border-radius: 7px;
    padding: 5px 10px;
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.12px;
    cursor: pointer;
  }

  .port-val {
    display: flex;
    flex-direction: column;
    gap: 3px;
    text-align: right;
  }

  .pv-label {
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.12px;
  }

  .pv-amount {
    margin-top: 2px;
    color: var(--sp-w);
    font-family: 'JetBrains Mono', monospace;
    font-size: clamp(22px, 2.8vw, 32px);
    font-weight: 700;
    line-height: 1.02;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }

  .pv-pnl {
    margin-top: 2px;
    font-family: var(--fp);
    font-size: 10px;
    letter-spacing: 0.08px;
  }

  .pv-pnl.up {
    color: var(--sp-green);
  }

  .pv-pnl.down {
    color: var(--sp-red);
  }

  .uh-stats {
    display: flex;
    flex-wrap: nowrap;
    gap: var(--sp-space-2);
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .uh-stats::-webkit-scrollbar {
    display: none;
  }

  .uhs {
    flex: 1 0 0;
    min-width: 72px;
    padding: var(--sp-space-2) 7px;
    border-radius: 8px;
    border: 1px solid var(--sp-soft);
    background: rgba(0, 0, 0, 0.25);
    text-align: center;
  }

  .uhs-val {
    display: block;
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 15px;
    font-weight: 700;
    line-height: 1.05;
  }

  .uhs-lbl {
    display: block;
    margin-top: 4px;
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.18px;
  }

  .passport-stamp {
    position: absolute;
    top: 10px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid rgba(255, 140, 121, 0.42);
    border-radius: 8px;
    color: var(--sp-pk-l);
    background: rgba(255, 140, 121, 0.08);
    transform: rotate(8deg);
    font-family: var(--fp);
  }

  .stamp-text {
    font-size: 9px;
    letter-spacing: 1px;
  }

  .stamp-icon {
    font-size: 9px;
    opacity: 0.8;
  }

  .avatar-picker {
    margin: var(--sp-space-2) var(--sp-space-4) var(--sp-space-3);
    padding: var(--sp-space-2);
    border-radius: 10px;
    border: 1px solid var(--sp-line);
    background: rgba(0, 0, 0, 0.22);
  }

  .ap-title {
    margin-bottom: 8px;
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1px;
  }

  .ap-grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 6px;
  }

  .ap-opt {
    border: 1px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    padding: 0;
    background: none;
    cursor: pointer;
    aspect-ratio: 1;
  }

  .ap-opt:hover,
  .ap-opt.selected {
    border-color: var(--sp-pk);
  }

  .ap-opt img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  @media (max-width: 1024px) {
    .unified-header {
      grid-template-columns: 1fr;
    }

    .uh-right {
      min-width: 0;
      width: 100%;
      gap: var(--sp-space-2);
      align-items: stretch;
    }

    .port-val {
      text-align: left;
    }

    .ap-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }

  @media (max-width: 768px) {
    .unified-header {
      padding: var(--sp-space-3);
      gap: var(--sp-space-2);
    }

    .doge-avatar {
      width: 56px;
      height: 56px;
      border-radius: 10px;
    }

    .uh-right {
      gap: var(--sp-space-2);
      min-width: 0;
      width: 100%;
    }

    .uh-stats {
      width: 100%;
      gap: 5px;
      justify-content: flex-start;
    }

    .pv-amount {
      font-size: clamp(20px, 7.8vw, 28px);
    }

    .uhs {
      min-width: 62px;
      padding: 6px 4px;
      border-radius: 7px;
    }

    .uhs-val {
      font-size: 13px;
    }

    .uhs-lbl {
      font-size: 9px;
      margin-top: 3px;
    }

    .ap-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .passport-stamp {
      position: absolute;
      top: 8px;
      right: 10px;
      transform: rotate(0deg);
      margin-top: 0;
    }
  }

  @media (max-width: 480px) {
    .unified-header {
      padding: var(--sp-space-2);
      gap: var(--sp-space-1);
    }

    .doge-avatar {
      width: 44px;
      height: 44px;
      border-radius: 8px;
    }

    .avatar-edit {
      width: 14px;
      height: 14px;
      font-size: 8px;
    }

    .player-name {
      font-size: clamp(14px, 4vw, 17px);
    }

    .pv-amount {
      font-size: clamp(18px, 6vw, 24px);
    }

    .uhs {
      min-width: 56px;
      padding: 5px 3px;
      border-radius: 6px;
    }

    .uhs-val {
      font-size: 12px;
    }

    .ap-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 4px;
    }

    .passport-stamp {
      top: 4px;
      right: 6px;
      padding: 3px 6px;
    }

    .stamp-text {
      font-size: var(--sc-fs-2xs, 9px);
      letter-spacing: 0.5px;
    }
  }
</style>
