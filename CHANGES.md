# UI/UX redesign — `redesign/professional-ui`

A visual and UX redesign of the whole frontend. No API contracts, hooks
(`features/*/api.ts`, `hooks.ts`, `types.ts`), routes or backend code were
changed. Every feature, mutation and query works as before.

Commits are per phase: tokens → components → app shell → auth + landing →
app pages.

## 1. Design system decisions

**Direction.** A calm, dense, keyboard-friendly work tool in the spirit of
Linear / Height: cool neutrals, one confident accent, and hierarchy carried by
type and spacing rather than colour or heavy borders.

**Colour** (`src/app/globals.css`, all OKLCH so steps stay perceptually even)
- Neutrals: `background`, `card`, `popover`, `muted`, `accent`, `secondary`,
  with three text levels: `foreground`, `muted-foreground` (AA on every surface),
  and `subtle-foreground` (placeholders and meta only).
- Lines: `border`, `border-strong`, `input`, `ring`.
- Brand: iris primary (`primary`, `primary-hover`, `primary-soft`,
  `primary-soft-foreground`).
- Semantic: `success`, `warning`, `danger`, `info`, each with `-soft` (tinted
  surface) and `-soft-foreground` (AA text on that surface). Badges, alerts and
  toasts use these pairs.
- Data viz: `chart-1…6`, ordered for distinguishability in both themes.
- Shell: `sidebar*` tokens. Light mode uses a light sidebar (the old navy
  sidebar is gone).
- `ink*`: an always-dark brand surface for the auth panel and marketing band.

**Dark mode.** Class-based (`.dark` on `<html>`), with every token redefined.
A tiny inline script applies the saved preference before first paint, so
there is no flash. The preference (light / dark / system) lives in
`localStorage` (`src/lib/theme.ts`) and follows OS changes in system mode.
Users can switch it from the top bar, the account menu, the command palette
and Settings → Appearance.

**Typography.** All fonts are self-hosted via `@fontsource`, so the build no
longer fetches Google Fonts.
- *Bricolage Grotesque* for headings and KPIs. It is characterful at display
  sizes and still tight in UI.
- *Geist* for UI and body text.
- *Geist Mono* for shortcuts and code.
- A compact scale replaces the ad-hoc `text-[14px]` values: `2xs 11 · xs 12 ·
  sm 13 · base 14 · md 15 · lg 17 · xl 20 · 2xl 24 · 3xl 30 · 4xl 40 · 5xl 52 ·
  6xl 68`.

**Other tokens.**
- Radius: `xs`–`2xl`, controls at 8px and cards at 14px.
- Shadows: `xs`–`lg`, soft in light mode and deeper in dark mode.
- Z-index scale: `sticky`, `header`, `drawer`, `overlay`, `modal`, `popover`,
  `toast`, `tooltip`.
- Motion: `fade`, `scale`, `slide-up`, `slide-in-left` and `shimmer` keyframes
  at 150–220ms with an ease-out-quint curve. All motion is disabled under
  `prefers-reduced-motion`.

**Rules applied across the codebase.** Components use tokens only: no hex,
`bg-white`, or Tailwind palette colours. SVG colours are set through `style`
or `stroke-*` / `fill-*` token classes, so charts re-theme.

## 2. Component library (`src/components/ui`)

Redesigned:
- **Button**: variants `default`, `secondary`, `outline`, `ghost`, `soft`,
  `destructive`, `link`; sizes `xs`–`xl` and `icon` / `icon-sm` / `icon-xs`.
  A `loading` prop shows a spinner at a stable width. Focus ring and pressed
  state included.
- **Input** / **Textarea** share one `fieldBaseClass`: hover, focus ring,
  `aria-invalid` and disabled states. Native selects and textareas use it via
  `nativeSelectClass` / `nativeTextareaClass`.
- **Card** gains `interactive` hover lift and `CardFooter`.
- **Badge** gains a `dot` option, `StatusBadge` shows a dot and label, and the
  new `PriorityBadge` adds a directional icon so priority never relies on
  colour alone.
- **Dialog**: blurred overlay, scale-in animation, `hideClose` option.
- **Table**: tinted header, row hover, caption.
- **Skeleton**: shimmer, plus `SkeletonList` and `SkeletonCards` presets.
- **Label**.

New:
- `Select`, `DropdownMenu` (with sub-menus, radio and checkbox items, and a
  destructive item), `Tabs` (`line` and `pill`), `Tooltip`.
- `Avatar` (deterministic token tint, presence dot) and `AvatarStack`.
- `Popover`, `Progress` and `ProgressRing`.
- `Toast` (sonner, themed, with icons).
- `EmptyState` and `ErrorState`.
- `Command` / `CommandDialog` (cmdk), `Kbd`, `Breadcrumbs`, `Spinner`.
- `ThemeToggle` and `ThemeSegmented`.

Shared page primitives (`components/page-header.tsx`): `PageHeader` now takes
breadcrumbs, an icon and meta. `StatCard` is new. `Surface`, `ListPanel` and
`SegmentedControl` (now a radiogroup) are restyled.

**Feedback.**
- Every failed mutation raises an error toast through a global
  `MutationCache`. Auth screens are the exception because they show errors
  inline.
- Create, update and delete actions show success toasts at their call sites.

### Dependencies added (and why)
| Package | Why |
| --- | --- |
| `@radix-ui/react-{select,dropdown-menu,tabs,tooltip,avatar,popover,progress}` | Accessible primitives (focus management, keyboard, ARIA) in the same shadcn style as the existing Radix dialog/label/slot |
| `sonner` | Small, accessible toast queue |
| `cmdk` | Accessible, fuzzy-filtered command palette |
| `@fontsource-variable/{geist,geist-mono,bricolage-grotesque}` | Self-hosted fonts (replaces Inter/Poppins and the build-time Google font fetch) |

No animation library was added; CSS keyframes cover the 150–250ms transitions.

## 3. App shell
- **Sidebar.** Collapsible, and the collapsed state persists.
  - Navigation is grouped into Home, Work, Collaborate, Insights and Admin.
    Active items get a raised pill and an accent icon, and collapsed items
    show tooltips.
  - A search button opens the command palette.
  - The Radix workspace switcher shows your role and the workspace count.
  - An account menu at the bottom holds Settings, Notifications, Theme and
    Log out.
- **Mobile.** Below `lg` the sidebar becomes a drawer with focus trap and Esc
  support, and it closes on navigation.
- **Top bar.**
  - Workspace › section › details breadcrumbs.
  - Task search, with the same behaviour as before.
  - Theme toggle.
  - Notifications popover with skeleton and empty states and mark-all-read.
  - A **Create** menu covering every resource.
- **Command palette (Ctrl/Cmd + K).** Navigate, create, search tasks, switch
  workspace, change theme, log out.
- **Loading.** While the session and workspace load, a skeleton of the shell
  replaces the old spinner.

## 4. Pages — before → after

### Auth and landing
- **Login / Register.**
  - Before: underline-only inputs, a navy pill button and a cartoon rocket
    panel.
  - After: a split layout. The form column uses the standard fields, a
    show/hide password toggle, inline `ErrorState`, a loading button and a
    password-length hint. The brand panel is always dark, with a live product
    preview built from real tokens, and it reads well in both themes.
- **Invite / Create workspace.**
  - Before: plain cards and "Loading…" text.
  - After: icon headers, skeletons, `ErrorState`, and loading buttons. The
    create page also shows a logo preview.
- **Landing.**
  - Before: warm beige page, serif headline, text-only feature list.
  - After: a marketing page with a sticky header, a hero (headline, CTAs,
    trust row, product preview with floating accents), a feature grid,
    how-it-works steps, a roles/isolation band, a final CTA and a footer. It
    shares the app's fonts and tokens, resolving system-problems item 5.

### App pages
Every page now has:
- a `PageHeader` (with an icon on top-level pages and breadcrumbs on detail pages);
- skeletons shaped like the real layout;
- a designed `EmptyState` (icon, message, action);
- an `ErrorState` with a Retry button;
- success toasts on its mutations.

Each works in both themes and at 375, 768 and 1440px.

| Page | Before | After |
| --- | --- | --- |
| **Dashboard** | Bare "Dashboard" title, home-made stat cards, a chart without axes, and a thin "Today's tasks" table | A greeting with date and workspace, a range selector, 4 KPI `StatCard`s (tones, deltas, links), and a responsive activity chart with y-axis, gridlines and a totals legend. Beside the chart, a work-mix donut whose legend shows counts and %. Below, a status/priority table (stacked rows on mobile) and new "Coming up" and "Recent activity" panels built from data the dashboard already loads |
| **My Day** | A date tile and a simple list | A heading with summary pills and a progress bar. Tasks are grouped Overdue / Today / Upcoming / Done (Done is collapsible) with round start controls and hover actions; the row menu is a Radix dropdown. A schedule timeline card highlights the meeting that is "Now" |
| **Tasks** | A wide text table with comma-joined assignee names | A toolbar with search, filter selects, an Archived chip, Clear, and a List/Board switch. The table shows a project chip, `AvatarStack` with submission progress, `StatusBadge`, `PriorityBadge` and a relative due date; it becomes stacked cards on mobile. Empty states tell "no tasks yet" apart from "no matches" |
| **Kanban board** | Basic columns | Status columns with a dot, label and count. Cards show project, priority, due date and avatars, with a hover lift. The board scrolls horizontally on small screens |
| **Task detail** | Two stacked cards and inline forms | A header with breadcrumbs, badges and workflow actions (Start, Submit, Review, Edit, Share, ⋯). The main column has blocked/returned banners, description, submissions with a review bar and version pills, and comment bubbles with replies and reactions. The sidebar holds a Properties panel, People and an Activity timeline. Edit and People forms now open in dialogs |
| **Todos** | A plain card list | Quick-add input and groups (Overdue / Today / Upcoming / No date / Done / Archived). Rows have a round complete checkbox, due date, priority, a reminder icon and archive on hover. The detail page has breadcrumbs and header actions |
| **Projects** | A divided text list | A 1/2/3-column card grid with a Grid/List switch. Each card shows an icon tile, status, a 2-line description, a progress bar with task counts, priority, due date (red when overdue) and avatars |
| **Project detail** | A header card plus a pill tab bar | Breadcrumbs, a large icon tile, badges, and a summary strip (owner, timeline, members, progress). Underline tabs with icons. The Overview has a details form, milestones (the existing `ProjectMilestonesPanel`, now shown) and a summary side panel. The Tasks, Board, Files, Meetings, Calendar and Notes tabs are restyled with proper loading and empty states |
| **Goals / Goal detail** | Plain cards with a progress bar | Summary stats, then cards with a `ProgressRing`, counts, target date, and "Achieved"/"Past target" badges. The detail page has a big ring, linked projects with their milestones, milestones and tasks panels, and an edit card |
| **Calendar** | Month grid with blank cells and a side list | Full-week month grid with muted out-of-month days, today ringed, chips coloured by event type, "+N more", type toggles, prev/next/Today, a Month/Agenda switch and a day side panel. Mobile uses the agenda list |
| **Meetings** | A flat list | Grouped by day (Today/Tomorrow/…). Each row has a date block, time range and duration, an online/in-person icon, avatars, and a Join button |
| **Meeting detail** | A button row and stacked panels | A header with breadcrumbs, organizer, meta row, and Join/Edit/Complete/Cancel. The main column has agenda, notes and action items (assignee, due date, convert to task). The sidebar has participants with RSVP (Accept / Maybe / Decline), linked tasks and files. The form is split into sections: When, Where (option cards), Who, Agenda, Reminders |
| **Chat** | Three columns of plain text rows | Full-height three panes. Channel list with unread pills. Conversation with chat bubbles: your own messages on the right, others grouped within 5 minutes, day separators, reaction pills, and a hover toolbar (react, reply, task, copy). The composer grows as you type. A toggleable details panel; on mobile you see either the list or the conversation |
| **Files** | A plain table with "Loading…" | A toolbar (upload, search, grid/list), then a file grid. Each card has a type-coloured icon tile with the extension, uploader, date and attachment; preview and download appear on hover, and a ⋯ menu offers rename, move and delete (delete now asks for confirmation). List view is a table |
| **Pages** | Plain cards and a bordered textarea | Document rows with excerpt, author and updated time, plus quick create and search. The detail page is a document-style editor: large title, word count, an auto-growing body, an unsaved indicator, Ctrl+S to save, and a delete confirmation dialog |
| **Reports** | Cards of numbers and basic charts | A toolbar card (range, custom dates, filters with a count, Clear). An Export dropdown (CSV/PDF) and Print. Six KPIs with deltas (overdue colours inverted). Charts: a status donut with a legend, and throughput shown as bars or a line with hover tooltips and a screen-reader data table. Also by-project and by-assignee tables with inline bars, a by-priority bar list, productivity, an AI narrative card, and an attention table |
| **Workload** | Text rows with a red bar | Summary stats. Each person is a row with a today-vs-capacity bar coloured by utilisation (green/amber/red), counts, a status badge, and warning callouts |
| **Risk** | Plain list with severity text | Summary cards. Each risk row has a severity rail and badge, reason chips, project, owner avatar, due date and score. The empty state reads "No risks detected" |
| **Activity** | A flat list | A vertical timeline grouped by day (sticky headers), with avatar plus entity-type badge, a linked title and relative time |
| **Notifications** | A list with an unread tint | An inbox with an icon and tone per type, unread dot / mark-read, an All/Unread filter with count, and mark-all-read |
| **Teams** | Inline create row and text member lists | A create dialog with an icon preview. Team cards show `AvatarStack`, counts, and member rows with a role select and remove (admins) or role badges (others) |
| **Users** | Plain cards | A table (avatar, email, role badge, created date) that becomes stacked rows on mobile, plus an "Admins only" state |
| **Automations** | Form fields and an On/Off button | A create card with a live "When … → …" preview. Rule cards read as a sentence and have an accessible `Switch` |
| **Settings** | Text links and stacked panels | A sticky section nav (tabs on mobile) and title/description + fields cards. Sections: Profile, **Appearance (theme picker)**, Workspace (logo preview, still owner-only), Members & invitations (table, role select, resend/revoke) and Notifications (switches) |

### Accessibility
- Visible `focus-visible` rings on every interactive element.
- `aria-label` and tooltips on icon buttons.
- `aria-current` on the active nav item.
- Radix primitives for menus, dialogs, tabs, selects and popovers (keyboard support and focus trapping).
- Switches with `role="switch"`, and a radiogroup for segmented controls.
- Priority shows an icon as well as colour.
- Charts have text summaries or data tables.
- `prefers-reduced-motion` is respected.
- Text tokens were chosen for WCAG AA in both themes.

## 5. Behaviour notes to be aware of
All logic is intact. These are small UX changes made along the way:
- **Tasks**
  - Task detail "Edit details" and "People" now open in dialogs.
  - Clear-filters resets search and all filters.
  - Share is disabled until someone is picked.
- **Meetings**
  - RSVP is Accept / Maybe / Decline buttons, and "Clear" sets it back to Pending.
  - Meeting detail now shows the description.
  - Calendar adds a Month/Agenda switch.
- **Todos**: todos can be completed and archived from the list, as well as from the detail page.
- **Files and pages**
  - Deleting a file asks for confirmation.
  - Pages delete uses a dialog instead of `window.confirm`.
  - The Pages list sorts by last updated.
- **Error toasts**: failed actions that call the API directly without a mutation (team member edits, file delete, preview) now show an error toast; before, they failed silently.
- **Lint**: the 5 pre-existing lint errors (set-state-in-effect, and reassigning during render in the donut charts) are fixed. `npm run lint` is now clean.
- **Known data quirk (API)**: a goal's `progress` can differ between the goals list and goal detail endpoints. The UI shows what each endpoint returns.

## 6. Verification
- `npm run typecheck`, `npm run lint` and `npm run build` pass.
- No changes to `backend/` or to `features/*/api.ts`, `hooks.ts` or `types.ts`.
- Before/after screenshots were captured for every route: light 1440, dark 1440 and light 375.
- Walked through manually: login, the command palette, creating a project (toast), the mobile drawer, and 8 routes with no console errors.
