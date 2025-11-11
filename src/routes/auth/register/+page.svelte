<!-- src/routes/auth/register/+page.svelte -->
<script>
  import { goto } from '$app/navigation';
  let email = '';
  let password = '';
  let error = '';

  async function onSubmit(e) {
    e.preventDefault();
    error = '';
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        error = res.status === 409 ? 'Email already registered' : 'Registration failed';
        return;
      }
      await goto('/colors', { replaceState: true });
    } catch {
      error = 'Network error';
    }
  }
</script>

<svelte:head><title>Create account</title></svelte:head>

<section class="card" style="max-width:420px;margin:40px auto;padding:20px">
  <h1 style="margin:0 0 10px">Create account</h1>
  {#if error}<p style="color:#e33">{error}</p>{/if}
  <form on:submit={onSubmit} class="grid" style="gap:10px">
    <input class="input" type="email" placeholder="Email" bind:value={email} required />
    <input class="input" type="password" placeholder="Password" bind:value={password} minlength="6" required />
    <button class="btn primary" type="submit">Create account</button>
  </form>
  <p style="margin-top:10px;color:var(--muted)"><a href="/auth/login">Back to sign in</a></p>
</section>
