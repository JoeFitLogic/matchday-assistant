# Matchday Assistant

## Project Overview
Mobile-first web app for managing youth football match nights and player development.
Used by coaches running multiple 5-a-side teams for children aged 6-7.
Each Friday session: multiple teams, 5 matches of 10 minutes each.

## Tech Stack
- Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Backend: Supabase (Auth, Database, Realtime)
- Deployment: Vercel
- PWA: next-pwa for installable mobile experience

## Architecture Decisions
- Mobile-first responsive design — large touch targets, minimal scrolling
- Supabase Row Level Security (RLS) for multi-tenant data isolation
- All times stored in UTC, displayed in UK timezone
- Season-based data model (players belong to a club → season → squad)

## Key Conventions
- Use UK English in all user-facing text
- Components in /src/components, organised by feature
- Database types auto-generated from Supabase
- Use server components by default, client components only when needed
- Tailwind for all styling — no CSS modules

## Current Phase
Phase 1: Single-club MVP for Livingston Community FC

## File Structure
/src
  /app          — Next.js App Router pages
  /components   — React components by feature
  /lib          — Supabase client, utils, types
  /hooks        — Custom React hooks
/supabase
  /migrations   — Database migrations
/public         — Static assets