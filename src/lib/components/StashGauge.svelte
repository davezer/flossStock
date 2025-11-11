<script>
  export let value = 0;        // 0–100
  export let label = 'Stash';
</script>

<div style="display:flex;align-items:center;gap:.5rem">
  <div style="width:160px;height:12px;border:1px solid #ccc;border-radius:999px;overflow:hidden">
    <div style="height:100%;width:{Math.max(0, Math.min(100, value))}%;background:#3b82f6"></div>
  </div>
  <span style="font:12px/1.2 system-ui">{label}: {Math.round(value)}%</span>
</div>
