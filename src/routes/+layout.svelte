<script>
  import { onMount } from 'svelte';
  import { invalidate } from '$app/navigation';
  import { browser } from '$app/environment';
  import NavBar from '$lib/components/NavBar.svelte';
  import { stash } from '$lib/stores/stash';

  // Provided by +layout.js: { supabase, session, user }
  export let data;
  let { supabase } = data;

  // Track previous user to detect SSR -> CSR changes
  let prevUserId = data.user?.id || null;

  // Clear stash on auth events
  onMount(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        stash.clear();
      }
      invalidate('supabase:auth'); // refresh layout data
    });
    return () => sub.subscription.unsubscribe();
  });

  // Also clear if user becomes null after a reload/navigation
  $: if (browser) {
    const now = data.user?.id || null;
    if (!now && prevUserId) {
      stash.clear();
    }
    prevUserId = now;
  }
</script>

<NavBar user={data.user} />

<main>
  <slot />
</main>

<style>
  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.25rem;
  }
</style>
