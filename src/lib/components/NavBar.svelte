<script>
  import { page } from '$app/stores';

  export let title = 'FlossStock';
  export let links = [
    { href: '/', label: 'Home' },
    { href: '/colors', label: 'Colors' }
  ];

  // Normalize both the current path and hrefs so trailing slashes don’t confuse matching
  $: pathname = ($page.url?.pathname || '/').replace(/\/+$/, '') || '/';

  const isActive = (href) => {
    const clean = (href || '/').replace(/\/+$/, '') || '/';
    if (clean === '/') return pathname === '/';                    // Home only on exact “/”
    return pathname === clean || pathname.startsWith(clean + '/'); // Section and its children
  };
</script>

<nav class="topbar">
  <a href="/" class="brand" aria-label={title}>🧵 {title}</a>
  {#each links as l}
    <a
      href={l.href}
      class="tab {isActive(l.href) ? 'active' : ''}"
      aria-current={isActive(l.href) ? 'page' : undefined}
    >
      {l.label}
    </a>
  {/each}
</nav>

<style>
  :global(:root){ --topbar-h: 52px; }
  .topbar{
    position:sticky; top:0; z-index:40;
    display:flex; gap:.6rem; align-items:center;
    padding:.6rem 1rem;
    background: color-mix(in oklab, #0f0f12 92%, black);
    border-bottom:1px solid color-mix(in oklab, white 14%, transparent);
    backdrop-filter: blur(6px) saturate(1.15);
  }
  .brand{
    text-decoration:none; font-weight:900; letter-spacing:.3px;
    background: linear-gradient(135deg, #9b5cff, #00d1ff);
    -webkit-background-clip:text; background-clip:text; color:transparent;
    margin-right:.2rem;
  }
  .tab{
    text-decoration:none; color:inherit; opacity:.85;
    padding:.28rem .6rem; border-radius:10px; border:1px solid transparent;
  }
  .tab.active{
    background: color-mix(in oklab, white 5%, transparent);
    border-color: color-mix(in oklab, white 14%, transparent);
    opacity:1;
  }
</style>
