<script lang="ts">
  // StoryPanel: the narrative cold-open of a story-first manifest (core-loop.md). Plain
  // prose that sets the scene - the deductions live in the ClueList, the axis glyphs in
  // the board headers, never in the story language. Renders nothing for a legacy manifest
  // (no story). Chrome only (Tailwind); no board/canvas internals here.
  let { story = "" }: { story?: string } = $props();
</script>

{#if story}
  <section class="rounded-2xl bg-surface/70 px-4 py-3 text-sm leading-relaxed text-ink/90">
    <p>{story}</p>
  </section>
{/if}
