<script>
  import { onMount } from 'svelte';
  import { stash } from '$lib/stores/stash.js';
  export let data; // has session from +layout.server
  import NavBar from '$lib/components/NavBar.svelte';
  import AuthModal from '$lib/components/AuthModal.svelte';

  onMount(async () => {
    if (data?.session) {
      // fetch server stash
      const res = await fetch('/api/stash');
      const { codes: serverCodes } = await res.json();

      // if client has extra codes, union -> POST
      let localCodes = [];
      const unsub = stash.subscribe((a) => (localCodes = a)); unsub();

      const union = Array.from(new Set([...(serverCodes || []), ...(localCodes || [])]));
      if (union.length !== (serverCodes?.length || 0)) {
        await fetch('/api/stash', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ codes: union })
        });
        // update local store to match server
        union.forEach((c) => stash.add(c));
      }
    }
  });
</script>

<NavBar />

{#if data.session}
  <div class="user-pill">Signed in</div>
{/if}
<slot />
<AuthModal />
