<script>
  export let data;
</script>

<h1 style="padding:1rem">DMC {data.color?.code} — {data.color?.name}</h1>
<div style="width:120px;height:120px;border-radius:12px;border:1px solid #ddd;background:{data.color?.hex};margin:1rem"></div>
<pre style="padding:1rem">{JSON.stringify(data.color, null, 2)}</pre>