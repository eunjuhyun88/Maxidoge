<!-- @deprecated — 데드코드. 터미널 페이지에서 인라인 채팅으로 대체됨 (/api/chat/messages 호출). 삭제 예정. -->
<script lang="ts">
  import { AGDEFS } from '$lib/data/agents';
  import { onMount } from 'svelte';

  interface ChatMsg {
    from: string;
    icon: string;
    color: string;
    text: string;
    time: string;
    isUser: boolean;
    isSystem?: boolean;
    typing?: boolean;
  }

  let messages: ChatMsg[] = [
    { from: 'SYSTEM', icon: '🤖', color: '#ffe600', text: 'STOCKCLAW Orchestrator v8 online. 7 agents standing by.', time: '14:00', isUser: false, isSystem: true },
  ];

  let inputText = '';
  let chatEl: HTMLDivElement;
  let isTyping = false;

  // Agent-specific response pools
  const agentResponses: Record<string, string[]> = {
    ORCHESTRATOR: [
      'Analyzing your query across all 7 agents...',
      'Running backtest on similar zone conditions... 68% win rate detected.',
      'Consensus model updated. Confidence level adjusted.',
      'Cross-referencing with on-chain data and derivatives metrics...',
    ],
    STRUCTURE: [
      'Chart structure shows CHoCH on 4H. OB zone confirmed at $95,400.',
      'BOS confirmed above $97,800. Bullish structure intact.',
      'Key support: $96,200. FVG needs to be filled before continuation.',
    ],
    FLOW: [
      'Net flow: -$128M (accumulation). Whale wallets increasing holdings.',
      'Exchange outflows rising. Smart money moving to cold storage.',
      '$67M Binance deposit flagged. Watching for sell pressure.',
    ],
    DERIV: [
      'OI +4.2% with positive delta. Longs adding aggressively.',
      'Funding rate at +0.082% — extreme. Liquidation cascade near $96.8K.',
      'Options max pain at $97,000. Market makers defending this level.',
    ],
  };

  function sendMsg() {
    if (!inputText.trim()) return;
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;

    // Add user message (right-aligned)
    messages = [...messages, {
      from: 'YOU', icon: '🐕', color: '#ffe600', text: inputText, time,
      isUser: true
    }];

    const q = inputText;
    inputText = '';
    scrollBottom();

    // Show typing indicator
    isTyping = true;

    // Determine which agent to respond
    const mentionedAgent = AGDEFS.find(ag => q.toLowerCase().includes(`@${ag.name.toLowerCase()}`));

    setTimeout(() => {
      isTyping = false;

      if (mentionedAgent) {
        // Direct agent response
        const pool = agentResponses[mentionedAgent.name] || agentResponses.ORCHESTRATOR;
        const resp = pool[Math.floor(Math.random() * pool.length)];
        messages = [...messages, {
          from: mentionedAgent.name, icon: mentionedAgent.icon, color: mentionedAgent.color,
          text: resp, time, isUser: false
        }];
      } else {
        // Orchestrator response
        const pool = agentResponses.ORCHESTRATOR;
        const resp = pool[Math.floor(Math.random() * pool.length)];
        messages = [...messages, {
          from: 'ORCHESTRATOR', icon: '🧠', color: '#ff2d9b',
          text: resp, time, isUser: false
        }];
      }
      scrollBottom();
    }, 800 + Math.random() * 600);

    scrollBottom();
  }

  function scrollBottom() {
    setTimeout(() => {
      if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
    }, 50);
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter') sendMsg();
  }

  function insertMention(name: string) {
    inputText = inputText ? `${inputText} @${name} ` : `@${name} `;
  }

  onMount(() => {
    scrollBottom();
  });
</script>

<div class="tchat">
  <!-- Header -->
  <div class="thead">
    <span class="thi">🖥</span>
    <span class="tht">TERMINAL</span>
    <span class="thv">v8.0</span>
    <span class="th-count">{messages.length} msgs</span>
    <div class="thdot"></div>
  </div>

  <!-- Messages Area -->
  <div class="tmsg" bind:this={chatEl}>
    {#each messages as msg}
      {#if msg.isSystem}
        <!-- SYSTEM message — centered banner -->
        <div class="cm-system">
          <span class="cms-icon">{msg.icon}</span>
          <span class="cms-text">{msg.text}</span>
        </div>
      {:else if msg.isUser}
        <!-- USER message — right aligned -->
        <div class="cm cm-user">
          <div class="cm-bubble cm-bubble-user">
            <div class="cmb-text">{msg.text}</div>
            <div class="cmb-meta">
              <span class="cmb-time">{msg.time}</span>
              <span class="cmb-check">✓✓</span>
            </div>
          </div>
          <div class="cm-avatar cm-avatar-user">
            <span>{msg.icon}</span>
          </div>
        </div>
      {:else}
        <!-- AGENT message — left aligned -->
        <div class="cm cm-agent">
          <div class="cm-avatar cm-avatar-agent" style="border-color:{msg.color}">
            <span>{msg.icon}</span>
          </div>
          <div class="cm-bubble cm-bubble-agent">
            <div class="cmb-name" style="color:{msg.color}">{msg.from}</div>
            <div class="cmb-text">{msg.text}</div>
            <div class="cmb-meta">
              <span class="cmb-time">{msg.time}</span>
            </div>
          </div>
        </div>
      {/if}
    {/each}

    <!-- Typing indicator -->
    {#if isTyping}
      <div class="cm cm-agent">
        <div class="cm-avatar cm-avatar-agent" style="border-color:#ff2d9b">
          <span>🧠</span>
        </div>
        <div class="cm-bubble cm-bubble-agent cm-typing">
          <div class="typing-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Input Area -->
  <div class="tinput">
    <div class="tags">
      {#each AGDEFS.slice(0, 5) as ag}
        <button class="tag" style="border-color:{ag.color};color:{ag.color}" on:click={() => insertMention(ag.name)}>
          <span class="tag-icon">{ag.icon}</span>@{ag.name}
        </button>
      {/each}
    </div>
    <div class="irow">
      <input type="text" bind:value={inputText} on:keydown={handleKey} placeholder="Ask the orchestrator... (@STRUCTURE, @FLOW...)" />
      <button class="sbtn" on:click={sendMsg} disabled={!inputText.trim()}>⚡</button>
    </div>
  </div>
</div>

<style>
  .tchat {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0a0a1a;
    border-left: 2px solid rgba(255,230,0,.08);
    border-right: 2px solid rgba(255,230,0,.08);
  }

  /* Header */
  .thead {
    padding: 5px 10px;
    background: linear-gradient(90deg, #1a1a3a, #2a1a3a);
    border-bottom: 2px solid #333;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .thi { font-size: 10px; }
  .tht { font-size: 10px; font-weight: 900; font-family: var(--fd); color: #fff; letter-spacing: 2px; }
  .thv { font-size: 8px; color: #888; font-family: var(--fm); }
  .th-count { font-size: 7px; color: rgba(255,255,255,.25); font-family: var(--fm); }
  .thdot {
    margin-left: auto;
    width: 6px; height: 6px; border-radius: 50%;
    background: #00ff88;
    box-shadow: 0 0 6px #00ff88;
    animation: pulse 2s infinite;
  }

  /* Messages */
  .tmsg {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
  }
  .tmsg::-webkit-scrollbar { width: 3px; }
  .tmsg::-webkit-scrollbar-track { background: transparent; }
  .tmsg::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

  /* System message */
  .cm-system {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 4px 12px;
    background: rgba(255,230,0,.04);
    border: 1px dashed rgba(255,230,0,.15);
    border-radius: 20px;
    margin: 2px 20px;
  }
  .cms-icon { font-size: 10px; }
  .cms-text {
    font-size: 8px;
    font-family: var(--fm);
    color: rgba(255,230,0,.6);
    letter-spacing: .5px;
    text-align: center;
  }

  /* Message row */
  .cm {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    max-width: 92%;
  }

  /* User messages — right */
  .cm-user {
    align-self: flex-end;
    flex-direction: row;
  }

  /* Agent messages — left */
  .cm-agent {
    align-self: flex-start;
    flex-direction: row;
  }

  /* Avatars */
  .cm-avatar {
    width: 24px; height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 12px;
  }
  .cm-avatar-user {
    background: rgba(255,230,0,.15);
    border: 1.5px solid rgba(255,230,0,.4);
  }
  .cm-avatar-agent {
    background: rgba(255,255,255,.05);
    border: 1.5px solid;
  }

  /* Bubbles */
  .cm-bubble {
    padding: 6px 10px;
    border-radius: 10px;
    position: relative;
    min-width: 60px;
  }
  .cm-bubble-user {
    background: linear-gradient(135deg, rgba(255,230,0,.12), rgba(255,200,0,.06));
    border: 1px solid rgba(255,230,0,.2);
    border-bottom-right-radius: 3px;
  }
  .cm-bubble-agent {
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.08);
    border-bottom-left-radius: 3px;
  }

  /* Bubble content */
  .cmb-name {
    font-size: 8px;
    font-weight: 900;
    font-family: var(--fd);
    letter-spacing: 1px;
    margin-bottom: 2px;
  }
  .cmb-text {
    font-size: 9px;
    color: #ddd;
    font-family: var(--fm);
    line-height: 1.5;
    word-break: break-word;
  }
  .cm-bubble-user .cmb-text {
    color: rgba(255,255,255,.9);
  }
  .cmb-meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
    margin-top: 2px;
  }
  .cmb-time {
    font-size: 7px;
    color: rgba(255,255,255,.25);
    font-family: var(--fm);
  }
  .cmb-check {
    font-size: 7px;
    color: rgba(255,230,0,.5);
  }

  /* Typing indicator */
  .cm-typing {
    padding: 8px 14px;
  }
  .typing-dots {
    display: flex;
    gap: 3px;
    align-items: center;
  }
  .typing-dots span {
    width: 4px; height: 4px;
    border-radius: 50%;
    background: rgba(255,255,255,.3);
    animation: typingBounce 1.2s infinite;
  }
  .typing-dots span:nth-child(2) { animation-delay: .2s; }
  .typing-dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes typingBounce {
    0%,60%,100% { transform: translateY(0); opacity: .3; }
    30% { transform: translateY(-4px); opacity: 1; }
  }

  /* Input area */
  .tinput {
    flex-shrink: 0;
    padding: 6px 8px;
    border-top: 2px solid #333;
    background: rgba(0,0,0,.3);
  }
  .tags {
    display: flex;
    gap: 3px;
    margin-bottom: 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tags::-webkit-scrollbar { display: none; }
  .tag {
    font-size: 7px;
    padding: 2px 5px;
    border-radius: 4px;
    border: 1px solid;
    font-family: var(--fm);
    font-weight: 700;
    opacity: .5;
    cursor: pointer;
    transition: all .2s;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 2px;
    background: transparent;
  }
  .tag-icon { font-size: 8px; }
  .tag:hover { opacity: 1; background: rgba(255,255,255,.05); }

  .irow {
    display: flex;
    gap: 4px;
  }
  .irow input {
    flex: 1;
    padding: 7px 10px;
    border-radius: 10px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.1);
    color: #fff;
    font-size: 9px;
    font-family: var(--fm);
    outline: none;
    transition: border-color .2s, box-shadow .2s;
  }
  .irow input::placeholder { color: #555; }
  .irow input:focus {
    border-color: rgba(255,230,0,.4);
    box-shadow: 0 0 8px rgba(255,230,0,.15);
  }
  .sbtn {
    width: 34px;
    border-radius: 10px;
    background: #ffe600;
    border: 2px solid #000;
    color: #000;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 2px 2px 0 #000;
    transition: all .15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sbtn:hover:not(:disabled) { background: #ffcc00; transform: translate(-1px,-1px); box-shadow: 3px 3px 0 #000; }
  .sbtn:disabled { opacity: .3; cursor: default; }

  @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .4 } }
</style>
