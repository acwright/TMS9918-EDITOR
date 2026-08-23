/**
 * Fixed projects behind the golden files (Document Storage plan, F2). Every
 * field that would otherwise vary — the id and the two timestamps — is pinned,
 * and each project carries a little real content so a regression in *any* of
 * D4's chunking rules shows up as a diff rather than in a sea of zeros.
 */

import { createProject } from '../factory'
import { MODES } from '../modes'
import type { Project, ProjectType, G2CharsetMode } from '../types'
import { isGraphics1Colors, isGraphics2Colors, isSpriteColors, isTextColors } from '../types'

const GOLDEN_ID = '00000000-0000-4000-8000-000000000001'
const GOLDEN_DATE = '2026-01-01T00:00:00.000Z'

/** An arrow, so a pattern line is recognisable in the file. */
const ARROW = [0x18, 0x3c, 0x7e, 0xff, 0x18, 0x18, 0x18, 0x00]

export interface GoldenProject {
  /** Also the golden file's basename. */
  name: string
  project: Project
}

function build(name: string, type: ProjectType, g2CharsetMode?: G2CharsetMode): GoldenProject {
  const project = createProject({ name, type, g2CharsetMode })
  project.id = GOLDEN_ID
  project.createdAt = GOLDEN_DATE
  project.modifiedAt = GOLDEN_DATE

  project.charsets.forEach((charset, set) => {
    charset[1] = [...ARROW]
    charset[2] = charset[2]!.map((_, row) => (set + 1) * (row + 1))
  })

  const { colors } = project
  if (isTextColors(colors)) colors.fg = 7
  if (isGraphics1Colors(colors)) colors.groups[3] = { fg: 4, bg: 2 }
  if (isGraphics2Colors(colors)) colors.rows[0]![1]![2] = { fg: 6, bg: 3 }
  if (isSpriteColors(colors)) colors.sprites[0] = 10

  const screen = project.screens[0]
  if (screen) {
    const { columns } = MODES[type]
    screen.name = 'Golden'
    // One cell on each of the first two rows, so the row chunking is visible.
    screen.cells[1] = type === 'multicolor' ? 5 : 1
    screen.cells[columns + 2] = type === 'multicolor' ? 6 : 2
  }

  if (project.animations) {
    project.animations = [{ name: 'Walk', frames: [0, 1, 2, 1], fps: 12 }]
  }

  return { name, project }
}

export const GOLDEN_PROJECTS: GoldenProject[] = [
  build('text', 'text'),
  build('graphics1', 'graphics1'),
  build('graphics2-mirrored', 'graphics2', 'mirrored'),
  build('graphics2-independent', 'graphics2', 'independent'),
  build('multicolor', 'multicolor'),
  build('sprite', 'sprite'),
]
