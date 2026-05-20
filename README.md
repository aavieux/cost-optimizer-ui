<div align="center">
  <img src="./src/assets/logo.svg" alt="Cloud Zenith" width="120" />

  # Cloud Zenith — Cost Optimizer UI

  Frontend for the Cloud Zenith Kubernetes cost optimization platform. Visualizes cluster rightsizing recommendations and savings opportunities across customers and workloads.
</div>

---

## Overview

Cloud Zenith Cost Optimizer UI is a React dashboard that connects to the [cost-optimizer](../cost-optimizer) Go backend. It gives platform teams a single pane of glass to:

- Track infrastructure spend and projected savings across all customers
- Drill into individual clusters and see per-workload CPU/RAM usage vs. configured requests/limits
- Review rightsizing recommendations and understand workload health status (wasteful, under-provisioned, unbounded, etc.)
- Manage customers (create, rename, delete) and switch between them

## Features

- **Dashboard** — aggregate spend, recommended target, and total savings with 7-day / 30-day windows
- **Customers** — searchable, sortable customer list with inline CRUD
- **Customer detail** — cost breakdown and cluster grid with workload status indicators
- **Cluster detail** — time-series CPU/RAM charts (actual vs. requested vs. recommended), workload recommendations table, savings summary
- **Currency toggle** — switch between USD and EUR globally
- **Auth** — JWT-based login with automatic 401 redirect

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | React 19 + TypeScript |
| Build | Vite |
| Routing | React Router 7 |
| Server state | TanStack Query 5 |
| HTTP | Axios |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Charts | Recharts |
| Animations | Framer Motion |
| Icons | Lucide React |
| Notifications | Sonner |

## Getting Started

### Prerequisites

- Node.js 20+
- The [cost-optimizer](../cost-optimizer) backend running on `http://localhost:8080`

### Install & run

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment

Create a `.env` file in the project root if you need to override the API base URL:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

### Other scripts

```bash
npm run build    # Type-check + production build
npm run preview  # Serve the production build locally
npm run lint     # Run ESLint
```

## Project Structure

```
src/
├── pages/          # Route-level components (Login, Dashboard, Customers, Cluster, ...)
├── components/     # Shared UI components and shadcn wrappers
├── hooks/          # TanStack Query hooks — one per API resource
├── context/        # Global client state (currency)
├── lib/
│   ├── api.ts      # Axios instance with auth interceptor
│   └── format.ts   # Currency, bytes, percentage formatters
└── types/          # TypeScript interfaces mirroring the backend API
```

## Authentication

Login with your Cloud Zenith credentials. The JWT is stored in `localStorage` and attached as a `Bearer` token to every request. Sessions expire after 30 minutes; the app redirects to the login page on any `401`.

## Documentation

Additional documentation lives in [`docs/`](./docs):

- [`API.md`](./docs/API.md) — full backend API reference
- [`architecture.md`](./docs/architecture.md) — architecture decision records
- [`CLAUDE.md`](./docs/CLAUDE.md) — developer guide and conventions
