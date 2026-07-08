<script lang="ts">
  // ScratchPad: a plain, collapsed-by-default free-text notes box for the day. Palm's guardrails:
  // the grid X and the clue-strike ARE the real note-taking, so this is optional chrome - it
  // NEVER autofocuses, never raises the keyboard on load (a <details> keeps it collapsed until
  // the player opens it), and Board keeps it off the Easy cold-open. Persistence is DEBOUNCED
  // idle-persistence: localStorage.setItem serializes the whole save, so a per-keystroke write
  // would block the main thread - the debounce here is NOT game-loop timing, so setTimeout is
  // fine (CLAUDE.md). Chrome only (Tailwind). See docs/concepts/ui-shell.md, state/play.svelte.ts.
  let { value, label, placeholder = "", onchange }: { value: string; label: string; placeholder?: string; onchange: (text: string) => void } = $props();

  // Seed from the prop ONCE, then own the text locally (edits persist via onchange, and Board
  // remounts with a fresh pad on a day change), so capturing only the initial value is intended.
  // svelte-ignore state_referenced_locally
  let text = $state(value);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => onchange(text), 400); // idle-persist ~400ms after the last keystroke
  }
  function flush() {
    clearTimeout(timer);
    onchange(text); // persist immediately on blur so a quick note before leaving is never lost
  }
</script>

<details class="rounded-xl bg-surface p-2 shadow-e1">
  <summary class="cursor-pointer select-none text-xs font-bold uppercase tracking-widest opacity-70">{label}</summary>
  <textarea
    class="mt-2 h-24 w-full resize-y rounded-lg bg-bg p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    value={text}
    oninput={(e) => { text = (e.currentTarget as HTMLTextAreaElement).value; schedule(); }}
    onblur={flush}
    {placeholder}
    aria-label={label}
  ></textarea>
</details>
