<script lang="ts">
  import { gameState } from '$lib/stores/gameState';
  import { AGDEFS, SOURCES } from '$lib/data/agents';

  let state = $gameState;
  $: state = $gameState;

  // Active agents for this match
  $: activeAgents = AGDEFS.filter(a => state.selectedAgents.includes(a.id));
</script>

<div class="battle-stage">
  <!-- Background Layers -->
  <div class="sunburst"></div>
  <div class="halftone"></div>
  <div class="ground"></div>

  <!-- Floating Comic Elements -->
  <div class="cloud" style="top:8%;left:12%;animation-delay:0s">💥</div>
  <div class="cloud" style="top:15%;right:15%;animation-delay:2s">⭐</div>
  <div class="cloud" style="top:5%;left:55%;animation-delay:4s">💰</div>

  <!-- Data Sources -->
  {#each SOURCES as src}
    <div class="dsrc" style="left:{src.x * 100}%;top:{src.y * 100}%">
      <div class="di" style="background:#fff;border-color:{src.color}">{src.icon}</div>
      <div class="dl">{src.label}</div>
    </div>
  {/each}

  <!-- Council Table -->
  <div id="ctable" class:on={state.phase === 'council' || state.phase === 'verdict'}>
    <span class="cl">COUNCIL</span>
  </div>

  <!-- Agent Sprites -->
  {#each activeAgents as ag, i}
    {@const xPos = 50 + (i - Math.floor(activeAgents.length / 2)) * 12}
    <div
      class="ag idle"
      style="left:{xPos}%;top:52%;--glow:{ag.color}"
    >
      <div class="sha"></div>
      <div class="wr">
        <div class="react"></div>
        <div class="agent-sprite" style="border-color:{ag.color};box-shadow:0 0 12px {ag.color}40">
          <span class="sprite-icon">{ag.icon}</span>
        </div>
        <div class="rbadge" style="border-color:{ag.color};color:{ag.color}">{ag.icon}</div>
        <div class="nm">{ag.name}</div>
        <div class="ebar"><div class="efill" style="width:100%;background:{ag.color}"></div></div>
      </div>
    </div>
  {/each}

  <!-- Phase Display -->
  <div id="phase">
    <div class="pt">PHASE</div>
    <div class="pn">{state.phase.toUpperCase()}</div>
    <div class="ptm">{Math.ceil(state.timer)}s</div>
  </div>

  <!-- Findings Panel -->
  <div id="findings">
    {#each activeAgents.slice(0, 3) as ag}
      <div class="fcard vis">
        <div class="fh">
          <span class="fi">{ag.icon}</span>
          <span class="fn">{ag.name}</span>
          <span class="fdir {ag.dir.toLowerCase()}">{ag.dir}</span>
        </div>
        <div class="fd">{ag.finding.title}</div>
        <div class="fconf">
          <div class="fconf-bar">
            <div class="fconf-fill" style="width:{ag.conf}%;background:{ag.color}"></div>
          </div>
          <span class="fconf-val">{ag.conf}%</span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .battle-stage {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #ffe600;
    background-image: repeating-conic-gradient(#ffcc00 0deg 10deg, #ffe600 10deg 20deg);
    border-left: 4px solid #000;
  }
  .sunburst {
    position: absolute; inset: -50%; z-index: 0; pointer-events: none;
    background: repeating-conic-gradient(transparent 0deg 8deg, rgba(255,180,0,.08) 8deg 16deg);
    animation: sunSpin 60s linear infinite;
  }
  @keyframes sunSpin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
  .halftone {
    position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background-image: radial-gradient(circle, rgba(255,140,0,.12) 1.5px, transparent 1.5px);
    background-size: 10px 10px; mix-blend-mode: multiply;
  }
  .ground {
    position: absolute; bottom: 0; left: 0; right: 0; height: 12%; z-index: 2; pointer-events: none;
    background: #00cc44; border-top: 4px solid #000;
    box-shadow: inset 0 4px 0 rgba(255,255,255,.15);
  }
  .ground::before {
    content: ''; position: absolute; inset: 0;
    background-image: radial-gradient(circle, rgba(0,0,0,.08) 2px, transparent 2px);
    background-size: 12px 12px;
  }

  /* Floating Elements */
  .cloud {
    position: absolute; z-index: 2; pointer-events: none; opacity: .25; font-size: 28px;
    animation: stickerFloat 8s ease-in-out infinite;
    filter: drop-shadow(2px 2px 0 rgba(0,0,0,.3));
  }
  @keyframes stickerFloat { 0%,100% { transform: translateY(0) rotate(-5deg) } 50% { transform: translateY(-12px) rotate(5deg) } }

  /* Data Sources */
  .dsrc {
    position: absolute; z-index: 6; display: flex; flex-direction: column; align-items: center; gap: 2px;
    pointer-events: none; transform: translate(-50%, -50%);
  }
  .di {
    width: 40px; height: 40px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center; font-size: 16px;
    border: 3px solid #000; box-shadow: 3px 3px 0 #000;
    transition: all .15s;
  }
  .dl {
    font-size: 6px; color: #000; letter-spacing: 1.5px; font-family: var(--fd); font-weight: 900;
    background: rgba(255,255,255,.85); padding: 1px 4px; border-radius: 6px;
  }

  /* Council Table */
  #ctable {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 90px; height: 55px; border-radius: 50%;
    border: 3px dashed rgba(0,0,0,.15); background: rgba(255,255,255,.08);
    display: flex; align-items: center; justify-content: center;
    z-index: 4; transition: all .25s;
  }
  #ctable.on {
    border-color: #000; border-style: solid; border-width: 4px;
    background: rgba(255,255,255,.2);
    box-shadow: 0 0 30px rgba(255,45,155,.2), 4px 4px 0 rgba(0,0,0,.3);
  }
  #ctable .cl { font-size: 6px; color: rgba(0,0,0,.25); letter-spacing: 2px; font-family: var(--fcomic); font-weight: 900; }
  #ctable.on .cl { color: #000; }

  /* Agent Sprites */
  .ag {
    position: absolute; z-index: 10; width: 68px; text-align: center;
    pointer-events: none; transform: translate(-50%, -50%);
  }
  .ag .sha {
    position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%);
    width: 48px; height: 8px; background: rgba(0,0,0,.5); border-radius: 50%; filter: blur(2px);
  }
  .ag .wr { position: relative; display: flex; flex-direction: column; align-items: center; }
  .ag.idle .wr { animation: aI .7s ease-in-out infinite; }
  @keyframes aI { 0%,100% { transform: translateY(0) rotate(0) } 25% { transform: translateY(-2px) rotate(-1deg) } 75% { transform: translateY(-2px) rotate(1deg) } }

  .agent-sprite {
    width: 62px; height: 62px;
    border-radius: 16px; border: 4px solid;
    display: flex; align-items: center; justify-content: center;
    background: #fff;
    box-shadow: 4px 4px 0 #000;
    transition: all .15s;
  }
  .sprite-icon { font-size: 28px; }
  .ag .rbadge {
    position: absolute; top: -4px; right: -4px;
    width: 18px; height: 18px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; border: 1.5px solid; z-index: 3;
    background: rgba(255,255,255,.9);
  }
  .ag .react { position: absolute; top: -8px; left: 50%; transform: translateX(-50%); font-size: 14px; opacity: 0; }
  .ag .nm {
    font-size: 7px; font-weight: 900; letter-spacing: 1.5px; margin-top: 4px;
    font-family: var(--fcomic); color: #000;
    background: rgba(255,255,255,.85); padding: 1px 5px; border-radius: 6px;
  }
  .ag .ebar {
    width: 48px; height: 5px; margin: 2px auto 0;
    border-radius: 4px; background: #ddd; overflow: hidden; border: 2px solid #000;
  }
  .ag .efill { height: 100%; border-radius: 2px; transition: width .3s; }

  /* Phase Display */
  #phase {
    position: absolute; top: 8px; right: 8px; z-index: 15;
    background: #fff; border-radius: 12px; padding: 6px 12px;
    border: 3px solid #000; box-shadow: 3px 3px 0 #000;
  }
  #phase .pt { font-size: 7px; color: #888; letter-spacing: 2px; font-family: var(--fm); font-weight: 700; }
  #phase .pn {
    font-size: 12px; font-weight: 900; font-family: var(--fc); letter-spacing: 2px; color: #000;
  }
  #phase .ptm { font-size: 9px; font-family: var(--fm); color: #666; font-weight: 700; }

  /* Finding Cards */
  #findings {
    position: absolute; top: 34px; left: 8px; width: 155px; z-index: 15;
    display: flex; flex-direction: column; gap: 4px; pointer-events: none;
  }
  .fcard {
    background: #fff; border-radius: 8px; padding: 6px 8px;
    border: 3px solid #000; box-shadow: 3px 3px 0 #000;
    font-family: var(--fm); color: #000;
    opacity: 0; transform: translateX(-30px) scale(.9);
    transition: opacity .2s, transform .2s;
  }
  .fcard.vis { opacity: 1; transform: none; }
  .fcard .fh { display: flex; align-items: center; gap: 4px; margin-bottom: 3px; }
  .fcard .fi { font-size: 10px; }
  .fcard .fn { font-size: 7px; font-weight: 900; letter-spacing: 1px; }
  .fcard .fdir {
    font-size: 7px; padding: 1px 5px; border-radius: 10px; font-weight: 900;
    margin-left: auto; border: 2px solid #000;
  }
  .fdir.long { background: #00ff88; color: #000; }
  .fdir.short { background: #ff2d55; color: #fff; }
  .fdir.neutral { background: #ffaa00; color: #000; }
  .fcard .fd { font-size: 7px; color: #444; line-height: 1.4; }
  .fcard .fconf { margin-top: 3px; display: flex; align-items: center; gap: 4px; }
  .fcard .fconf-bar { flex: 1; height: 4px; border-radius: 3px; background: #eee; overflow: hidden; border: 1px solid #000; }
  .fcard .fconf-fill { height: 100%; border-radius: 2px; transition: width .4s; }
  .fcard .fconf-val { font-size: 7px; font-weight: 900; width: 20px; text-align: right; }
</style>
