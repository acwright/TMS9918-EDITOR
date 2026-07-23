<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Tooltip text */
    label: string
    /** Keyboard shortcut, shown as a key cap (e.g. "Ctrl+Z") */
    shortcut?: string
    /** Placement relative to the wrapped element */
    placement?: 'top' | 'bottom'
  }>(),
  { placement: 'top' },
)
</script>

<template>
  <span class="group/tooltip relative inline-flex">
    <slot />
    <span
      class="pointer-events-none absolute left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-sm border border-ink-700 bg-ink-850 px-2 py-1 text-xs whitespace-nowrap text-ink-200 opacity-0 shadow-lg transition-opacity delay-100 group-hover/tooltip:opacity-100 group-focus-visible/tooltip:opacity-100"
      :class="placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'"
      role="tooltip"
    >
      {{ label }}
      <kbd
        v-if="shortcut"
        class="rounded-xs border border-ink-600 bg-ink-800 px-1 font-mono text-[10px] text-ink-300"
      >
        {{ shortcut }}
      </kbd>
    </span>
  </span>
</template>
