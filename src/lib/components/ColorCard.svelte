<script>
  export let color;          // { code, name, hex, description? }
  export let inStash = false;
  export let onToggle = () => {};
</script>

<div class="card">
  <div class="swatch" style={`background:${color.hex}`}></div>
  <div class="meta">
    <div class="code">DMC {color.code}</div>
    <div class="name">{color.name}</div>
    {#if color.description}<div class="desc">{color.description}</div>{/if}
  </div>
<button type="button" class="add" on:click={() => onToggle(color.code)}>
  {inStash ? '−' : '+'}
</button>
</div>

<style>
  .card { display:flex; align-items:center; gap:.8rem; padding:.85rem 1rem;
          border:1px solid var(--border, #333); border-radius:12px; }
  .swatch { width:48px; height:48px; border-radius:10px; border:1px solid rgba(255,255,255,.12); }
  .meta { flex:1; min-width:0; }
  .code { font-weight:700; }
  .name { opacity:.9; }
  .desc { font-size:.9em; opacity:.7; }
  .add { width:32px; height:32px; border-radius:50%; border:1px solid var(--border, #333); }
</style>
