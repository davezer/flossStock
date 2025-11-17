<script>
  import { invalidateAll, goto } from "$app/navigation";

  let email = "";
  let password = "";
  let error = "";
  
  async function onSubmit(event) {
    event.preventDefault();
    error = "";

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    if (!res.ok) {
      if (res.status === 401) {
        error = "Invalid email or password";
      } else {
        error = "Sign-in failed";
      }
      return;
    }

    // force the server layout to re-run and pick up locals.user
    await invalidateAll();
    await goto("/", { replaceState: true });
  }
</script>

<svelte:head><title>Sign in</title></svelte:head>

<section class="card" style="max-width:420px;margin:40px auto;padding:20px">
  <h1 style="margin:0 0 10px">Sign in</h1>
  {#if error}<p style="color:#e33">{error}</p>{/if}

  <form class="grid" style="gap:10px" on:submit|preventDefault={onSubmit}>
    <input
      class="input"
      name="email"
      type="email"
      autocomplete="email"
      bind:value={email}
      required
    />
    <input
      class="input"
      name="password"
      type="password"
      autocomplete="current-password"
      bind:value={password}
      required
    />
    <button class="btn primary" type="submit">Sign in</button>
  </form>

  <p style="margin-top:10px;color:var(--muted)">
    No account? <a href="/auth/register">Create one</a>
  </p>
</section>
