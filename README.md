# Agency Retrospective Tool

Internal tool for tracking project performance, comparing estimates vs actuals, and capturing retrospectives.

## Features

- **Projects Dashboard** - Overview of all active projects with key metrics
- **Project Detail** - Complete view with hours by profile, scope items, external costs, and retrospective
- **Analytics** - Insights across all projects, by team, and individual project comparison
- **Change Requests** - Track additional budget added to projects
- **Scope Items** - Track deliverables (wireframes, components, pages) planned vs actual
- **Profit Margin Tracking** - Compare estimated vs actual margins

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Charts**: Recharts

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to SQL Editor and run the contents of `supabase-schema.sql`
3. Go to Settings -> API and copy your project URL and anon key

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install & Run

```bash
npm install
npm run dev
```

### 4. Deploy to Netlify

1. Connect your repo to Netlify
2. Add environment variables in Netlify dashboard
3. Enable Netlify password protection for internal use

## Data Model

### Projects
Basic project info, offer value, status, retrospective notes

### Profile Hours
Hours by role (UX, UI, DEV, PM, CONTENT, ANALYTICS) - estimated vs actual

### Scope Items
Deliverables count (wireframes, components, pages, etc.) - planned vs actual

### External Costs
Contractor and other external costs - estimated vs actual

### Change Requests
Additional budget added to the project after initial offer

## Calculations

- **Total Value** = Offer + Sum(Change Requests)
- **Hours Variance** = (Actual - Estimated) / Estimated × 100
- **Estimated Cost** = (Estimated Hours × €50) + Estimated External Costs
- **Actual Cost** = (Actual Hours × €50) + Actual External Costs
- **Margin** = (Value - Cost) / Value × 100

## License

Internal use only - Renderspace
