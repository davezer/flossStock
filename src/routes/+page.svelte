<script>
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>ThreadIndex — Your cross-stitch color vault</title>
  <meta name="description" content="Browse every floss color, build your stash, and keep your projects in sync." />
</svelte:head>

<section class="hero card">
  <div class="hero-copy">
    <h1>Keep your threads together.</h1>
    <p class="sub">
      Browse the full color catalog, track your stash, and stitch smarter.
    </p>
    <div class="cta">
      <button class="btn primary" on:click={() => goto('/colors')}>Browse Colors</button>
      <!-- <a class="btn ghost" href="/api/auth/login">Sign in</a> -->
    </div>
  </div>
  <div class="hero-art">
    <img src="/threadindex-hero.png" alt="Cross-stitch brand artwork" />
  </div>
</section>

<section class="features">
  <article class="card f">
    <h3>Fast color search</h3>
    <p>Find any shade by code or name. Paging and sort built in.</p>
  </article>
  <article class="card f">
    <h3>Personal stash</h3>
    <p>Log what you own and what you need. One tap add/remove.</p>
  </article>
  <article class="card f">
    <h3>Project-ready</h3>
    <p>Pull lists by pattern; export for shopping or sharing.</p>
  </article>
</section>

<style>
  .hero {
    display:grid; gap: 18px; padding: 22px;
    grid-template-columns: 1.1fr 1fr;
    overflow: hidden;
  }
  @media (max-width: 900px) {
    .hero { grid-template-columns: 1fr; }
  }
  .hero-copy { padding: 16px 10px 16px 16px; }
  h1 { margin: 0 0 8px; font-size: clamp(28px, 3.4vw, 42px); letter-spacing: .2px; }
  .sub { margin: 6px 0 14px; color: var(--taupe); max-width: 60ch; }
  .cta { display:flex; gap:10px; flex-wrap: wrap; }

  .hero-art {
    position: relative; min-height: 260px; border-radius: 14px; overflow: hidden;
    background: color-mix(in oklab, var(--taupe) 30%, transparent);
    border: 1px solid var(--stroke);
  }
  .hero-art img {
    display:block; width:100%; height:100%; object-fit: cover;
    transform: scale(1.02);
  }

  .features {
    display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; margin-top: 18px;
  }
  @media (max-width: 900px) { .features { grid-template-columns: 1fr; } }
  .f { padding: 16px; }
  .f h3 { margin: 0 0 6px; }
  .f p { margin: 0; color: var(--muted); }
</style>
