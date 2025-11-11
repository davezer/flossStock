<!-- src/routes/auth/login/+page.svelte -->
<script>
  import { goto } from '$app/navigation';
  let email = '';
  let password = '';
  let error = '';

  async function onSubmit(e) {
    e.preventDefault();
    error = '';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        error = res.status === 401 ? 'Invalid email or password' : 'Sign-in failed';
        return;
      }
      await goto('/', { replaceState: true });
    } catch {
      error = 'Network error';
    }
  }
</script>

<svelte:head><title>Sign in</title></svelte:head>

<section class="card" style="max-width:420px;margin:40px auto;padding:20px">
  <h1 style="margin:0 0 10px">Sign in</h1>
  {#if error}<p style="color:#e33">{error}</p>{/if}
  <!-- <form on:submit={onSubmit} class="grid" style="gap:10px">
    <input class="input" type="email" placeholder="Email" bind:value={email} required />
    <input class="input" type="password" placeholder="Password" bind:value={password} required />
    <button class="btn primary" type="submit">Sign in</button>
  </form> -->
<form method="POST">
  <input class="input" name="email" type="email" autocomplete="email" required />
  <input class="input" name="password" type="password" autocomplete="current-password" required />
  <button class="btn primary" type="submit">Sign in</button>
</form>

  <!-- <form method="POST" action="/api/auth/login">
    <input class="input" name="email" type="email" required>
    <input class="input" name="password" type="password" required>
    <button class="btn primary" type="submit">Sign in</button>
  </form> -->
  <p style="margin-top:10px;color:var(--muted)">No account? <a href="/auth/register">Create one</a></p>
</section>
