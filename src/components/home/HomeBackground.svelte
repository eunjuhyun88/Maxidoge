<!-- HomeBackground — stars + orbs + CRT overlay (purely decorative) -->

<div class="stars" aria-hidden="true"></div>
<div class="crt-overlay" aria-hidden="true"></div>
<div class="orbs" aria-hidden="true">
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>
</div>

<style>
  .stars {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 0;
    background:
      radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.7) 50%, transparent 50%),
      radial-gradient(1px 1px at 25% 35%, rgba(255,255,255,0.5) 50%, transparent 50%),
      radial-gradient(1.5px 1.5px at 40% 8%, rgba(255,255,255,0.8) 50%, transparent 50%),
      radial-gradient(1px 1px at 55% 60%, rgba(255,255,255,0.4) 50%, transparent 50%),
      radial-gradient(1px 1px at 70% 22%, rgba(255,255,255,0.6) 50%, transparent 50%),
      radial-gradient(1.5px 1.5px at 85% 45%, rgba(255,255,255,0.7) 50%, transparent 50%),
      radial-gradient(1px 1px at 15% 70%, rgba(255,255,255,0.5) 50%, transparent 50%),
      radial-gradient(1px 1px at 92% 80%, rgba(255,255,255,0.6) 50%, transparent 50%),
      radial-gradient(1px 1px at 62% 18%, rgba(232,150,125,0.4) 50%, transparent 50%),
      radial-gradient(1px 1px at 28% 52%, rgba(232,150,125,0.25) 50%, transparent 50%),
      radial-gradient(1px 1px at 82% 72%, rgba(232,150,125,0.3) 50%, transparent 50%),
      radial-gradient(1px 1px at 45% 92%, rgba(232,150,125,0.25) 50%, transparent 50%);
    background-size: 300px 300px;
    animation: twinkle 6s ease-in-out infinite alternate;
  }
  @keyframes twinkle { 0% { opacity: 0.5; } 100% { opacity: 1; } }

  .crt-overlay {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 3px,
      rgba(0,0,0,0.06) 3px,
      rgba(0,0,0,0.06) 4px
    );
    opacity: 0.5;
  }

  .orbs {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 0;
    overflow: hidden;
  }
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.10;
  }
  .orb-1 {
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(232,150,125,0.6), transparent 70%);
    top: 10%; left: -5%;
    animation: orbFloat1 20s ease-in-out infinite alternate;
  }
  .orb-2 {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(232,150,125,0.35), transparent 70%);
    top: 50%; right: -8%;
    animation: orbFloat2 25s ease-in-out infinite alternate;
  }
  .orb-3 {
    width: 450px; height: 450px;
    background: radial-gradient(circle, rgba(135,220,190,0.5), transparent 70%);
    bottom: 15%; left: 40%;
    animation: orbFloat3 22s ease-in-out infinite alternate;
  }
  @keyframes orbFloat1 {
    0% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(80px, 60px) scale(1.15); }
    100% { transform: translate(-40px, 120px) scale(0.9); }
  }
  @keyframes orbFloat2 {
    0% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-60px, -80px) scale(1.1); }
    100% { transform: translate(40px, -40px) scale(0.95); }
  }
  @keyframes orbFloat3 {
    0% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-50px, 40px) scale(1.1); }
    100% { transform: translate(30px, -60px) scale(0.95); }
  }

  @media (prefers-reduced-motion: reduce) {
    .orb,
    .stars {
      animation: none !important;
    }
  }
</style>
