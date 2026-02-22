<script lang="ts">
  import '../app.css';
  import Header from '../components/layout/Header.svelte';
  import BottomBar from '../components/layout/BottomBar.svelte';
  import WalletModal from '../components/modals/WalletModal.svelte';
  import NotificationTray from '../components/shared/NotificationTray.svelte';
  import ToastStack from '../components/shared/ToastStack.svelte';
  import P0Banner from '../components/shared/P0Banner.svelte';
  import { page } from '$app/stores';
  import { gameState } from '$lib/stores/gameState';
  import { derived } from 'svelte/store';
  import { onMount, onDestroy } from 'svelte';
  import { fetchPrices, fetch24hrMulti, subscribeMiniTicker } from '$lib/api/binance';
  import { updatePrice, updatePrices as updatePriceStore, updatePriceFull } from '$lib/stores/priceStore';

  let { children } = $props();

  // Derive isArena from page store (only actual /arena/* pages, not home /)
  const isArena = derived(page, $p => $p.url.pathname.startsWith('/arena'));

  // Sync currentView store from URL via effect
  $effect(() => {
    const path = $page.url.pathname;
    const view = path.startsWith('/terminal') ? 'terminal'
      : path.startsWith('/passport') ? 'passport'
      : path.startsWith('/arena') ? 'arena'
      : 'arena';
    gameState.update(s => {
      if (s.currentView !== view) return { ...s, currentView: view };
      return s;
    });
  });

  // ─── S-03: Global Price Feed (single WS → priceStore) ──────
  const TRACKED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const;
  const SYMBOL_MAP: Record<string, string> = { BTCUSDT: 'BTC', ETHUSDT: 'ETH', SOLUSDT: 'SOL' };

  let globalWsCleanup: (() => void) | null = null;

  onMount(async () => {
    // 1) REST bootstrap — 초기 가격 + 24h 통계 세팅
    try {
      const [prices, tickers24] = await Promise.all([
        fetchPrices([...TRACKED_SYMBOLS]),
        fetch24hrMulti([...TRACKED_SYMBOLS]).catch(() => [] as any[]),
      ]);
      // 24hr 풀 데이터가 있으면 사용, 없으면 가격만
      const tickerMap = new Map<string, any>();
      for (const t of tickers24) { if (t?.symbol) tickerMap.set(t.symbol, t); }

      const updates: Record<string, number> = {};
      for (const [sym, price] of Object.entries(prices)) {
        const key = SYMBOL_MAP[sym];
        if (!key || !Number.isFinite(price) || price <= 0) continue;
        updates[key] = price;
        const t24 = tickerMap.get(sym);
        if (t24) {
          updatePriceFull(key, {
            price,
            ts: Date.now(),
            source: 'rest',
            change24h: parseFloat(t24.priceChangePercent) || 0,
            high24h: parseFloat(t24.highPrice) || 0,
            low24h: parseFloat(t24.lowPrice) || 0,
            volume24h: parseFloat(t24.quoteVolume) || 0,
          });
        } else {
          updatePrice(key, price, 'rest');
        }
      }
      if (Object.keys(updates).length) {
        // gameState 가격도 동기화 (레거시 호환)
        gameState.update(s => ({
          ...s,
          prices: {
            BTC: updates.BTC ?? s.prices.BTC,
            ETH: updates.ETH ?? s.prices.ETH,
            SOL: updates.SOL ?? s.prices.SOL,
          },
          bases: {
            BTC: updates.BTC ?? s.bases.BTC,
            ETH: updates.ETH ?? s.bases.ETH,
            SOL: updates.SOL ?? s.bases.SOL,
          },
        }));
      }
    } catch (e) {
      console.warn('[Layout] Failed to bootstrap prices, using defaults');
    }

    // 2) WS 구독 — 실시간 가격 + 24h% 업데이트 → priceStore (단일 소스)
    try {
      let _pending: Record<string, number> = {};
      let _flushTimer: ReturnType<typeof setTimeout> | null = null;

      // 24h 통계는 자주 바뀌지 않으므로 5초 간격으로 batch 처리
      type FullEntry = { price: number; change24h: number; high24h: number; low24h: number; volume24h: number };
      let _pendingFull: Record<string, FullEntry> = {};
      let _fullFlushTimer: ReturnType<typeof setTimeout> | null = null;

      globalWsCleanup = subscribeMiniTicker([...TRACKED_SYMBOLS], (update) => {
        Object.assign(_pending, update);
        if (_flushTimer) return;
        _flushTimer = setTimeout(() => {
          _flushTimer = null;
          const batch = _pending;
          _pending = {};
          const mapped: Record<string, number> = {};
          for (const [sym, price] of Object.entries(batch)) {
            const key = SYMBOL_MAP[sym];
            if (key && Number.isFinite(price) && price > 0) mapped[key] = price;
          }
          if (Object.keys(mapped).length) {
            updatePriceStore(mapped, 'ws');
            // gameState 가격도 동기화 (레거시 호환)
            gameState.update(s => ({
              ...s,
              prices: {
                BTC: mapped.BTC ?? s.prices.BTC,
                ETH: mapped.ETH ?? s.prices.ETH,
                SOL: mapped.SOL ?? s.prices.SOL,
              },
            }));
          }
        }, 350);
      }, (fullUpdate) => {
        // onUpdateFull — batch로 모아서 5초마다 flush (24h% 는 초 단위 갱신 불필요)
        for (const [sym, data] of Object.entries(fullUpdate)) {
          const key = SYMBOL_MAP[sym];
          if (key && Number.isFinite(data.price) && data.price > 0) {
            _pendingFull[key] = data;
          }
        }
        if (_fullFlushTimer) return;
        _fullFlushTimer = setTimeout(() => {
          _fullFlushTimer = null;
          const batch = _pendingFull;
          _pendingFull = {};
          for (const [key, data] of Object.entries(batch)) {
            updatePriceFull(key, {
              price: data.price,
              ts: Date.now(),
              source: 'ws',
              change24h: data.change24h,
              high24h: data.high24h,
              low24h: data.low24h,
              volume24h: data.volume24h,
            });
          }
        }, 5000);
      });
    } catch (e) {
      console.warn('[Layout] Global WS connection failed');
    }
  });

  onDestroy(() => {
    if (globalWsCleanup) globalWsCleanup();
  });
</script>

<div id="app">
  <Header />
  <P0Banner />
  <div id="main-content">
    {@render children()}
  </div>
  {#if $isArena}
    <BottomBar />
  {/if}
</div>

<!-- Global Wallet Modal -->
<WalletModal />

<!-- Global Notification Tray (bottom-right bell + slide-up panel) -->
<NotificationTray />

<!-- Global Toast Stack (bottom-right, above bell) -->
<ToastStack />

<style>
  #app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding-top: 42px;
    overflow: hidden;
    position: relative;
  }
  #main-content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
</style>
