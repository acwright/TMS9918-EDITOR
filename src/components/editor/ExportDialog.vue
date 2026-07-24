<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Check, Copy, Download } from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import AppDialog from '@/components/base/AppDialog.vue'
import { MODES, charsetCount } from '@/domain/modes'
import {
  ASM_DIALECTS,
  charsetSegments,
  screenSegments,
  segmentsToAsm,
  segmentsToBasic,
  segmentsToBinary,
  type ByteSegment,
} from '@/domain/export'
import {
  charsetSheetToCanvas,
  screenToCanvas,
  CHARSET_SHEET_COLS,
} from '@/utils/screenRender'
import { downloadBytes, downloadCanvasPng, downloadText } from '@/utils/download'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

const props = defineProps<{ scope: 'screen' | 'charset' }>()
const open = defineModel<boolean>({ required: true })

const projects = useProjectsStore()
const editor = useEditorStore()

type FormatId = 'ca65' | 'z80' | 'basic' | 'binary' | 'png'
const FORMATS: { id: FormatId; label: string }[] = [
  { id: 'ca65', label: '6502' },
  { id: 'z80', label: 'Z80' },
  { id: 'basic', label: 'BASIC' },
  { id: 'binary', label: 'Binary' },
  { id: 'png', label: 'PNG' },
]
const EXTENSION: Record<FormatId, string> = {
  ca65: '.s',
  z80: '.asm',
  basic: '.bas',
  binary: '.bin',
  png: '.png',
}
const PNG_SCALES = [1, 2, 4, 6, 8]

const format = ref<FormatId>('ca65')
const pngScale = ref(4)
const isText = computed(() => format.value === 'ca65' || format.value === 'z80' || format.value === 'basic')

// --- Charset scope options ---
const setChoice = ref<'all' | number>('all')
const tables = reactive({ patterns: true, colors: true })
const setCount = computed(() =>
  projects.current ? charsetCount(projects.current.type, projects.current.settings.g2CharsetMode) : 1,
)
const multiSet = computed(() => setCount.value > 1)
const selectedSets = computed(() =>
  setChoice.value === 'all' ? Array.from({ length: setCount.value }, (_, i) => i) : [setChoice.value],
)
/** Which set a charset PNG renders (a sheet is one set). */
const pngSet = computed(() =>
  typeof setChoice.value === 'number' ? setChoice.value : editor.selectedCharset,
)

// --- Screen scope options ---
const screenChoice = ref<'current' | 'all'>('current')
const selectedScreens = computed(() =>
  screenChoice.value === 'all'
    ? (projects.current?.screens ?? []).map((_, i) => i)
    : [editor.selectedScreen],
)

// --- BASIC options ---
const startLine = ref(1000)
const step = ref(10)

const title = computed(() => {
  const project = projects.current
  return project ? `${project.name} — ${MODES[project.type].label}` : 'TMS9918'
})

const segments = computed<ByteSegment[]>(() => {
  const project = projects.current
  if (!project) return []
  return props.scope === 'charset'
    ? charsetSegments(project, {
        sets: selectedSets.value,
        patterns: tables.patterns,
        colors: tables.colors,
      })
    : screenSegments(project, selectedScreens.value)
})

const byteCount = computed(() => segments.value.reduce((sum, seg) => sum + seg.bytes.length, 0))

const textOutput = computed(() => {
  if (format.value === 'ca65') return segmentsToAsm(segments.value, ASM_DIALECTS.ca65, title.value)
  if (format.value === 'z80') return segmentsToAsm(segments.value, ASM_DIALECTS.z80, title.value)
  if (format.value === 'basic') {
    return segmentsToBasic(segments.value, { startLine: startLine.value, step: step.value }, title.value)
  }
  return ''
})

const pngDimensions = computed(() => {
  const project = projects.current
  if (!project) return ''
  if (props.scope === 'charset') {
    const size = CHARSET_SHEET_COLS * 8 * pngScale.value
    return `${size} × ${size} px`
  }
  const { columns, rows, cellWidth, cellHeight } = MODES[project.type]
  return `${columns * cellWidth * pngScale.value} × ${rows * cellHeight * pngScale.value} px`
})

const hasData = computed(() => {
  if (format.value === 'png') return props.scope === 'charset' || !!editor.currentScreen
  return byteCount.value > 0
})

function fileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'project'
  )
}

const filename = computed(() => {
  const project = projects.current
  let name = project ? fileSlug(project.name) : 'project'
  if (props.scope === 'charset') {
    name += '-charset'
    if (multiSet.value) {
      const set = format.value === 'png' ? pngSet.value : setChoice.value
      if (typeof set === 'number') name += `-set${set + 1}`
    }
  } else {
    name +=
      format.value === 'png' || screenChoice.value === 'current'
        ? `-screen${editor.selectedScreen + 1}`
        : '-screens'
  }
  return name + EXTENSION[format.value]
})

// --- Actions ---
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  await navigator.clipboard.writeText(textOutput.value)
  copied.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copied.value = false), 1500)
}

function download() {
  const project = projects.current
  if (!project || !hasData.value) return
  if (format.value === 'binary') {
    downloadBytes(filename.value, segmentsToBinary(segments.value))
  } else if (format.value === 'png') {
    const canvas =
      props.scope === 'charset'
        ? charsetSheetToCanvas(project, pngSet.value, pngScale.value)
        : editor.currentScreen
          ? screenToCanvas(project, editor.currentScreen, pngScale.value)
          : null
    if (canvas) downloadCanvasPng(filename.value, canvas)
  } else {
    downloadText(filename.value, textOutput.value, format.value === 'basic' ? 'text/plain' : 'text/x-asm')
  }
}

const segButton =
  'font-display rounded-sm border px-3 py-1.5 text-sm tracking-wider transition-colors'
const segActive = 'border-ink-300 bg-ink-100 text-ink-950'
const segIdle = 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-500 hover:text-ink-100'
</script>

<template>
  <AppDialog v-model="open" size="xl" :title="scope === 'charset' ? 'Export Character Set' : 'Export Screen'">
    <div class="flex flex-col gap-4">
      <!-- Format -->
      <fieldset class="flex flex-col gap-1.5">
        <legend class="font-display mb-1 text-sm tracking-wider text-ink-400">Format</legend>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="f in FORMATS"
            :key="f.id"
            type="button"
            :class="[segButton, format === f.id ? segActive : segIdle]"
            @click="format = f.id"
          >
            {{ f.label }}
          </button>
        </div>
      </fieldset>

      <!-- Charset options -->
      <template v-if="scope === 'charset'">
        <fieldset v-if="multiSet" class="flex flex-col gap-1.5">
          <legend class="font-display mb-1 text-sm tracking-wider text-ink-400">Character Set</legend>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" :class="[segButton, setChoice === 'all' ? segActive : segIdle]" @click="setChoice = 'all'">
              All
            </button>
            <button
              v-for="i in setCount"
              :key="i"
              type="button"
              :class="[segButton, setChoice === i - 1 ? segActive : segIdle]"
              @click="setChoice = i - 1"
            >
              Set {{ i }}
            </button>
          </div>
        </fieldset>

        <fieldset v-if="format !== 'png'" class="flex flex-col gap-1.5">
          <legend class="font-display mb-1 text-sm tracking-wider text-ink-400">Tables</legend>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" :class="[segButton, tables.patterns ? segActive : segIdle]" @click="tables.patterns = !tables.patterns">
              Patterns
            </button>
            <button type="button" :class="[segButton, tables.colors ? segActive : segIdle]" @click="tables.colors = !tables.colors">
              Colours
            </button>
          </div>
        </fieldset>
      </template>

      <!-- Screen options -->
      <fieldset v-else-if="format !== 'png'" class="flex flex-col gap-1.5">
        <legend class="font-display mb-1 text-sm tracking-wider text-ink-400">Screens</legend>
        <div class="flex flex-wrap gap-1.5">
          <button type="button" :class="[segButton, screenChoice === 'current' ? segActive : segIdle]" @click="screenChoice = 'current'">
            Current
          </button>
          <button type="button" :class="[segButton, screenChoice === 'all' ? segActive : segIdle]" @click="screenChoice = 'all'">
            All
          </button>
        </div>
      </fieldset>

      <!-- PNG scale -->
      <fieldset v-if="format === 'png'" class="flex flex-col gap-1.5">
        <legend class="font-display mb-1 text-sm tracking-wider text-ink-400">Scale</legend>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="s in PNG_SCALES"
            :key="s"
            type="button"
            :class="[segButton, pngScale === s ? segActive : segIdle]"
            @click="pngScale = s"
          >
            {{ s }}×
          </button>
        </div>
      </fieldset>

      <!-- BASIC line numbering -->
      <fieldset v-if="format === 'basic'" class="flex gap-4">
        <label class="flex flex-col gap-1">
          <span class="font-display text-sm tracking-wider text-ink-400">Start line</span>
          <input
            v-model.number="startLine"
            type="number"
            min="0"
            class="h-9 w-28 rounded-sm border border-ink-700 bg-ink-850 px-2.5 text-sm text-ink-100 focus:border-ink-300 focus:outline-none"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="font-display text-sm tracking-wider text-ink-400">Step</span>
          <input
            v-model.number="step"
            type="number"
            min="1"
            class="h-9 w-28 rounded-sm border border-ink-700 bg-ink-850 px-2.5 text-sm text-ink-100 focus:border-ink-300 focus:outline-none"
          />
        </label>
      </fieldset>

      <!-- Preview / summary -->
      <div class="flex flex-col gap-1">
        <span class="font-display text-sm tracking-wider text-ink-400">Preview</span>
        <textarea
          v-if="isText"
          :value="textOutput"
          readonly
          spellcheck="false"
          class="h-56 w-full resize-none rounded-sm border border-ink-700 bg-ink-950 p-2 font-mono text-[11px] whitespace-pre text-ink-300 focus:outline-none"
        />
        <p
          v-else
          class="flex h-20 items-center justify-center rounded-sm border border-ink-800 bg-ink-950 text-center font-mono text-xs text-ink-400"
        >
          <span v-if="!hasData">Nothing selected to export.</span>
          <span v-else-if="format === 'binary'">{{ byteCount }} bytes → <span class="text-ink-200">{{ filename }}</span></span>
          <span v-else>{{ pngDimensions }} PNG → <span class="text-ink-200">{{ filename }}</span></span>
        </p>
      </div>
    </div>

    <template #footer>
      <AppButton v-if="isText" label="Copy" show-label :disabled="!hasData" @click="copy">
        <Check v-if="copied" class="size-4 text-vdp-medium-green" />
        <Copy v-else class="size-4" />
      </AppButton>
      <AppButton label="Download" show-label :disabled="!hasData" @click="download">
        <Download class="size-4" />
      </AppButton>
    </template>
  </AppDialog>
</template>
