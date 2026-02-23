<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { TOKENS, TOKEN_CATEGORIES, TOKEN_MAP, type TokenDef } from '$lib/data/tokens';

  const dispatch = createEventDispatcher<{ select: { pair: string; token: TokenDef } }>();

  let { value = 'BTC/USDT', compact = false }: { value?: string; compact?: boolean } = $props();

  let open = $state(false);
  let filter = $state('');
  let dropdownEl: HTMLDivElement;

  // Current token from pair
  let currentSymbol = $derived(value.split('/')[0]);
  let currentToken = $derived(TOKEN_MAP.get(currentSymbol) || TOKENS[0]);

  // Category display names
  const CAT_LABELS: Record<string, string> = {
    major: 'MAJOR',
    l1l2: 'L1 / L2',
    defi: 'DeFi',
    meme: 'MEME',
    ai_gaming: 'AI / GAMING',
    infra: 'INFRA'
  };

  // Filtered tokens
  let filteredCategories = $derived.by(() => Object.entries(TOKEN_CATEGORIES).map(([cat, symbols]) => {
    const filtered = symbols.filter(sym => {
      if (!filter) return true;
      const f = filter.toLowerCase();
      const tok = TOKEN_MAP.get(sym);
      if (!tok) return false;
      return tok.symbol.toLowerCase().includes(f) || tok.name.toLowerCase().includes(f);
    });
    return { cat, label: CAT_LABELS[cat] || cat.toUpperCase(), tokens: filtered };
  }).filter(c => c.tokens.length > 0));

  function selectToken(sym: string) {
    const pair = `${sym}/USDT`;
    const token = TOKEN_MAP.get(sym);
    if (token) {
      dispatch('select', { pair, token });
    }
    open = false;
    filter = '';
  }

  function toggle() {
    open = !open;
    if (open) {
      filter = '';
      // Focus search on next tick
      requestAnimationFrame(() => {
        const input = dropdownEl?.querySelector('.tdd-search') as HTMLInputElement;
        if (input) input.focus();
      });
    }
  }

  // Close on outside click
  function handleClickOutside(e: MouseEvent) {
    if (dropdownEl && !dropdownEl.contains(e.target as Node)) {
      open = false;
      filter = '';
    }
  }

  // Keyboard nav
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
      filter = '';
    }
  }
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleKeydown} />

<div class="tdd" class:compact bind:this={dropdownEl}>
  <!-- Trigger Button -->
  <button class="tdd-trigger" on:click|stopPropagation={toggle} class:open>
    <span class="tdd-icon" style="color:{currentToken.color}">{currentToken.icon}</span>
    <span class="tdd-sym">{currentToken.symbol}</span>
    {#if !compact}
      <span class="tdd-name">{currentToken.name}</span>
    {/if}
    <span class="tdd-pair">/USDT</span>
    <span class="tdd-arrow">{open ? '▴' : '▾'}</span>
  </button>

  <!-- Dropdown Panel -->
  {#if open}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="tdd-panel" on:click|stopPropagation>
      <input
        class="tdd-search"
        type="text"
        bind:value={filter}
        placeholder="Search {TOKENS.length} tokens..."
      />

      <div class="tdd-list">
        {#each filteredCategories as { cat, label, tokens }}
          <div class="tdd-cat">
            <div class="tdd-cat-label">{label}</div>
            <div class="tdd-cat-grid">
              {#each tokens as sym}
                {@const tok = TOKEN_MAP.get(sym)}
                {#if tok}
                  <button
                    class="tdd-item"
                    class:active={currentSymbol === sym}
                    on:click={() => selectToken(sym)}
                  >
                    <span class="tdd-item-icon" style="color:{tok.color}">{tok.icon}</span>
                    <span class="tdd-item-sym">{tok.symbol}</span>
                    <span class="tdd-item-name">{tok.name}</span>
                  </button>
                {/if}
              {/each}
            </div>
          </div>
        {/each}

        {#if filteredCategories.length === 0}
          <div class="tdd-empty">No tokens match "{filter}"</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .tdd {
    position: relative;
    z-index: 50;
  }

  /* ── Trigger Button ── */
  .tdd-trigger {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(255,255,255,.05);
    border: 1.5px solid rgba(255,230,0,.2);
    color: #fff;
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all .15s;
    white-space: nowrap;
  }
  .tdd-trigger:hover {
    background: rgba(255,230,0,.1);
    border-color: rgba(255,230,0,.4);
  }
  .tdd-trigger.open {
    background: rgba(255,230,0,.15);
    border-color: #ffe600;
  }
  .tdd-icon { font-size: 12px; }
  .tdd-sym {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
    color: #ffe600;
  }
  .tdd-name {
    font-size: 8px;
    color: rgba(255,255,255,.4);
    letter-spacing: .5px;
  }
  .tdd-pair {
    font-size: 8px;
    color: rgba(255,255,255,.25);
    letter-spacing: .5px;
  }
  .tdd-arrow {
    font-size: 8px;
    color: rgba(255,255,255,.3);
    margin-left: 2px;
  }

  /* Compact mode */
  .tdd.compact .tdd-trigger {
    padding: 3px 8px;
    gap: 4px;
  }
  .tdd.compact .tdd-sym { font-size: 10px; }
  .tdd.compact .tdd-icon { font-size: 10px; }

  /* ── Dropdown Panel ── */
  .tdd-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 340px;
    max-height: 400px;
    background: #0c0c20;
    border: 2px solid rgba(255,230,0,.3);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0,0,0,.7), 0 0 20px rgba(255,230,0,.05);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: tddSlideIn .15s ease;
  }
  @keyframes tddSlideIn {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Search ── */
  .tdd-search {
    width: 100%;
    padding: 8px 12px;
    background: rgba(255,255,255,.04);
    border: none;
    border-bottom: 1px solid rgba(255,230,0,.12);
    color: #fff;
    font-size: 10px;
    font-family: var(--fm);
    font-weight: 600;
    outline: none;
    box-sizing: border-box;
    letter-spacing: .5px;
  }
  .tdd-search::placeholder { color: #555; }
  .tdd-search:focus { background: rgba(255,255,255,.06); }

  /* ── List ── */
  .tdd-list {
    overflow-y: auto;
    max-height: 350px;
    padding: 6px;
  }
  .tdd-list::-webkit-scrollbar { width: 4px; }
  .tdd-list::-webkit-scrollbar-track { background: transparent; }
  .tdd-list::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }

  /* ── Category ── */
  .tdd-cat {
    margin-bottom: 8px;
  }
  .tdd-cat-label {
    font-size: 7px;
    font-weight: 900;
    color: #555;
    letter-spacing: 2px;
    padding: 2px 6px;
    font-family: var(--fd);
    margin-bottom: 3px;
  }
  .tdd-cat-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    padding: 0 4px;
  }

  /* ── Token Item ── */
  .tdd-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(255,255,255,.06);
    color: #ccc;
    font-size: 8px;
    font-family: var(--fm);
    cursor: pointer;
    transition: all .12s;
  }
  .tdd-item:hover {
    background: rgba(255,230,0,.08);
    border-color: rgba(255,230,0,.2);
    color: #fff;
  }
  .tdd-item.active {
    background: rgba(255,230,0,.15);
    border-color: #ffe600;
    color: #ffe600;
  }
  .tdd-item-icon { font-size: 10px; }
  .tdd-item-sym {
    font-weight: 800;
    letter-spacing: .5px;
    font-size: 8px;
  }
  .tdd-item-name {
    font-size: 7px;
    color: rgba(255,255,255,.35);
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tdd-item.active .tdd-item-name {
    color: rgba(255,230,0,.6);
  }

  /* ── Empty State ── */
  .tdd-empty {
    text-align: center;
    padding: 20px;
    color: #555;
    font-size: 9px;
    font-family: var(--fm);
  }

  /* ── Dark-on-light variant for Lobby (comic theme) ── */
  :global(.lobby) .tdd-trigger {
    background: #fff;
    border: 2px solid #000;
    color: #000;
    box-shadow: 2px 2px 0 #000;
    border-radius: 8px;
  }
  :global(.lobby) .tdd-trigger:hover {
    background: #fff8cc;
  }
  :global(.lobby) .tdd-trigger.open {
    background: #ffe600;
  }
  :global(.lobby) .tdd-sym { color: #000; }
  :global(.lobby) .tdd-name { color: #666; }
  :global(.lobby) .tdd-pair { color: #999; }
  :global(.lobby) .tdd-arrow { color: #666; }
  :global(.lobby) .tdd-panel {
    background: #fff;
    border: 3px solid #000;
    box-shadow: 4px 4px 0 #000;
  }
  :global(.lobby) .tdd-search {
    background: #f5f5f5;
    border-bottom: 2px solid #eee;
    color: #000;
  }
  :global(.lobby) .tdd-search::placeholder { color: #aaa; }
  :global(.lobby) .tdd-cat-label { color: #888; }
  :global(.lobby) .tdd-item {
    background: #f8f8f8;
    border-color: #eee;
    color: #333;
  }
  :global(.lobby) .tdd-item:hover {
    background: #fff3b0;
    border-color: #ffcc00;
    color: #000;
  }
  :global(.lobby) .tdd-item.active {
    background: #ffe600;
    border-color: #000;
    color: #000;
  }
  :global(.lobby) .tdd-item-name { color: #888; }
  :global(.lobby) .tdd-item.active .tdd-item-name { color: #333; }
  :global(.lobby) .tdd-empty { color: #999; }
</style>
