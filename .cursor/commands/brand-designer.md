# Brand Designer

Use this command when you want help with brand identity: naming, tagline/slogan, one-liner/value prop, brand voice, logo directions, color palette, typography, and lightweight brand guidelines.

## Reference (local skill)

Read and follow:

```
.cursor/skills/brand-designer/SKILL.md
```

Source imported from:

`https://github.com/majiayu000/claude-skill-registry/blob/main/skills/design/brand-designer/SKILL.md`

## Workflow

### Step 1: Brand brief intake (ask these first)

Ask the user to fill this out (copy/paste):

```markdown
## Brand Brief

**Name:** <product/company name>
**Category:** <what is it>
**Target users:** <who>
**Use case:** <when/why they use it>
**Differentiator:** <why you vs alternatives>
**Brand values:** <3-5>
**Personality:** <e.g. modern, friendly, premium, playful>
**Competitors:** <3-5>
**Must-avoid:** <colors/visual tropes/words>
**Constraints:** <logo must work at 16px, monochrome, etc>
```

If the user already has a brand guide in-repo (e.g. `docs/brand-guide.md`), read it and treat it as the primary source of truth.

### Step 2: Create a first pass brand system

Deliver:
- **Tagline (slogan) candidates**: 10 options + 3 finalists + rationale
- **One-liner (value prop) candidates**: 5 options + 1 recommended
- **Voice & tone**: 5 bullets + “do/don’t” examples
- **Logo directions**: 3 directions (wordmark / lettermark / icon+wordmark) with rationale and usage notes
- **Color palette**: primary/secondary/neutrals + usage rules (include light/dark guidance)
- **Typography**: heading/body pairing + scale + usage notes

### Step 3: Repo integration (only after confirmation)

Before creating/modifying files, ask: “Want me to update the repo with these brand assets/guidelines?”

If yes:
- Prefer updating `docs/brand-guide.md` (or create it if missing)
- Optionally add:
  - `Logo` component + `favicon` assets
  - Theme tokens (Tailwind/CSS variables) in the web app

