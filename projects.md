# Projects — Reference Material

Internal document for CV preparation. Not for publication.
All projects below are company projects — no personal ownership claimed.

Involvement key:
- **Core contributor** — actively implemented significant parts of the project.
- **Contributor (joined late)** — joined mid-project; contributed features and maintenance, did not architect.

---

## I. D B International Technology (04/2025 – Present)

Full-stack engineering across web-based casino/gaming products. Stack: **NestJS (DDD-style layout)**, **React.js**, **Cocos Creator (TypeScript)**, **RabbitMQ**, **PostgreSQL/TypeORM**, **Docker**, **Kubernetes**, **Nginx**.

### 1. Game Platform (gateway + micro-services)

**Role:** Contributor (joined late).

**What the system does:**
A multi-service gaming platform where users browse a lobby of games (by vendor, category, game), authenticate through an account service, and launch game clients. A gateway sits in front and fans requests out to downstream services.

**Architecture:**
- NestJS gateway in front; backend split into `account-service` (auth + user accounts) and `lobby-service` (category, game, vendor) micro-services.
- Services communicate over **RabbitMQ** (`amqplib` + `amqp-connection-manager`).
- Deployed on **Kubernetes** to scale under concurrent user load.
- Gateway: Swagger-documented HTTP ingress, global `@nestjs/throttler` rate limiting, JWT auth proxying (`@nestjs/jwt` + bcryptjs), Alibaba OSS (`ali-oss`) object storage with `sharp` image processing, response-time middleware, health checks.
- DDD-style layout: `domain/` (constants, enums, models) + `infrastructure/` (controllers, configurations, auth, utils) + `use-cases/` (account-service, lobby-service).

**Recruiter-facing bullets (suggested):**
- Contributed to a NestJS micro-service gaming platform — gateway fronting account and lobby services over RabbitMQ, deployed on Kubernetes.
- Worked across gateway features: auth proxying, lobby (game/vendor/category) routing, and object-storage uploads to Alibaba OSS with Sharp image processing.
- Hardened the public edge with `@nestjs/throttler` rate limits and Swagger-documented APIs.

---

### 2. Digital Scratch Card (ticket generator + batch pipeline)

**Role:** Core contributor.

**What the service does:**
Generates real scratch-card tickets. Each ticket satisfies strict product rules — winning tickets match a canonical **weight table** (legal multiplier + combination pairs); losing tickets embed "near-miss" cells that look close to a win without actually winning.

**Stack:** NestJS 11, TypeScript (strict), TypeORM + PostgreSQL, `class-validator` + `ValidationPipe`, Docker + Docker Compose.

**Ticket engine:**
- DTO validation + reference validation against a canonical weight table (multiplier/combination fingerprint match, float-safe sum check, payout = multiplier × bet).
- Scratch grid engine: 5 distinct **W** numbers + 20 globally-unique **Y** cells. Winning tickets place `hitCount` W-values at random Y-positions and fill the rest with disjoint values (no accidental hits). Losing tickets embed 4–8 **near-miss** positions (Y = W ± 1 with edge handling for "00"/"99").
- Amount-layout engine: 20 prize cells split into Low (4) / Medium (4) / High (6) / Jackpot (6) pools with per-band rules — jackpot must use exactly two distinct denominations. Near-miss cells get priority for higher tiers.
- Retry loop (up to 10 attempts) — if any assertion fails (`assertScratchValid`, `assertAmountLayoutValid`), the engine redraws; a 503 is returned if all attempts fail.
- `ticket_no` format `NO.{YYYYMMDD}-{ULID}-{checksum}` with a **mod-97** check-digit.
- Persists `w_numbers`, `y_numbers`, `near_miss_positions`, `amount_layout` (JSONB), unique `ticket_no` in PostgreSQL.

**Batch pipeline:**
- Bulk generator that produced on the order of **130 million** tickets, persisted to PostgreSQL.

**Frontend:** Cocos Creator 3.8 (TypeScript).

**Recruiter-facing bullets (suggested):**
- Built the Digital Scratch Card ticket-generation service in NestJS + TypeORM/PostgreSQL — enforced a canonical weight-table and a retry-bounded random-draw engine with per-tier amount-layout rules.
- Authored engines for scratch-grid, near-miss generation, amount layout, and mod-97 ticket-number checksums; deterministic validators fail closed after 10 retry attempts.
- Extended the service into a batch pipeline that generated ~130M tickets into PostgreSQL with JSONB payloads for downstream use.
- Shipped the game client in Cocos Creator (TypeScript); containerized backend with Docker for deploys.

---

### 3. Chicken Road Crash (real-time multiplier crash game)

**Role:** Core contributor.

**What it is:**
A real-time "crash"-style multiplier game — players place a bet, watch a multiplier climb, and cash out before the crash point. Runs in the browser behind Nginx, containerized with Docker.

**Backend stack:** NestJS 11, TypeORM + PostgreSQL, **Socket.IO** (`@nestjs/platform-socket.io` + `@nestjs/websockets`), RabbitMQ (`amqplib`), event-emitter, JWT auth, class-validator.

**Backend layout:**
- DDD: `domain/` (constants, enums, models, repository-interfaces) + `infrastructure/` (auth-module, entities, gateways, controllers, services, repositories, configurations) + `use-cases/`.
- Bet use-cases: `create-bet`, `cash-out`, `check-crash-point`, `retrieve-bet-by-id`, `retrieve-bets-by-user`, plus an `events/` sub-tree.
- Real-time surface: `bet.gateway.ts` — Socket.IO gateway broadcasting round/bet state; DTOs under `gateways/dtos/`.
- Entities: `bet.entity.ts`, `user-account.entity.ts`, base entity class.
- Dockerfile + docker-compose; deployed behind Nginx.

**Frontend:** Cocos Creator + TypeScript; containerized.

**Recruiter-facing bullets (suggested):**
- Developed *Chicken Road Crash*, a real-time multiplier crash game — NestJS backend (DDD) with a Socket.IO gateway for round state and cash-out events, PostgreSQL/TypeORM for bet persistence, RabbitMQ for event fan-out.
- Implemented the bet lifecycle (create-bet, check-crash-point, cash-out) with event-driven use-cases and JWT-authenticated WebSocket connections.
- Built the game client in Cocos Creator (TypeScript); containerized with Docker and deployed behind Nginx.

---

## II. CeylonX Corporation — Associate SE (12/2024 – 03/2025)

Full-stack on B2B SaaS — streaming platform + CeylonX public website — for Sri Lankan clients. Stack: **React.js (Vite)**, **Node.js/Express**, **MongoDB**, **MySQL**, **Firebase**, **Stripe**, **AWS**, GitHub-triggered CI/CD.

### 4. Susila Movie App (subscription streaming platform — Sinhala movies & TV)

**Role:** Core contributor across web client, API, and admin panel.

**What it does:**
Subscription-based streaming platform for Sinhala movies and TV series. Admin panel manages catalog and subscriptions; client streams content to end users.

**Stack:**
- Web client: React.js + Vite + SCSS.
- Backend: Node.js REST API.
- Admin panel: React.js + SCSS.

**Streaming architecture:**
- Video served over **HLS** (`.m3u8` manifests) through HLS players to scale to many concurrent viewers.
- **Vimeo** used as the video origin/CDN to offload bandwidth and transcoding.
- Stripe for subscriptions; Firebase for push notifications.

**Recruiter-facing bullets (suggested):**
- Built Susila — a Sinhala-language streaming platform — across React.js + Vite web client, Node.js REST backend, and React admin for catalog/subscriptions.
- Delivered video through **HLS (m3u8)** players with **Vimeo** as the origin, allowing horizontal scale to many concurrent viewers without running own transcoding/CDN.
- Integrated **Stripe** for recurring subscriptions and **Firebase Cloud Messaging** for push notifications.
- Deployed services to **AWS** with GitHub-triggered CI/CD, owning pre-prod to prod rollouts end-to-end.

---

### 5. CeylonX Corporate Website + Admin Portal

**Role:** Core contributor across public site, admin, and backend.

**Stack:**
- Public site: React 18 + Vite, MUI + Material Tailwind + DaisyUI + Tailwind, Framer Motion, **Three.js + three-globe** (3D globe), react-helmet for SEO, react-slick/react-spring, `vite-plugin-compression`.
- Admin: React 18 + Vite + Tailwind, **TinyMCE** rich-text editor, react-dropzone uploads.
- Backend: Node.js + Express + **MongoDB** (Mongoose), JWT + bcrypt auth, multer uploads, nodemailer.

**What it does:**
Corporate website for CeylonX — marketing site, blog, work portfolio, career/job board, job-application intake, testimonials, meeting scheduling, and a "project request" lead funnel. Admin panel edits all CMS-like content with TinyMCE.

**Backend domains:** `auth`, `blog` + `blogCategory`, `work` + `workCategory`, `jobPost` + `jobApplication`, `testimonial`, `projectRequest`, `meeting`, `email`.

**Recruiter-facing bullets (suggested):**
- Built the CeylonX corporate website and admin portal — React/Vite frontend with a 3D globe (Three.js + three-globe) and Framer-Motion-driven marketing pages, backed by an Express/MongoDB API covering blog, portfolio, careers, testimonials, and a project-request funnel.
- Shipped a TinyMCE-based admin panel for non-technical editors to manage blogs, jobs, work items, and testimonials.
- Implemented JWT/bcrypt auth, file uploads (multer), and transactional email (nodemailer).

---

## III. CeylonX Corporation — Intern SE (06/2024 – 12/2024)

Full-stack across client projects. Stack: **React.js**, **Node.js/Express**, **MongoDB**, **MySQL**, **Firebase**, **PayHere**, GitHub.

### 6. Restaurant POS (Iluk Restaurant & Bar, Savour Street)

**Role:** Contributor (joined late); contributed features and maintenance on an existing system.

**What it does:**
Point-of-sale system for restaurants — order entry, menu management, user management, admin dashboard — in production at Iluk Restaurant & Bar and Savour Street.

**Stack:**
- Backend: Node.js + Express.
- Frontend: React + Vite + Tailwind.
- Admin: React + Bootstrap + Redux + React Router.

**Recruiter-facing bullets (suggested):**
- Contributed to a production restaurant POS system (React + Node.js + MongoDB) running at Iluk Restaurant & Bar and Savour Street — worked across the POS frontend, admin dashboard, and backend APIs.
- Implemented and extended features across order entry, menu management, and auth; maintained and hardened existing modules.

---

### 7. Rainbow Swimming Club — Online Payments (PayHere)

**Role:** Core contributor.

**Stack:**
- Backend: Node.js + Express + **MySQL** (`mysql2`), JWT, nodemailer, md5/crypto for signature verification.
- Frontend: React 18 + MUI + `@mui/x-date-pickers` + Bootstrap + react-to-print + moment.

**What it does:**
Members (swimming students) pay membership/class fees online via **PayHere** (the major Sri Lankan payment gateway).

**Payment flow:**
- `calculateHash` — builds PayHere-compatible MD5 hash from `merchantID + orderID + amount + currency + md5(merchantSecret)` before redirecting to PayHere checkout.
- `notify` — server-to-server webhook from PayHere; recomputes the local MD5 signature over `merchant_id + order_id + payhere_amount + payhere_currency + status_code + md5(merchantSecret)`, rejects mismatches, asserts `status_code === "2"` (success), then persists the transaction (`payment_id`, amount, method, status, card metadata) and triggers an admin email.
- `checkPaymentSuccess`, `getPaymentDetails` — idempotent status-check endpoints used by the client after return from PayHere.
- Printable receipts via react-to-print.

**Recruiter-facing bullets (suggested):**
- Built Rainbow Swimming Club's online-payment application end-to-end — React 18 + MUI client, Express + MySQL backend.
- Integrated **PayHere** with a full MD5-signed redirect + notify webhook flow: signature verification, status-code checks, idempotent success lookups, transactional admin notifications, and printable receipts.

---

## Cross-cutting skills evidenced

- **Backend frameworks:** NestJS 11 (DDD layout, Swagger, throttler, event-emitter, microservices, websockets), Express.
- **Real-time:** Socket.IO (`@nestjs/websockets`, `@nestjs/platform-socket.io`), RabbitMQ via `amqplib` + `amqp-connection-manager`.
- **Databases:** PostgreSQL + TypeORM, MongoDB + Mongoose, MySQL (`mysql2`).
- **Frontend:** React 18, Vite, Tailwind + DaisyUI + MUI, Framer Motion, Three.js, TinyMCE, HLS players.
- **Game dev:** Cocos Creator 3.8 + TypeScript.
- **Payments / integrations:** Stripe (subscriptions), PayHere (MD5-signed redirect + notify), Firebase (auth/FCM), Vimeo (HLS origin), Alibaba OSS.
- **DevOps:** Docker / docker-compose, Kubernetes, Nginx, AWS, GitHub Actions CI/CD.

---

## Notes for CV bullet selection

- Any number-based claim (130M tickets, concurrent players, subscriber counts) comes only from what the user stated; no invented metrics.
- Game Platform and Restaurant POS bullets are phrased as "contributed to" / "extended" — user joined late on both.
- All projects are company projects; no personal ownership is claimed.
