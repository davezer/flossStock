<script>
  import '$lib/theme.css';
  import NavBar from '$lib/components/NavBar.svelte';
  import Toasts from '$lib/components/Toasts.svelte';
  export let data; // { user }
</script>

<NavBar user={data.user} />
<div class="container"><slot /></div>
<Toasts />
