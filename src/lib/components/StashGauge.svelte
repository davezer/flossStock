<script>
  // Props
  export let count = 0;
  export let total = 489;
  export let href = '/colors?stash=1';

  // Tweak these without touching styles
  export let size = 156;    // overall square size (px)
  export let ring = 10;     // donut stroke width (px)

  $: pct = total ? Math.round((count / total) * 100) : 0;

  // SVG geometry (viewBox 0..100)
  $: r = 50 - ring / 2;                 // keep ring fully inside viewBox
  $: C = 2 * Math.PI * r;               // circumference

  // Tiny bump on change
  let bump = false, to;
  $: {
    clearTimeout(to);
    bump = true;
    to = setTimeout(() => (bump = false), 220);
  }
</script>

<a class="g {bump ? 'bump' : ''}" href={href} style={`--size:${size}px; --ring:${ring}px;`}>
  <svg class="donut" viewBox="0 0 100 100" role="img" aria-hidden="true">
    <defs>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"  stop-color="#9b5cff"/>
        <stop offset="100%" stop-color="#00d1ff"/>
      </linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#9b5cff" flood-opacity="0.25"/>
      </filter>
    </defs>

    <!-- Track -->
    <circle cx="50" cy="50" r={r}
      fill="none" stroke="#2a2a2e" stroke-width="var(--ring)" stroke-linecap="round"/>

    <!-- Progress -->
    <circle cx="50" cy="50" r={r}
      fill="none" stroke="url(#g1)" stroke-width="var(--ring)" stroke-linecap="round" filter="url(#glow)"
      style="
        transform: rotate(-90deg);
        transform-origin: 50% 50%;
        stroke-dasharray: {C};
        stroke-dashoffset: {C * (1 - pct/100)};
        transition: stroke-dashoffset .35s ease;
      " />
  </svg>

  <div class="c">
    <div class="i" aria-hidden="true">
      <!-- Spool icon -->
      <svg viewBox="0 0 32 32" width="18" height="18">
        <rect x="5" y="4"  width="22" height="4" rx="2" fill="currentColor"/>
        <rect x="5" y="24" width="22" height="4" rx="2" fill="currentColor"/>
        <rect x="9" y="8"  width="14" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
    </div>

    <div class="count" aria-label={`In stash: ${count} of ${total}`}>
      <span class="num">{count}</span>
      <span class="sep">/</span>
      <span class="of">{total}</span>
    </div>

    <div class="pct">{pct}<span class="pct-sym">%</span></div>
    <div class="pill">stash</div>
  </div>
</a>

<style>
  .g{
    --surface: color-mix(in oklab, white 6%, transparent);
    --border:  color-mix(in oklab, white 14%, transparent);

    width: var(--size); height: var(--size);
    display: grid; place-items: center;
    position: relative; border-radius: 20px;
    background: linear-gradient(180deg, var(--surface), transparent 60%);
    border: 1px solid var(--border);
    box-shadow: 0 12px 26px rgba(0,0,0,.18);
    text-decoration: none; color: #eaeaea; overflow: hidden;
  }
  .g.bump { animation: bump .22s ease-out; }
  @keyframes bump { 0% {transform:scale(.985)} 60% {transform:scale(1.035)} 100% {transform:scale(1)} }

  /* Donut has a fixed inner margin so the ring never crowds the center */
  .donut{ position: absolute; inset: 12px; width: auto; height: auto; }

  .c{
    position: relative; z-index: 2;
    display: flex; flex-direction: column; align-items: center;
    gap: .18rem; line-height: 1; text-align: center;
    transform: translateZ(0);
  }
  .i{ color:#9b5cff; opacity:.95; margin-bottom:.05rem; }

  .count{ display:flex; align-items:baseline; gap:.25rem; }
  .num{
    font-weight:900; font-size:1.3rem; letter-spacing:.2px;
    background: linear-gradient(135deg,#fff,#d9eaff);
    -webkit-background-clip:text; background-clip:text; color:transparent;
  }
  .sep{ opacity:.7; }
  .of{ font-size:.9rem; opacity:.85; }

  .pct{
    margin-top:.1rem;
    font-weight:900; font-size:.98rem; letter-spacing:.25px;
    background: linear-gradient(135deg, #9b5cff, #00d1ff);
    -webkit-background-clip:text; background-clip:text; color:transparent;
  }
  .pct-sym{
  margin-left: .06rem;
  opacity: .9;
  background: inherit;                /* reuse .pct gradient */
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

  .pill{
    margin-top:.16rem;
    font-size:.68rem; padding:.2rem .5rem; border-radius: 999px;
    background: color-mix(in oklab, white 5%, transparent);
    border: 1px solid var(--border);
    opacity:.95;
  }

  /* Respect reduced motion */
  @media (prefers-reduced-motion: reduce){
    .g.bump { animation: none; }
    .donut circle[stroke^="url"] { transition: none !important; }
  }
</style>