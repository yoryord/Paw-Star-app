# 🐾 Paw Star

**Paw Star** is a social platform for cat and dog lovers. Users register, build profiles for their pets, post stories, interact with other pet owners through likes and comments, and compete in weekly "Star of the Week" rankings.

---

## Table of Contents

- [Features](#features)
- [User Roles](#user-roles)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)

---

## Features

| Feature | Description |
|---|---|
| **Pet Profiles** | Create and manage profiles for cats and dogs, including photos, biography, breed, birthdate and location |
| **Stories** | Write and publish blog-style stories, tag your own pets and add a cover image |
| **Likes** | Like pet profiles and stories posted by other users |
| **Comments** | Comment on stories (authenticated users only) |
| **Rankings** | All-time and weekly like counts per pet; weekly top cat and dog are highlighted as **Star of the Week** |
| **Search** | Full-text search for stories by keyword or tag |
| **Messaging** | Direct messages between authenticated users |
| **Public Profiles** | View any user's public profile, their pets and stories |
| **Admin Panel** | Admins can view all users, manage roles and delete accounts |

---

## User Roles

| Role | Capabilities |
|---|---|
| **Anonymous visitor** | Browse stories, rankings, public pet and user profiles |
| **Authenticated user** | Everything above, plus create/edit own pet profiles, post/edit stories, like, comment, send messages, manage own account |
| **Admin** | Full access, plus user management (view all accounts, promote/demote roles, delete users) via the admin panel |

Roles are stored in the `public.user_roles` table and enforced through Supabase **Row Level Security (RLS)** policies and a `is_admin()` security-definer function.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│               Browser (Client)               │
│  Vanilla JS · HTML · CSS · Bootstrap 5       │
│  Vite-bundled SPA with client-side routing   │
└────────────────────┬─────────────────────────┘
                     │ HTTPS / Supabase JS SDK
┌────────────────────▼─────────────────────────┐
│               Supabase (Backend)             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Auth     │  │ Database │  │  Storage  │  │
│  │ (JWT)    │  │(PostgreSQL│  │  Buckets  │  │
│  └──────────┘  └──────────┘  └───────────┘  │
└──────────────────────────────────────────────┘
```

- **Frontend:** Single-Page Application (SPA) with Vanilla JavaScript, HTML and CSS. No frontend framework. Pages are dynamically rendered modules loaded by a client-side router. Bootstrap 5 is used for responsive UI components.
- **Backend:** Fully managed by [Supabase](https://supabase.com), providing authentication, a PostgreSQL database with RLS, storage buckets for images, and real-time capabilities.
- **Routing:** Custom `history.pushState`-based router (`src/app/router.js`) with static and regex-pattern dynamic routes.
- **Build Tool:** [Vite](https://vite.dev) for local development (HMR) and production bundling.
- **Hosting:** [Netlify](https://netlify.com) — SPA redirects are configured via `public/_redirects`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI / Markup | HTML5, CSS3, Bootstrap 5 |
| JavaScript | Vanilla JS (ES Modules, no framework) |
| Bundler | Vite 7 |
| Backend-as-a-Service | Supabase |
| Database | PostgreSQL (via Supabase) |
| Authentication | Supabase Auth (email + password, JWT) |
| File Storage | Supabase Storage |
| Package Manager | npm |
| Hosting | Netlify |
| Source Control | GitHub |

---

## Database Schema

All migrations live in [`supabase/migrations/`](supabase/migrations/) and follow the naming convention `YYYYMMDDHHMMSS_description.sql`.

### Core Tables

| Table | Purpose |
|---|---|
| `auth.users` | Supabase-managed user accounts |
| `public.users_profiles` | 1-to-1 extension of `auth.users` — display name, avatar, bio, country |
| `public.user_roles` | Per-user role assignment (`user` or `admin`) |
| `public.pets` | Pet profiles linked to their owner — name, species (`cat`/`dog`), breed, location |
| `public.stories` | Published stories (previously `blogs`) — title, content, cover image, status |
| `public.story_pet_tags` | Many-to-many link between stories and the owner's pets |
| `public.pet_likes` | Records which user liked which pet |
| `public.story_likes` | Records which user liked which story |
| `public.comments` | Story comments by authenticated users |

### Enums

| Enum | Values |
|---|---|
| `pet_species` | `cat`, `dog` |
| `blog_status` | `draft`, `published` |
| `app_role` | `user`, `admin` |

### Storage Buckets

| Bucket | Content |
|---|---|
| `avatars` | User profile pictures |
| `pet-pictures` | Pet profile photos |
| `story-covers` | Story cover images |

---

## Project Structure

```
paw-star-app/
├── public/
│   ├── paw_star_logo_v1.png    # App logo served as a static asset
│   └── _redirects              # Netlify SPA redirect rule (/* → /index.html)
│
├── src/
│   ├── main.js                 # App entry point: bootstraps auth then the router
│   │
│   ├── app/
│   │   └── router.js           # Client-side SPA router (static + dynamic routes)
│   │
│   ├── lib/
│   │   ├── supabase.js         # Supabase client singleton
│   │   └── auth.js             # Auth helpers: session cache, isLoggedIn, isAdmin
│   │
│   ├── components/
│   │   ├── header/             # App header with nav and auth-aware links
│   │   └── footer/             # App footer
│   │
│   ├── pages/                  # One folder per route
│   │   ├── index/              # Home page (/)
│   │   ├── login/              # Sign-in page (/login)
│   │   ├── register/           # Sign-up page (/register)
│   │   ├── my-space/           # Authenticated user's personal dashboard (/my-space)
│   │   ├── profile/            # Edit own account profile (/profile)
│   │   ├── public-profile/     # View another user's profile (/public_profile/:id)
│   │   ├── pets/
│   │   │   ├── new/            # Create a new pet profile (/pets/new)
│   │   │   ├── view/           # View a pet profile (/pets/:id/view)
│   │   │   └── edit/           # Edit a pet profile (/pets/:id/edit)
│   │   ├── stories/
│   │   │   ├── stories.js      # Stories listing and search (/stories)
│   │   │   ├── new/            # Create a story (/stories/new)
│   │   │   ├── view/           # Read a story (/stories/:id/view)
│   │   │   └── edit/           # Edit a story (/stories/:id/edit)
│   │   ├── admin/              # Admin panel — user management (/admin)
│   │   ├── contacts/           # Contact page (/contacts)
│   │   ├── faq/                # FAQ page (/faq)
│   │   ├── privacy-policy/     # Privacy policy (/privacy-policy)
│   │   ├── terms-of-service/   # Terms of service (/terms-of-service)
│   │   ├── disclaimer/         # Disclaimer (/disclaimer)
│   │   └── not-found/          # 404 fallback (/404)
│   │
│   └── styles/
│       └── global.css          # Global CSS variables and base styles
│
├── supabase/
│   └── migrations/             # Ordered SQL migration files applied to Supabase
│
├── sample_data/
│   └── sample_pets_and_stories.sql   # Optional seed data for development
│
├── index.html                  # Vite entry HTML — mounts <div id="app">
├── vite.config.js              # Vite config with dev-server upload middleware
└── package.json
```

---

## Local Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) v9 or higher
- A [Supabase](https://supabase.com) project (free tier is sufficient)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/paw-star-app.git
cd paw-star-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root (this file is git-ignored):

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

Both values are available in your Supabase project under **Settings → API**.

### 4. Apply database migrations

Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
# Link to your remote project
supabase link --project-ref <your-project-ref>

# Push all migrations
supabase db push
```

Alternatively, run the SQL files in [`supabase/migrations/`](supabase/migrations/) manually in the Supabase SQL Editor, in filename order.

### 5. (Optional) Seed sample data

```bash
# Via Supabase CLI
supabase db execute --file sample_data/sample_pets_and_stories.sql
```

Or paste the contents directly into the Supabase SQL Editor.

### 6. Start the development server

```bash
npm run dev
```

The app is available at **http://localhost:5173**.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server with HMR on port 5173 |
| `npm run build` | Build production bundle into `dist/` |
| `npm run preview` | Locally preview the production build |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Full URL of your Supabase project |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous/public API key |

> ⚠️ Never commit `.env.local` or any file containing your service-role key to version control.

---

## Deployment

The app is deployed on **Netlify**. The [`public/_redirects`](public/_redirects) file contains the SPA rewrite rule:

```
/*    /index.html   200
```

This ensures all routes are served by `index.html` and handled client-side by the router.

Set the same environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in **Netlify → Site settings → Environment variables**.

Build settings:
- **Build command:** `npm run build`  
- **Publish directory:** `dist`
