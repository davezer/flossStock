<script>
  import ThemeToggle from './ThemeToggle.svelte';
  export let user = null;

  // avatar menu open/close
  let userMenuOpen = false;

  // mobile nav drawer open/close
  let navOpen = false;

  // shared nav links
  const links = [
    { href: '/colors', label: 'Colors' },
    { href: '/inventory', label: 'Inventory' },
    { href: '/scan', label: 'Scan PDF' }
  ];

  $: avatarSrc =
    (user?.avatarUrl || user?.avatar_url) // from DB via Lucia
    || (user?.avatar_key ? `/api/avatar/${user.avatar_key}` : '');

  // --- MD5 (tiny implementation, no deps) ---
  function md5(str) {
    return crypto.subtle
      .digest('MD5', new TextEncoder().encode(str))
      .then((buf) =>
        Array.from(new Uint8Array(buf))
          .map((x) => x.toString(16).padStart(2, '0'))
          .join('')
      );
  }

  let gravatarUrl = '';
  $: if (user?.email) {
    md5(user.email.trim().toLowerCase()).then((hash) => {
      // default=404 → lets us detect & fallback to initials
      gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=64&d=404`;
    });
  }

  function initials(email) {
    const name = (email || '').split('@')[0] || 'U';
    const parts = name
      .replace(/[^a-z0-9_-]/gi, ' ')
      .trim()
      .split(/\s+|_|-/)
      .filter(Boolean);
    const a = parts[0]?.[0] ?? 'U';
    const b = parts[1]?.[0] ?? '';
    return (a + b).toUpperCase();
  }

  function colorFrom(email) {
    let h = 0;
    for (let i = 0; i < (email || '').length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 65% 40%)`;
  }

  let avatarBroken = false;
  function handleError() {
    avatarBroken = true;
  }

  // close user menu on outside click / ESC
  function onDocClick(e) {
    if (!userMenuOpen) return;
    const root = document.getElementById('nav-user-menu');
    if (root && !root.contains(e.target)) userMenuOpen = false;
  }
  function onKey(e) {
    if (e.key === 'Escape') {
      userMenuOpen = false;
      navOpen = false;
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('click', onDocClick);
    window.addEventListener('keydown', onKey);
  }

  $: label = user ? (user.email?.split('@')[0] ?? 'Account') : 'Sign in';

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.reload();
  }

  function toggleNav() {
    navOpen = !navOpen;
  }

  function closeNav() {
    navOpen = false;
  }
</script>

<nav class="nav">
  <!-- Brand -->
  <a class="brand" href="/">ThreadIndex</a>

  <!-- Mobile hamburger -->
  <button
    type="button"
    class="hamburger mobile-only"
    on:click={toggleNav}
    aria-label="Toggle navigation"
    aria-expanded={navOpen}
  >
    ☰
  </button>

  <!-- Desktop center links -->
  <div class="center desktop-only">
    {#each links as link}
      <a href={link.href} class="link">{link.label}</a>
    {/each}
  </div>

  <!-- Right side: theme toggle + user -->
  <div class="right" id="nav-user-menu">
    <ThemeToggle />

    {#if user}
      <button
        class="avatar-btn"
        aria-haspopup="menu"
        aria-expanded={userMenuOpen}
        on:click={() => (userMenuOpen = !userMenuOpen)}
        title={user.email}
      >
        {#if avatarSrc && !avatarBroken}
          <img
            class="avatar-img"
            src={avatarSrc}
            alt="avatar"
            on:error={handleError}
          />
        {:else if gravatarUrl && !avatarBroken}
          <img
            class="avatar-img"
            src={gravatarUrl}
            alt="avatar"
            referrerpolicy="no-referrer"
            on:error={handleError}
          />
        {:else}
          <span
            class="avatar-fallback"
            style={`--bg:${colorFrom(user?.email)}`}
          >
            {initials(user?.email)}
          </span>
        {/if}
      </button>

      {#if userMenuOpen}
        <div class="menu" role="menu">
          <div class="menu-hd">{user.email}</div>
          <a role="menuitem" href="/account">Account</a>
          <a role="menuitem" href="/inventory">My inventory</a>
          <button role="menuitem" class="danger" on:click={logout}>Sign out</button>
        </div>
      {/if}
    {:else}
      <a class="signin" href="/auth/login">Sign in</a>
    {/if}
  </div>
</nav>

<!-- Mobile nav drawer -->
<nav class="mobile-nav" aria-label="Primary" data-open={navOpen}>
  {#each links as link}
    <a href={link.href} on:click={closeNav}>{link.label}</a>
  {/each}
</nav>

<style>
  .nav {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.9rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }

  .brand {
    font-weight: 700;
    text-decoration: none;
    color: var(--text);
    flex: 0 0 auto;
  }

  .center {
    display: flex;
    gap: 0.9rem;
    align-items: center;
    flex: 1 1 auto;
  }

  .link {
    color: var(--text-2);
    text-decoration: none;
    padding: 0.3rem 0.5rem;
    border-radius: 0.4rem;
  }

  .link:hover {
    background: var(--bg-3);
  }

  .right {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-left: auto;
  }

  .signin {
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    text-decoration: none;
    color: var(--text);
  }

  .avatar-btn {
    all: unset;
    cursor: pointer;
  }

  .avatar-img,
  .avatar-fallback {
    width: 32px;
    height: 32px;
    display: inline-grid;
    place-items: center;
    border-radius: 50%;
    font-weight: 700;
    font-size: 0.8rem;
  }

  .avatar-img {
    object-fit: cover;
  }

  .avatar-fallback {
    background: var(--bg-color, #555);
    color: white;
    border: 1px solid color-mix(in srgb, var(--bg) 85%, #fff);
  }

  .menu {
    position: absolute;
    right: 0;
    top: 120%;
    min-width: 200px;
    padding: 0.4rem;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    background: var(--bg-2);
    box-shadow: var(--shadow-1);
    display: grid;
    gap: 0.25rem;
  }

  .menu-hd {
    padding: 0.5rem 0.6rem;
    color: var(--text-2);
    font-size: 0.85rem;
  }

  .menu a,
  .menu button {
    text-align: left;
    padding: 0.5rem 0.6rem;
    border-radius: 0.4rem;
    border: none;
    background: none;
    color: var(--text);
    text-decoration: none;
    cursor: pointer;
  }

  .menu a:hover,
  .menu button:hover {
    background: var(--bg-3);
  }

  .danger {
    color: #b54;
  }

  .hamburger {
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
    padding: 0.25rem 0.4rem;
    border-radius: 999px;
  }

  .hamburger:hover {
    background: var(--bg-3);
  }

  .mobile-nav {
    display: none;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }

  .mobile-nav[data-open='true'] {
    display: none; /* default: still hidden on desktop */
  }

  .mobile-nav a {
    display: block;
    padding: 0.55rem 0.9rem;
    text-decoration: none;
    color: var(--text);
    border-top: 1px solid color-mix(in oklab, CanvasText 8%, transparent);
  }

  .mobile-nav a:hover {
    background: var(--bg-3);
  }

  .desktop-only {
    display: flex;
  }

  .mobile-only {
    display: none;
  }

  @media (max-width: 720px) {
    .nav {
      padding-inline: 0.7rem;
    }

    .desktop-only {
      display: none;
    }

    .mobile-only {
      display: inline-flex;
    }

    .mobile-nav {
      display: none;
    }

    .mobile-nav[data-open='true'] {
      display: block;
    }
  }
</style>
