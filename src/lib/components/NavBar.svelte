<script>
  export let user = null;

  let open = false;
  $: r2Avatar = user?.avatar_key ? `/api/avatar/${user.avatar_key}` : '';
    // --- MD5 (tiny implementation, no deps) ---
  function md5(str) {
      return crypto.subtle.digest("MD5", new TextEncoder().encode(str))
        .then(buf => Array.from(new Uint8Array(buf))
          .map(x => x.toString(16).padStart(2,"0")).join(""));
  }

  let gravatarUrl = "";
  $: if (user?.email) {
    md5(user.email.trim().toLowerCase()).then(hash => {
      // default=404 → lets us detect & fallback to initials
      gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=64&d=404`;
    });
  }

  function initials(email) {
    const name = (email || "").split("@")[0] || "U";
    const parts = name.replace(/[^a-z0-9_-]/gi, " ").trim().split(/\s+|_|-/).filter(Boolean);
    const a = parts[0]?.[0] ?? "U";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }

  function colorFrom(email) {
    let h = 0;
    for (let i = 0; i < (email || "").length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 65% 40%)`;
  }

  let avatarBroken = false;
  function handleError() {
    avatarBroken = true;
  }

  // close menu on outside click / ESC
  function onDocClick(e) {
    if (!open) return;
    const root = document.getElementById('nav-user-menu');
    if (root && !root.contains(e.target)) open = false;
  }
  function onKey(e) { if (e.key === 'Escape') open = false; }

  if (typeof window !== 'undefined') {
    window.addEventListener('click', onDocClick);
    window.addEventListener('keydown', onKey);
  }

  $: label = user ? (user.email?.split('@')[0] ?? 'Account') : 'Sign in';

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.reload();
  }


</script>

<nav class="nav">
  <a class="brand" href="/">ThreadIndex</a>

  <div class="center">
    <a href="/colors" class="link">Colors</a>
    <a href="/inventory" class="link">Inventory</a>
  </div>

  <div class="right" id="nav-user-menu">
    {#if user}
      <button
        class="avatar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        on:click={() => (open = !open)}
        title={user.email}
      >
        {#if r2Avatar && !avatarBroken}
          <img class="avatar-img" src={r2Avatar} alt="avatar" on:error={handleError} />
        {:else if gravatarUrl && !avatarBroken}
          <img class="avatar-img" src={gravatarUrl} alt="avatar" referrerpolicy="no-referrer" on:error={handleError} />
        {:else}
          <span class="avatar-fallback" style={`--bg:${colorFrom(user?.email)}`}>{initials(user?.email)}</span>
        {/if}
              </button>


              {#if open}
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

<style>
  .nav{
    position: sticky; top:0; z-index:50;
    display:flex; align-items:center; justify-content:space-between;
    gap:1rem; padding:.6rem .9rem;
    border-bottom:1px solid var(--stroke); background:var(--bg);
  }
  .brand{ font-weight:700; text-decoration:none; color:var(--text); }
  .center{ display:flex; gap:.9rem; align-items:center; }
  .link{ color:var(--text-2); text-decoration:none; padding:.3rem .5rem; border-radius:.4rem; }
  .link:hover{ background:var(--bg-3); }
  .right{ position:relative; display:flex; align-items:center; gap:.6rem; }
  .signin{ padding:.4rem .7rem; border:1px solid var(--stroke); border-radius:.6rem; text-decoration:none; }
  .avatar-btn{ all:unset; cursor:pointer; }
  .avatar{
    display:inline-grid; place-items:center;
    width:32px; height:32px; border-radius:999px;
    background:var(--bg-3); color:white; font-size:.8rem; font-weight:700;
    background: var(--bg, #555);
    border:1px solid color-mix(in srgb, var(--bg, #555) 85%, #fff);
  }
  .menu{
    position:absolute; right:0; top:120%;
    min-width:200px; padding:.4rem; border:1px solid var(--stroke);
    border-radius:.6rem; background:var(--bg-2); box-shadow:var(--shadow-1);
    display:grid; gap:.25rem;
  }
  .menu-hd{ padding:.5rem .6rem; color:var(--text-2); font-size:.85rem; }
  .menu a, .menu button{
    text-align:left; padding:.5rem .6rem; border-radius:.4rem; border:none; background:none; color:var(--text);
    text-decoration:none; cursor:pointer;
  }
  .menu a:hover, .menu button:hover{ background:var(--bg-3); }
  .danger{ color:#b54; }

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
  font-size: .8rem;
}

.avatar-img {
  object-fit: cover;
}

.avatar-fallback {
  background: var(--bg, #555);
  background: var(--bg);
  background-color: var(--bg);
  background: var(--bg);
  background: var(--bg, #555);
  background: var(--bg, #555);
  background: var(--bg, #555);
  background: var(--bg-color, #555);
  background-color: var(--bg);
  background: var(--bg);
  background: var(--bg-color);
  background: var(--bg);
  color: white;
  background: var(--bg);
  background-color: var(--bg);
  background: var(--bg);
  background: var(--bg, #555);
  background-color: var(--bg);
  background: var(--bg);
  border: 1px solid color-mix(in srgb, var(--bg) 85%, #fff);
}

</style>
