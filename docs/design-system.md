# Aurbit Design System

## Purpose

Aurbit should feel like a polished, production-quality developer SaaS product.

The visual direction is inspired by the restraint, clarity, and confidence of products such as Vercel, while the system itself should have the consistency and reusable-component discipline of mature design systems such as Razorpay Blade.

The goal is:

```text
Vercel-like restraint
+
mature reusable component system
+
Aurbit's own typography and motion personality
```

---

# 1. Core Design Principles

## 1.1 Dark-first

Aurbit is a dark-only product for V1.

Do not build light-mode variants unless the product direction changes later.

The interface should use:

- near-black backgrounds
- carefully layered dark surfaces
- restrained borders
- high-contrast text
- subtle neutral states
- limited accent color usage

Dark mode should feel intentional, not like a light UI with inverted colors.

---

## 1.2 Clear over dense

Aurbit is a productivity dashboard, but it should not feel cramped.

Prefer:

- clear hierarchy
- comfortable spacing
- readable rows
- obvious grouping
- focused information

Avoid:

- overly dense enterprise tables
- tiny controls
- excessive metadata on every surface
- packing every available metric into a page

A user should be able to scan the interface quickly.

---

## 1.3 Functional before decorative

Every visual element should have a reason to exist.

Avoid decoration that competes with the product.

Prefer:

```text
clarity
hierarchy
spacing
contrast
typography
motion
```

over:

```text
large gradients
heavy shadows
glow everywhere
random glassmorphism
constant animations
```

---

## 1.4 Consistency over page-specific styling

Aurbit should not be designed one page at a time.

The hierarchy should be:

```text
Design tokens
↓
Primitives
↓
Reusable components
↓
Product patterns
↓
Pages
```

Do not create slightly different versions of the same component on different pages.

---

## 1.5 Subtle personality

Aurbit should not look like a generic shadcn dashboard.

Its personality should come from:

- typography
- spacing
- icon treatment
- motion
- carefully designed states
- layout rhythm
- product-specific components

Avoid trying to create personality through excessive color or decoration.

---

# 2. Visual Direction

Aurbit should feel:

- modern
- technical
- trustworthy
- calm
- precise
- premium
- minimal
- developer-oriented

It should not feel:

- playful
- cartoonish
- highly colorful
- overly corporate
- overly futuristic
- gamer-oriented
- heavily skeuomorphic

---

# 3. `apps/web` vs `apps/admin`

Both applications must use the same design system.

They should share:

- typography
- color tokens
- buttons
- form controls
- icons
- motion principles
- spacing
- surface styles
- component APIs

## `apps/web`

The public website may be more expressive.

It can use:

- larger typography
- stronger compositions
- richer motion
- product demonstrations
- interactive widget previews
- subtle background effects
- more visual storytelling

It should still remain restrained and premium.

Do not turn the marketing site into a completely different brand.

## `apps/admin`

The dashboard should be calmer and more functional.

Prioritize:

- readability
- information hierarchy
- predictable navigation
- clean tables
- strong empty/loading/error states
- efficient workflows

Avoid unnecessary decorative elements inside everyday operational screens.

---

# 4. Color System

Aurbit should use a primarily neutral, monochrome color system.

Think in terms of:

```text
black
near-black
dark gray
medium gray
light gray
white
```

rather than many brand colors.

Accent colors should be controlled and purposeful.

## Base layers

Use distinct dark layers for hierarchy.

Conceptually:

```text
background
surface
elevated surface
interactive surface
```

Do not create dozens of barely distinguishable background colors.

## Text hierarchy

At minimum support:

```text
text-primary
text-secondary
text-muted
text-disabled
```

Primary text should be highly readable.

Secondary and muted text must remain accessible.

Do not use low-opacity gray text that becomes difficult to read.

---

# 5. Semantic Colors

Color should communicate meaning.

Support semantic tokens for:

- success
- warning
- danger
- information

Aurbit-specific examples:

```text
Resolved → success
Critical priority → danger
Warning/attention → warning
Informational state → info
```

Do not use raw red/green/yellow values directly throughout application code.

Use semantic tokens/components.

---

# 6. Accent Color

Aurbit should follow the restrained accent philosophy seen in products such as Vercel.

Most of the interface should remain neutral.

Accent color can be used for:

- primary actions
- selected states
- focus states
- links
- charts where needed
- small brand moments

Do not make every card, icon, badge, or button colorful.

Status and priority colors are exceptions because they communicate meaning.

---

# 7. Borders and Shadows

Aurbit should rely primarily on:

```text
spacing
contrast
borders
surface differences
```

rather than heavy shadows.

## Borders

Use subtle borders to:

- separate surfaces
- define controls
- structure cards
- divide table rows
- establish component boundaries

Borders should remain visually quiet.

## Shadows

Use shadows sparingly.

Appropriate uses include:

- modal
- popover
- dropdown
- command palette
- floating widget preview
- elevated overlay

Avoid strong card shadows throughout dashboards.

---

# 8. Radius System

Aurbit should not force one radius across every component.

Radius should reflect the component.

Examples:

```text
small control → small radius
button → small/medium radius
input → small/medium radius
card → medium radius
dialog → medium/larger radius
large marketing panel → context-dependent
```

Do not use extremely rounded "pill" styling everywhere.

Pill shapes are appropriate only for components such as:

- compact badges
- status chips
- segmented controls where suitable

Avoid both extremes:

```text
everything square
everything rounded-2xl
```

---

# 9. Spacing

Spacing should feel deliberate and breathable.

Use a defined spacing scale rather than arbitrary values.

The UI should maintain consistency between:

- page sections
- form fields
- cards
- table rows
- navigation
- dialogs
- headings
- supporting text

Avoid arbitrary values such as:

```text
13px
17px
23px
31px
```

unless there is a genuine design requirement.

Prefer reusable spacing tokens.

---

# 10. Typography

Typography is one of Aurbit's primary sources of visual identity.

Do not settle for an obviously generic default appearance.

Aurbit should use a high-quality modern typeface with:

- strong readability
- distinctive character
- good numeric rendering
- good small-size performance
- multiple usable weights

The selected font must remain appropriate for a technical SaaS product.

Avoid novelty fonts.

## Typography hierarchy

Define reusable text styles rather than styling text independently on every page.

Conceptually:

```text
display
heading-xl
heading-lg
heading-md
heading-sm

body-lg
body-md
body-sm

label
caption
mono
```

Use hierarchy through:

- size
- weight
- spacing
- contrast

Do not rely entirely on font size.

---

# 11. Monospace Typography

Use monospace typography selectively for technical content.

Examples:

- project keys
- webhook event names
- code snippets
- URLs
- request IDs
- environment variables
- API examples

Do not use monospace for ordinary dashboard body text.

---

# 12. Icons

Use one consistent icon library unless a strong reason requires otherwise.

Icons should be:

- visually consistent
- simple
- recognizable
- appropriately sized

Avoid mixing unrelated icon styles.

Icons should generally support text rather than replace obvious labels in important actions.

---

# 13. Icon Motion

Icons are one of the places where Aurbit may express subtle motion.

Good examples:

- copy icon briefly changes after copying
- refresh icon rotates during refresh
- chevron smoothly rotates when expanded
- success icon subtly appears
- send icon moves slightly during submission
- loading icon animates naturally

Motion should communicate state or feedback.

Avoid constantly animated decorative icons.

---

# 14. Motion Philosophy

Aurbit should have high-quality motion, but motion must remain subtle.

Animation should make the product feel responsive and refined.

Use motion for:

- entering/exiting overlays
- expanding/collapsing sections
- tab transitions
- state changes
- icons
- loading
- success feedback
- page elements where transition improves understanding
- marketing demonstrations

Do not animate everything simply because it can be animated.

---

# 15. Hover Behavior

Not every element needs a hover animation.

Use hover feedback when it communicates interactivity.

Appropriate examples:

- buttons
- clickable rows
- dropdown triggers
- links
- cards that genuinely navigate
- icon buttons

Avoid:

- cards floating upward for no reason
- every container changing background
- every icon moving
- excessive scale effects
- large glow effects

The UI should remain stable.

---

# 16. Motion Timing

Animations should generally feel fast and subtle.

Prefer:

```text
short → micro interaction
medium → overlay/state transition
long → rare marketing animation
```

Avoid sluggish dashboard interactions.

Use consistent easing and durations through tokens or shared motion utilities where practical.

---

# 17. Reduced Motion

Respect users who prefer reduced motion.

Important product functionality must not depend entirely on animations.

---

# 18. Buttons

Buttons should use shared variants.

Likely initial variants:

```text
primary
secondary
outline
ghost
danger
```

Potential sizes:

```text
sm
md
lg
icon
```

Buttons should include appropriate states:

- default
- hover
- focus
- active
- disabled
- loading

Do not create custom button styling inside pages when the shared Button can support the use case.

---

# 19. Form Controls

Shared form controls should include:

- Input
- Textarea
- Select
- Checkbox
- Radio
- Switch
- FormField
- Label
- error/help text

Forms should look consistent between:

```text
apps/web
apps/admin
```

Validation should be clear without overwhelming the page with red.

---

# 20. Cards and Surfaces

Cards should not automatically be used for every section.

Use cards when grouping information helps understanding.

Avoid:

```text
card
 inside card
  inside card
```

Prefer flatter layouts where the hierarchy is already obvious.

Cards should rely more on subtle background/border contrast than heavy shadows.

---

# 21. Tables

Aurbit tables should be moderately spacious.

They should not feel like extremely compact enterprise data grids.

Rows should be easy to scan.

Tables may include:

- report title
- status
- priority
- project
- assignee
- created date
- actions

Prioritize important fields.

Do not display every available property simply because it exists.

## Table interaction

Clickable rows may receive subtle hover feedback.

Avoid strong hover animations.

Use clear selected/focused states.

Tables must remain usable on smaller screens through appropriate responsive strategies.

---

# 22. Status Components

Create reusable status components instead of styling statuses individually.

Bug report statuses:

```text
Open
In Progress
Resolved
Closed
```

Use restrained semantic styling.

Do not make status badges overly bright.

---

# 23. Priority Components

Create reusable priority indicators for:

```text
Low
Medium
High
Critical
```

Priority should remain quickly recognizable without dominating the report list.

`Critical` may receive stronger danger emphasis.

---

# 24. Navigation

Dashboard navigation should be predictable.

Expected concepts may include:

- organization switcher
- project switcher
- sidebar
- breadcrumbs where useful
- page header

Avoid excessive nesting.

A user should understand:

```text
Which organization am I in?
Which project am I viewing?
Where am I in Aurbit?
```

at a glance.

---

# 25. Sidebar

The dashboard sidebar should be visually restrained.

Use:

- clear active state
- consistent icon placement
- limited nesting
- clear organization/project context

Do not make the sidebar visually heavier than the page content.

---

# 26. Page Layout

Admin pages should generally follow a consistent structure:

```text
Page heading
Supporting description/actions
↓
Primary content
↓
Secondary content where necessary
```

Use reusable page-level patterns such as:

- PageHeader
- SettingsSection
- EmptyState
- FilterBar
- DataTable

Do not manually rebuild the same layout on every page.

---

# 27. Empty States

Empty states are important product experiences.

Examples:

```text
No projects yet
No bug reports yet
No team members invited
No webhooks configured
```

A good empty state should explain:

1. what is missing
2. why it matters
3. what action the user should take

Avoid excessive illustration unless it materially improves the experience.

---

# 28. Loading States

Loading states should feel intentional.

Use:

- skeletons
- subtle progress indicators
- localized loading feedback

Avoid full-page spinners for small operations.

Avoid large layout shifts when data arrives.

---

# 29. Error States

Errors should:

- explain what happened in understandable language
- provide retry where useful
- preserve useful user context
- avoid exposing technical stack traces

Use shared error-state patterns.

---

# 30. Toasts and Feedback

Use transient feedback for appropriate actions such as:

- copied embed code
- settings saved
- report updated
- invitation sent

Do not use toast notifications for every successful action.

If the changed state is already visually obvious, additional toast feedback may be unnecessary.

---

# 31. Dialogs and Overlays

Use dialogs for focused actions.

Examples:

- invite team member
- confirm destructive action
- create webhook
- preview widget

Dialogs should have:

- clear title
- concise description
- predictable actions
- correct focus management
- Escape handling where appropriate

Avoid using modals for long multi-page workflows unless justified.

---

# 32. Destructive Actions

Destructive actions must be visually and behaviorally distinct.

Examples:

- delete organization
- delete project
- remove team member
- delete webhook

Use danger styling selectively.

Require confirmation where the action has significant consequences.

Do not make ordinary cancel/back buttons red.

---

# 33. Widget Design

The embedded bug-report widget is part of the Aurbit product and should feel polished.

It should:

- remain visually lightweight
- avoid disrupting the host website
- clearly communicate its action
- feel responsive
- support configured accent color
- remain accessible
- work consistently across different host sites

The widget must not depend on the host website's design system.

---

# 34. Marketing Website

`apps/web` should be visually attractive while remaining aligned with the admin dashboard.

It may contain:

- polished hero section
- widget demos
- interactive report examples
- workflow visualizations
- subtle grid/background effects
- tasteful motion
- product screenshots
- technical integration examples

Avoid generic SaaS patterns such as excessive gradients, floating blobs, or meaningless 3D decoration unless there is a specific design reason.

---

# 35. Marketing Motion

The marketing site can use stronger motion than the dashboard.

Good uses:

- widget appearing on a mock product
- report flowing into the dashboard
- webhook event visualization
- small scrolling product demonstrations
- controlled reveal animations
- interactive code/widget examples

Motion should communicate how Aurbit works.

It should not exist only for spectacle.

---

# 36. Accessibility

Accessibility is part of the design system.

Components should support:

- semantic HTML
- keyboard navigation
- visible focus state
- appropriate ARIA where needed
- accessible labels
- sufficient contrast
- reduced-motion preferences
- usable disabled states

Do not hide important state using color alone.

---

# 37. Responsive Design

Aurbit should work well across common screen sizes.

The admin dashboard is primarily desktop-oriented but must remain usable on mobile.

Responsive behavior should be deliberately designed rather than simply shrinking desktop layouts.

Examples:

- tables may become cards/scrollable regions where appropriate
- sidebars may become drawers
- actions may collapse into menus
- page headers may stack

The public report form and widget must work especially well on mobile.

---

# 38. Design Tokens

Centralize important design values.

At minimum consider tokens for:

```text
colors
text colors
semantic colors
spacing
radius
borders
typography
motion duration
motion easing
z-index
```

Do not scatter arbitrary design constants throughout page code.

---

# 39. Tailwind Usage

Tailwind is an implementation tool, not the design system itself.

Prefer design-system classes/tokens and shared components over arbitrary one-off utility combinations.

Avoid excessive arbitrary values such as:

```text
w-[437px]
rounded-[13px]
text-[#b5b5b5]
mt-[19px]
```

unless there is a legitimate requirement.

If the same pattern appears repeatedly, turn it into a token, variant, or reusable component.

---

# 40. shadcn/ui Usage

Use shadcn/ui as a strong base for accessible primitives where useful.

Do not treat default shadcn styling as the finished Aurbit visual identity.

Customize components to follow Aurbit:

- colors
- typography
- spacing
- radius
- states
- motion
- density

Do not repeatedly copy shadcn components into page-level folders with slightly different styling.

---

# 41. Shared UI Package

Reusable design-system components should live in:

```text
packages/ui
```

Potential structure:

```text
packages/ui/
├── components/
├── primitives/
├── tokens/
└── styles/
```

Do not create every possible component before it is needed.

Grow the system alongside the product.

---

# 42. Initial Component Set

Start with components that are immediately useful.

Examples:

```text
Button
Input
Textarea
Select
Checkbox
Switch
Badge
Avatar
Tooltip
Dialog
DropdownMenu
Tabs
Table
Skeleton
Toast
Separator
```

Then introduce product patterns as real usage appears:

```text
PageHeader
DashboardShell
Sidebar
OrganizationSwitcher
ProjectSwitcher
DataTable
FilterBar
MetricCard
EmptyState
SettingsSection
ReportStatusBadge
PriorityBadge
```

---

# 43. Component Creation Rule

Before creating a component:

1. search for an existing equivalent
2. check whether the current component can be extended cleanly
3. check whether shadcn/Radix already provides an appropriate accessible primitive
4. create a new component only when the behavior or pattern is genuinely different

Do not create:

```text
PrimaryButton
SubmitButton
SaveButton
CreateProjectButton
```

when all can use the shared Button component.

---

# 44. Component States

Interactive components should support applicable states.

Examples:

```text
default
hover
focus
active
disabled
loading
selected
error
success
```

Do not design only the ideal/default screenshot state.

Production UI must handle the entire interaction lifecycle.

---

# 45. Product-Specific Patterns

Create reusable Aurbit-specific patterns when they repeat.

Examples:

## Report Status Badge

```text
Open
In Progress
Resolved
Closed
```

## Priority Badge

```text
Low
Medium
High
Critical
```

## Widget Preview

Reusable preview of project widget settings.

## Project Selector

Consistent project-switching experience.

## Organization Selector

Consistent workspace-switching experience.

## Report Metadata

Standard visual treatment for:

- browser
- OS
- viewport
- URL
- timestamp

These patterns should not be reimplemented differently across pages.

---

# 46. Data Visualization

Aurbit V1 only needs basic analytics.

Charts should remain minimal.

Use charts only when they communicate information better than plain numbers.

Examples:

- reports by status
- reports by priority
- reports over time

Do not add decorative dashboards filled with charts merely to make the product appear complex.

---

# 47. Content and Labels

UI text should be:

- concise
- clear
- professional
- direct

Avoid unnecessarily technical language for ordinary users.

Example:

Prefer:

```text
Couldn't save changes. Try again.
```

over:

```text
Mutation request failed with HTTP 500.
```

Technical information may be available separately for debugging where appropriate.

---

# 48. Visual Review Rules

Before considering a UI feature complete, check:

```text
Does it use existing shared components?
Does spacing feel consistent?
Does typography hierarchy make sense?
Are loading/empty/error states present?
Does it work on mobile?
Does keyboard navigation work?
Are hover/focus states intentional?
Is there unnecessary animation?
Is there unnecessary color?
Does it still feel like Aurbit?
```

---

# 49. AI/Codex Design Rules

When using AI to implement Aurbit UI:

- read this file before meaningful UI work
- inspect existing components before creating new ones
- do not invent a new visual style per page
- do not use arbitrary colors
- do not add gradients by default
- do not add hover animations to everything
- do not add excessive shadows
- do not add excessive rounded cards
- do not create duplicate primitives
- do not replace shared components with raw page-level implementations
- do not blindly use default shadcn appearance
- do not directly clone Vercel or Razorpay components

Prefer:

```text
existing tokens
existing components
existing interaction patterns
existing motion language
```

If a design requirement cannot be achieved with the current system, extend the system deliberately rather than bypassing it.

---

# 50. Final Design Principle

Aurbit should feel impressive because it is coherent, not because it is visually loud.

The desired result is:

```text
dark
precise
clear
breathable
technical
premium
subtly animated
consistent
```

The product should feel thoughtfully designed even when the UI is simple.

When choosing between:

```text
more decoration
```

and:

```text
better hierarchy + spacing + typography + interaction detail
```

prefer the second.
