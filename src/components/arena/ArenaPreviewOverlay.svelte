<script lang="ts">
  import type { ArenaPreviewDisplay } from '$lib/arena/state/arenaTypes';

  interface Props {
    previewVisible?: boolean;
    previewDisplay?: ArenaPreviewDisplay | null;
    onConfirmPreview?: () => void;
  }

  let {
    previewVisible = false,
    previewDisplay = null,
    onConfirmPreview = () => {},
  }: Props = $props();
</script>

{#if previewVisible && previewDisplay}
  <div class="preview-overlay">
    <div class="preview-card">
      <div class="preview-header">
        <span class="prev-icon">👁</span>
        <span class="prev-title">POSITION PREVIEW</span>
      </div>
      <div class="preview-dir {previewDisplay.dirClass}">
        {previewDisplay.dirIcon} {previewDisplay.dirLabel}
      </div>
      <div class="preview-levels">
        <div class="prev-row">
          <span class="prev-lbl">ENTRY</span>
          <span class="prev-val">{previewDisplay.entryLabel}</span>
        </div>
        <div class="prev-row tp">
          <span class="prev-lbl">TP</span>
          <span class="prev-val">{previewDisplay.tpLabel}</span>
        </div>
        <div class="prev-row sl">
          <span class="prev-lbl">SL</span>
          <span class="prev-val">{previewDisplay.slLabel}</span>
        </div>
      </div>
      <div class="preview-rr">
        R:R <span class="prev-rr-val">{previewDisplay.rrLabel}</span>
      </div>
      <div class="preview-config">{previewDisplay.configLabel}</div>
      <button class="preview-confirm" onclick={onConfirmPreview}>
        ✅ CONFIRM & SCOUT
      </button>
    </div>
  </div>
{/if}

<style>
  .preview-overlay {
    position: absolute;
    inset: 0;
    z-index: 28;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,.15);
    animation: fadeIn .3s ease;
  }
  .preview-card {
    background: #fff;
    border: 4px solid #000;
    border-radius: 16px;
    padding: 16px 22px;
    box-shadow: 6px 6px 0 #000;
    text-align: center;
    min-width: 240px;
    animation: popIn .3s ease;
  }
  .preview-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-bottom: 3px solid #000;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .prev-icon { font-size: 18px; }
  .prev-title {
    font-family: var(--fc);
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #000;
  }
  .preview-dir {
    font-family: var(--fc);
    font-size: 24px;
    font-weight: 900;
    letter-spacing: 3px;
    margin-bottom: 8px;
  }
  .preview-dir.long { color: #00cc66; }
  .preview-dir.short { color: #ff2d55; }
  .preview-dir.neutral { color: #ffaa00; }
  .preview-levels {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }
  .prev-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    border-radius: 6px;
    background: #f8f8f8;
  }
  .prev-row.tp { background: rgba(0,255,136,.1); }
  .prev-row.sl { background: rgba(255,45,85,.08); }
  .prev-lbl {
    font-family: var(--fd);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #888;
  }
  .prev-val {
    font-family: var(--fd);
    font-size: 12px;
    font-weight: 900;
    color: #000;
  }
  .preview-rr {
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #888;
    background: #000;
    border-radius: 8px;
    padding: 4px 12px;
    margin-bottom: 6px;
    display: inline-block;
  }
  .prev-rr-val { font-size: 14px; color: #E8967D; }
  .preview-config {
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    color: #aaa;
    letter-spacing: 1px;
    margin-bottom: 10px;
  }
  .preview-confirm {
    font-family: var(--fd);
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 2px;
    padding: 10px 28px;
    border: 3px solid #000;
    border-radius: 14px;
    background: linear-gradient(180deg, #00ff88, #00cc66);
    color: #000;
    cursor: pointer;
    box-shadow: 3px 3px 0 #000;
    transition: all .15s;
  }
  .preview-confirm:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 #000;
    background: linear-gradient(180deg, #33ffaa, #00dd77);
  }
  .preview-confirm:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 #000;
  }
  @keyframes popIn { from { transform: translate(-50%, -50%) scale(.8); opacity: 0 } to { transform: translate(-50%, -50%) scale(1); opacity: 1 } }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

  @media (max-width: 768px) {
    .preview-overlay { position: fixed; inset: 0; z-index: 65; }
    .preview-card { width: calc(100% - 32px); max-width: 340px; }
  }
</style>
