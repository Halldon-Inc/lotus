# Lotus Connect Portal

You are building the Lotus Connect Portal - a centralized procurement and order management system.

Read BUILD-SPEC.md for the complete specification.

## Design References
- **Lotus colors**: Deep teal primary (#0D7377), gold/amber accent (#D4A843), clean whites, soft gray surfaces
- **Halldon vibes**: Premium, modern, generous whitespace, smooth animations, agency-level quality
- **HubSpot familiarity**: Left sidebar nav, slide-in detail panels, pipeline/kanban views, data tables, notification bell

## Rules
- NEVER use double dashes or em dashes in any text or copy
- TypeScript strict mode, no `any` types
- Server components by default, client components only when needed for interactivity
- Every page needs: loading state, error state, empty state
- Responsive design (works on tablet)
- All forms need proper validation with zod
- Premium design quality - this is for a real paying client
