<script>
  import { toasts } from '$lib/stores/toast';
  import { fly } from 'svelte/transition';
  

  // derive array for the keyed each block
  $: list = $toasts || [];

  
</script>

<div class="toasts">
  {#each list as t (t.id)}
    <div class="toast {t.kind}" in:fly={{ y: 10, duration: 120 }} out:fly={{ y: -10, duration: 120 }}>
      {t.text}
    </div>
  {/each}
</div>

<style>
  .toasts{
    position: fixed; right: 16px; bottom: 16px; z-index: 1200;
    display: grid; gap: 8px;
  }
  .toast{
    padding: .55rem .75rem; border-radius: 10px;
    border: 1px solid var(--stroke);
    background: color-mix(in srgb, var(--bg-3) 92%, #fff);
    color: var(--text); box-shadow: var(--shadow-1);
  }
  .toast.ok { border-color: color-mix(in srgb, #46c47d 50%, var(--stroke)); }
  .toast.err{ border-color: color-mix(in srgb, #e45858 60%, var(--stroke)); }
</style>
