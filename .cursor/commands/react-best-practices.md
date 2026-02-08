# React Best Practices - Vercel Engineering

React and Next.js performance optimization guidelines from Vercel Engineering. Contains 45+ rules across 8 categories, prioritized by impact.

## When to Use

- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React/Next.js code
- Optimizing bundle size or load times

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Eliminating Waterfalls | CRITICAL | `async-` |
| 2 | Bundle Size Optimization | CRITICAL | `bundle-` |
| 3 | Server-Side Performance | HIGH | `server-` |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH | `client-` |
| 5 | Re-render Optimization | MEDIUM | `rerender-` |
| 6 | Rendering Performance | MEDIUM | `rendering-` |
| 7 | JavaScript Performance | LOW-MEDIUM | `js-` |
| 8 | Advanced Patterns | LOW | `advanced-` |

## How to Use

### Full Compiled Document

Read the complete guide with all rules expanded:

```
.cursor/skills/vercel-react-best-practices/AGENTS.md
```

### Individual Rule Files

Read specific rules by category:

```bash
# Waterfall elimination
cat .cursor/skills/vercel-react-best-practices/rules/async-parallel.md
cat .cursor/skills/vercel-react-best-practices/rules/async-defer-await.md

# Bundle optimization
cat .cursor/skills/vercel-react-best-practices/rules/bundle-barrel-imports.md
cat .cursor/skills/vercel-react-best-practices/rules/bundle-dynamic-imports.md

# Server performance
cat .cursor/skills/vercel-react-best-practices/rules/server-cache-lru.md
cat .cursor/skills/vercel-react-best-practices/rules/server-parallel-fetching.md

# Re-render optimization
cat .cursor/skills/vercel-react-best-practices/rules/rerender-functional-setstate.md
cat .cursor/skills/vercel-react-best-practices/rules/rerender-lazy-state-init.md
```

### All Available Rules

```
.cursor/skills/vercel-react-best-practices/rules/
├── async-api-routes.md
├── async-defer-await.md
├── async-dependencies.md
├── async-parallel.md
├── async-suspense-boundaries.md
├── bundle-barrel-imports.md
├── bundle-conditional.md
├── bundle-defer-third-party.md
├── bundle-dynamic-imports.md
├── bundle-preload.md
├── client-event-listeners.md
├── client-swr-dedup.md
├── js-batch-dom-css.md
├── js-cache-function-results.md
├── js-cache-property-access.md
├── js-cache-storage.md
├── js-combine-iterations.md
├── js-early-exit.md
├── js-hoist-regexp.md
├── js-index-maps.md
├── js-length-check-first.md
├── js-min-max-loop.md
├── js-set-map-lookups.md
├── js-tosorted-immutable.md
├── rendering-activity.md
├── rendering-animate-svg-wrapper.md
├── rendering-conditional-render.md
├── rendering-content-visibility.md
├── rendering-hoist-jsx.md
├── rendering-hydration-no-flicker.md
├── rendering-svg-precision.md
├── rerender-defer-reads.md
├── rerender-dependencies.md
├── rerender-derived-state.md
├── rerender-functional-setstate.md
├── rerender-lazy-state-init.md
├── rerender-memo.md
├── rerender-transitions.md
├── server-after-nonblocking.md
├── server-cache-lru.md
├── server-cache-react.md
├── server-parallel-fetching.md
└── server-serialization.md
```

## Quick Reference

### Critical Rules (Always Apply)

1. **async-parallel** - Use Promise.all() for independent operations
2. **bundle-barrel-imports** - Import directly, avoid barrel files
3. **server-parallel-fetching** - Restructure components to parallelize fetches

### High Impact Rules

4. **async-suspense-boundaries** - Use Suspense to stream content
5. **bundle-dynamic-imports** - Use next/dynamic for heavy components
6. **server-cache-lru** - Use LRU cache for cross-request caching

### Medium Impact Rules

7. **rerender-functional-setstate** - Use functional setState for stable callbacks
8. **rerender-lazy-state-init** - Pass function to useState for expensive values
9. **rendering-content-visibility** - Use content-visibility for long lists

## Source

Vercel Engineering - January 2026
https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
