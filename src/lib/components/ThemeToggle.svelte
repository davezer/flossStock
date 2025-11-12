<script>
  import { onMount } from "svelte";

  let current = "system";  // 'light' | 'dark' | 'system'
  let mounted = false;

  function systemPrefersDark() {
    return mounted && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  }
  function resolveTheme(t) {
    return t === "system" ? (systemPrefersDark() ? "dark" : "light") : t;
  }

  function apply(t) {
    if (!mounted) return; // avoid SSR
    document.documentElement.dataset.theme = resolveTheme(t);
  }
  function setTheme(t) {
    current = t;
    if (mounted) {
      if (t === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", t);
    }
    apply(t);
  }
  function toggle() {
    const next = resolveTheme(current) === "dark" ? "light" : "dark";
    setTheme(next);
  }
  $: targetLabel = resolveTheme(current) === "dark" ? "light" : "dark";

  onMount(() => {
    mounted = true;
    const stored = localStorage.getItem("theme");
    current = stored === "light" || stored === "dark" ? stored : "system";
    apply(current);

    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => current === "system" && apply("system");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  });
</script>

<button
  class="theme-switch"
  on:click={toggle}
  aria-label="Toggle color scheme"
  title={`Switch to ${targetLabel} mode`}
>
  <!-- Icon stack for crossfade/rotate -->
  <span class="icon-stack" aria-hidden="true">
    <span
        class="sun masked"
        class:show={resolveTheme(current) === 'dark'}
        aria-hidden="true"
        />

    <!-- MOON (shown when currently LIGHT → clicking goes DARK) -->
    <svg
      class:show={resolveTheme(current) !== 'dark'}
      class="moon"
      viewBox="0 0 24 24"
      width="20" height="20"
    >
      <path d="M21 12.6A8.5 8.5 0 1 1 11.4 3a7 7 0 1 0 9.6 9.6Z" fill="currentColor"/>
    </svg>
  </span>
</button>

<style>
    /* Make the button’s foreground high-contrast in dark theme */
:root[data-theme="dark"] .theme-switch { color: #fff; }

/* masked sun that inherits currentColor */
.sun.masked{
  width: 20px; height: 20px; display:block;
  background-color: currentColor;              /* the fill color */
  -webkit-mask: url('/icons8-sun.svg') center / contain no-repeat;
          mask: url('/icons8-sun.svg') center / contain no-repeat;
}

/* optional: give the button a slightly brighter chip in dark mode
   so any icon (sun or moon) pops a bit more */
:root[data-theme="dark"] .theme-switch {
  background: color-mix(in oklab, var(--surface) 85%, #ffffff 5%);
  border-color: color-mix(in oklab, var(--text) 28%, transparent);
}

/* keep your existing crossfade/rotate rules */
.icon-stack{ position:relative; width:20px; height:20px; }
.icon-stack > *{
  position:absolute; inset:0;
  opacity:0; transform: rotate(-90deg) scale(.8);
  transition: opacity .25s ease, transform .25s ease;
}
.icon-stack > *.show{ opacity:1; transform: rotate(0deg) scale(1); }

@media (prefers-reduced-motion: reduce){
  .icon-stack > *{ transition:none; transform:none !important; }
}

  .theme-switch{
    width: 42px; height: 36px;
    display: grid; place-items: center;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    transition: background .15s, border-color .15s, transform .06s;
  }
  .theme-switch:hover{
    background: color-mix(in oklab, var(--brand) 12%, var(--surface));
  }
  .theme-switch:active{ transform: scale(.97); }

  /* stacked icons crossfade/rotate */
  .icon-stack{
    position: relative; width: 20px; height: 20px;
  }
  .icon-stack > *{
    position: absolute; inset: 0;
    opacity: 0; transform: rotate(-90deg) scale(.8);
    transition: opacity .25s ease, transform .25s ease;
  }
  .icon-stack > *.show{
    opacity: 1; transform: rotate(0deg) scale(1);
  }

  /* crisp assets */
  .sun{ display:block; }
  .moon{ display:block; }

  /* motion safety */
  @media (prefers-reduced-motion: reduce){
    .icon-stack > *{ transition: none; transform: none !important; }
    .theme-switch{ transition: none; }
  }
</style>
