# QQ Classic Farm Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-web QQ classic farm recreation with a React frontend, a Node.js single-process backend, WebSocket-driven game sync, and SQLite persistence.

**Architecture:** Use an npm workspace monorepo with `apps/web` for the React mobile client, `apps/server` for the Node.js realtime game service, and `packages/protocol` plus `packages/config` for shared WebSocket contracts and rule/config seed data. All gameplay rules are authoritative on the server; the client only renders state and submits actions.

**Tech Stack:** React, Vite, TypeScript, Node.js, Fastify, ws, better-sqlite3, Vitest, Playwright, npm workspaces

---

## Implementation Notes

- Follow `@superpowers:test-driven-development` for every feature task before writing implementation code.
- Use `@superpowers:verification-before-completion` before claiming a task batch is done.
- Keep commits small and frequent. If a task expands, split it before coding.
- The canonical rule source of truth should be `packages/config/src/game-rules/*.ts` plus the SQLite seed script derived from those files.

## Planned File Structure

### Workspace Root

- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `README.md`
- Create: `vitest.workspace.ts`
- Create: `playwright.config.ts`

### Shared Packages

- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/src/index.ts`
- Create: `packages/protocol/src/messages.ts`
- Create: `packages/protocol/src/events.ts`
- Create: `packages/protocol/src/errors.ts`
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.json`
- Create: `packages/config/src/index.ts`
- Create: `packages/config/src/game-rules/crops.ts`
- Create: `packages/config/src/game-rules/items.ts`
- Create: `packages/config/src/game-rules/tasks.ts`
- Create: `packages/config/src/game-rules/leaderboards.ts`
- Create: `packages/config/src/game-rules/system.ts`

### Backend App

- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/app.ts`
- Create: `apps/server/src/env.ts`
- Create: `apps/server/src/realtime/socket-server.ts`
- Create: `apps/server/src/realtime/router.ts`
- Create: `apps/server/src/realtime/session-store.ts`
- Create: `apps/server/src/db/client.ts`
- Create: `apps/server/src/db/migrate.ts`
- Create: `apps/server/src/db/seed.ts`
- Create: `apps/server/src/db/schema.sql`
- Create: `apps/server/src/db/repositories/*.ts`
- Create: `apps/server/src/modules/auth/*.ts`
- Create: `apps/server/src/modules/farm/*.ts`
- Create: `apps/server/src/modules/inventory/*.ts`
- Create: `apps/server/src/modules/shop/*.ts`
- Create: `apps/server/src/modules/social/*.ts`
- Create: `apps/server/src/modules/tasks/*.ts`
- Create: `apps/server/src/modules/ranking/*.ts`
- Create: `apps/server/src/modules/notifications/*.ts`
- Create: `apps/server/src/lib/time.ts`
- Create: `apps/server/src/lib/transactions.ts`
- Create: `apps/server/src/lib/test-app.ts`

### Frontend App

- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/app/store/*.ts`
- Create: `apps/web/src/app/socket/client.ts`
- Create: `apps/web/src/app/socket/handlers.ts`
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/global.css`
- Create: `apps/web/src/features/auth/*.tsx`
- Create: `apps/web/src/features/farm/*.tsx`
- Create: `apps/web/src/features/shop/*.tsx`
- Create: `apps/web/src/features/inventory/*.tsx`
- Create: `apps/web/src/features/social/*.tsx`
- Create: `apps/web/src/features/tasks/*.tsx`
- Create: `apps/web/src/features/ranking/*.tsx`
- Create: `apps/web/src/features/notifications/*.tsx`
- Create: `apps/web/src/components/ui/*.tsx`
- Create: `apps/web/src/components/layout/*.tsx`
- Create: `apps/web/src/assets/generated/README.md`

### Tests

- Create: `apps/server/tests/auth/*.test.ts`
- Create: `apps/server/tests/farm/*.test.ts`
- Create: `apps/server/tests/social/*.test.ts`
- Create: `apps/server/tests/tasks/*.test.ts`
- Create: `apps/server/tests/ranking/*.test.ts`
- Create: `apps/server/tests/realtime/*.test.ts`
- Create: `apps/web/src/features/farm/*.test.tsx`
- Create: `apps/web/src/features/social/*.test.tsx`
- Create: `apps/web/src/features/tasks/*.test.tsx`
- Create: `tests/e2e/auth.spec.ts`
- Create: `tests/e2e/farm-loop.spec.ts`
- Create: `tests/e2e/social.spec.ts`

## Task 1: Bootstrap Workspace And Git

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `README.md`

- [ ] **Step 1: Initialize git repository**

Run: `git init`
Expected: repository initialized at project root

- [ ] **Step 2: Create root workspace manifest and scripts**

Add `package.json` with workspaces for `apps/*` and `packages/*`, plus scripts for `dev:web`, `dev:server`, `test`, `test:e2e`, `build`.

- [ ] **Step 3: Add shared TypeScript and editor config**

Create `tsconfig.base.json`, `.editorconfig`, and `.gitignore` with Node, Vite, SQLite, Playwright, and dist ignores.

- [ ] **Step 4: Install root dependencies**

Run: `npm install -D typescript tsx vitest @vitest/coverage-v8 playwright concurrently`
Expected: workspace lockfile created successfully

- [ ] **Step 5: Commit bootstrap**

Run: `git add . && git commit -m "chore: bootstrap workspace"`
Expected: first commit created

## Task 2: Create Shared Protocol And Rule Packages

**Files:**
- Create: `packages/protocol/src/messages.ts`
- Create: `packages/protocol/src/events.ts`
- Create: `packages/protocol/src/errors.ts`
- Create: `packages/config/src/game-rules/crops.ts`
- Create: `packages/config/src/game-rules/items.ts`
- Create: `packages/config/src/game-rules/tasks.ts`
- Create: `packages/config/src/game-rules/leaderboards.ts`
- Create: `packages/config/src/game-rules/system.ts`
- Test: `apps/server/tests/realtime/protocol-contract.test.ts`

- [ ] **Step 1: Write failing protocol contract test**

Create a test that imports shared request and event definitions and asserts required message names exist: `farm:getMine`, `farm:getUser`, `farm:operate`, `shop:list`, `inventory:list`, `friends:list`, `tasks:list`, `ranking:list`.

- [ ] **Step 2: Run protocol test to verify failure**

Run: `npm test -- apps/server/tests/realtime/protocol-contract.test.ts`
Expected: FAIL because shared protocol files do not exist

- [ ] **Step 3: Implement shared protocol package**

Create the package and export typed request, response, event, and error shapes used by both apps.

- [ ] **Step 4: Add rule config package with canonical seed data files**

Create crop, item, task, leaderboard, and system parameter config files. Include starter values for growth duration, wither duration, yield, steal caps, help caps, and protection duration.

- [ ] **Step 5: Run tests to verify protocol and config compile**

Run: `npm test -- apps/server/tests/realtime/protocol-contract.test.ts`
Expected: PASS

- [ ] **Step 6: Commit shared packages**

Run: `git add packages apps/server/tests/realtime/protocol-contract.test.ts && git commit -m "feat: add shared protocol and rule config"`

## Task 3: Build Server Skeleton, Database Schema, And Migration Flow

**Files:**
- Create: `apps/server/src/app.ts`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/env.ts`
- Create: `apps/server/src/db/client.ts`
- Create: `apps/server/src/db/schema.sql`
- Create: `apps/server/src/db/migrate.ts`
- Create: `apps/server/src/db/seed.ts`
- Test: `apps/server/tests/db/migrate.test.ts`

- [ ] **Step 1: Write failing database migration test**

Create a test that boots an empty SQLite file, runs migration + seed, and asserts required tables exist for users, farms, farm_slots, crop_instances, inventory_entries, friendships, friendship_requests, visit_logs, interaction_logs, message_logs, tasks, task_progress, notifications, leaderboard_entries.

- [ ] **Step 2: Run migration test to verify failure**

Run: `npm test -- apps/server/tests/db/migrate.test.ts`
Expected: FAIL because migration tooling is missing

- [ ] **Step 3: Implement server package and SQLite client**

Add Fastify server bootstrap, env loading, better-sqlite3 client factory, schema SQL, migration runner, and seed script loading `packages/config` as the source of truth. Include append-only persistence for friend visits, steal/help interactions, and message history so notification and history views do not depend on inferred state.

- [ ] **Step 4: Run migration test to verify success**

Run: `npm test -- apps/server/tests/db/migrate.test.ts`
Expected: PASS with all tables present

- [ ] **Step 5: Commit server bootstrap and schema**

Run: `git add apps/server && git commit -m "feat: add server bootstrap and database schema"`

## Task 4: Implement Auth And WebSocket Session Foundation

**Files:**
- Create: `apps/server/src/modules/auth/auth-service.ts`
- Create: `apps/server/src/modules/auth/auth-controller.ts`
- Create: `apps/server/src/realtime/socket-server.ts`
- Create: `apps/server/src/realtime/session-store.ts`
- Create: `apps/server/src/lib/test-app.ts`
- Test: `apps/server/tests/auth/register-login.test.ts`
- Test: `apps/server/tests/realtime/socket-auth.test.ts`

- [ ] **Step 1: Write failing auth HTTP test**

Create a test for register + login that asserts user creation, hashed password storage, and token issuance.

- [ ] **Step 2: Write failing WebSocket auth test**

Create a test that connects without a token and expects rejection, then connects with a valid token and expects an authenticated session.

- [ ] **Step 3: Run auth tests to verify failure**

Run: `npm test -- apps/server/tests/auth/register-login.test.ts apps/server/tests/realtime/socket-auth.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement auth module and socket session handshake**

Add register/login HTTP endpoints, password hashing, token signing, and WebSocket connection validation with request ID propagation.

- [ ] **Step 5: Run auth tests to verify success**

Run: `npm test -- apps/server/tests/auth/register-login.test.ts apps/server/tests/realtime/socket-auth.test.ts`
Expected: PASS

- [ ] **Step 6: Commit auth foundation**

Run: `git add apps/server && git commit -m "feat: add auth and websocket session foundation"`

## Task 5: Implement Farm Rule Engine And Slot Calculation

**Files:**
- Create: `apps/server/src/modules/farm/farm-rules.ts`
- Create: `apps/server/src/modules/farm/farm-calculator.ts`
- Create: `apps/server/src/modules/farm/farm-repository.ts`
- Create: `apps/server/src/lib/time.ts`
- Test: `apps/server/tests/farm/farm-calculator.test.ts`
- Test: `apps/server/tests/farm/farm-rules.test.ts`

- [ ] **Step 1: Write failing farm calculator tests**

Cover crop growth stage transitions, wither transition, drought/grass/worm state derivation, health coefficient reduction, and yield rounding.

- [ ] **Step 2: Run calculator tests to verify failure**

Run: `npm test -- apps/server/tests/farm/farm-calculator.test.ts apps/server/tests/farm/farm-rules.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement farm rule engine**

Add pure calculation helpers that accept slot state, crop config, current time, and system rule config, then return computed slot and crop state.

- [ ] **Step 4: Run calculator tests to verify success**

Run: `npm test -- apps/server/tests/farm/farm-calculator.test.ts apps/server/tests/farm/farm-rules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit farm rule engine**

Run: `git add apps/server packages/config && git commit -m "feat: add farm rule engine"`

## Task 6: Implement Farm Query APIs And Player Home Snapshot

**Files:**
- Create: `apps/server/src/modules/farm/farm-query-service.ts`
- Create: `apps/server/src/modules/farm/farm-snapshot-mapper.ts`
- Modify: `apps/server/src/realtime/router.ts`
- Test: `apps/server/tests/farm/get-mine.test.ts`
- Test: `apps/server/tests/farm/get-user-farm.test.ts`

- [ ] **Step 1: Write failing snapshot query tests**

Cover `farm:getMine` and `farm:getUser`, including calculated slot states, top-bar stats, dog state, and permission flags for self vs friend farm.

- [ ] **Step 2: Run snapshot tests to verify failure**

Run: `npm test -- apps/server/tests/farm/get-mine.test.ts apps/server/tests/farm/get-user-farm.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement farm snapshot services and websocket routes**

Return a full farm view model for self and friend farms, including normalized slot payloads and available actions.

- [ ] **Step 4: Run snapshot tests to verify success**

Run: `npm test -- apps/server/tests/farm/get-mine.test.ts apps/server/tests/farm/get-user-farm.test.ts`
Expected: PASS

- [ ] **Step 5: Commit farm query flow**

Run: `git add apps/server && git commit -m "feat: add farm snapshot queries"`

## Task 7: Implement Farm Operations And Realtime Slot Updates

**Files:**
- Create: `apps/server/src/modules/farm/farm-operation-service.ts`
- Create: `apps/server/src/modules/farm/farm-events.ts`
- Modify: `apps/server/src/realtime/router.ts`
- Modify: `apps/server/src/lib/transactions.ts`
- Test: `apps/server/tests/farm/plant-water-harvest.test.ts`
- Test: `apps/server/tests/farm/steal-and-help.test.ts`
- Test: `apps/server/tests/realtime/farm-events.test.ts`

- [ ] **Step 1: Write failing operation tests**

Cover plant, water, remove grass, remove worms, fertilize, harvest, clear dead crop, steal, help, and throw worms.

- [ ] **Step 2: Write failing realtime event test**

Verify that a successful operation emits `farm:slotUpdated` plus affected inventory/task/notification events.

- [ ] **Step 3: Run operation tests to verify failure**

Run: `npm test -- apps/server/tests/farm/plant-water-harvest.test.ts apps/server/tests/farm/steal-and-help.test.ts apps/server/tests/realtime/farm-events.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement transactional farm operations**

Use SQLite transactions for all state-changing operations and enforce ownership, maturity, steal cap, friend-only, and protection checks.

- [ ] **Step 5: Run operation tests to verify success**

Run: `npm test -- apps/server/tests/farm/plant-water-harvest.test.ts apps/server/tests/farm/steal-and-help.test.ts apps/server/tests/realtime/farm-events.test.ts`
Expected: PASS

- [ ] **Step 6: Commit farm operations**

Run: `git add apps/server && git commit -m "feat: add farm operations and realtime events"`

## Task 8: Implement Inventory And Shop Modules

**Files:**
- Create: `apps/server/src/modules/inventory/inventory-service.ts`
- Create: `apps/server/src/modules/shop/shop-service.ts`
- Modify: `apps/server/src/realtime/router.ts`
- Test: `apps/server/tests/shop/list-and-purchase.test.ts`
- Test: `apps/server/tests/inventory/list-and-sell.test.ts`

- [ ] **Step 1: Write failing shop and inventory tests**

Cover `shop:list`, buying seeds/items, `inventory:list`, and selling harvested goods.

- [ ] **Step 2: Run shop tests to verify failure**

Run: `npm test -- apps/server/tests/shop/list-and-purchase.test.ts apps/server/tests/inventory/list-and-sell.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement inventory and shop services**

Use config-driven item lists and transactional purchase/sell flows that update coins, inventory, and notifications.

- [ ] **Step 4: Run shop tests to verify success**

Run: `npm test -- apps/server/tests/shop/list-and-purchase.test.ts apps/server/tests/inventory/list-and-sell.test.ts`
Expected: PASS

- [ ] **Step 5: Commit inventory and shop**

Run: `git add apps/server packages/config && git commit -m "feat: add inventory and shop modules"`

## Task 9: Implement Social Graph, Friend Visits, And Notifications

**Files:**
- Create: `apps/server/src/modules/social/social-service.ts`
- Create: `apps/server/src/modules/social/friendship-repository.ts`
- Create: `apps/server/src/modules/social/activity-log-repository.ts`
- Create: `apps/server/src/modules/notifications/notification-service.ts`
- Modify: `apps/server/src/realtime/router.ts`
- Test: `apps/server/tests/social/friendship-flow.test.ts`
- Test: `apps/server/tests/social/visit-permissions.test.ts`
- Test: `apps/server/tests/notifications/interaction-feed.test.ts`

- [ ] **Step 1: Write failing social tests**

Cover sending requests, accepting requests, listing friends, deleting friends, visiting a friend farm, and generating interaction notifications.

- [ ] **Step 2: Run social tests to verify failure**

Run: `npm test -- apps/server/tests/social/friendship-flow.test.ts apps/server/tests/social/visit-permissions.test.ts apps/server/tests/notifications/interaction-feed.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement social graph and notification services**

Wire friendship state, friend visibility, visit authorization, interaction feed creation, and `social:interactionReceived` plus `notice:new` events.

- [ ] **Step 4: Run social tests to verify success**

Run: `npm test -- apps/server/tests/social/friendship-flow.test.ts apps/server/tests/social/visit-permissions.test.ts apps/server/tests/notifications/interaction-feed.test.ts`
Expected: PASS

- [ ] **Step 5: Commit social systems**

Run: `git add apps/server && git commit -m "feat: add social graph and notifications"`

## Task 10: Implement Background Reconciliation, Idle Progress, And Backfill

**Files:**
- Create: `apps/server/src/modules/farm/farm-reconciler.ts`
- Create: `apps/server/src/modules/notifications/notification-backfill.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/modules/tasks/task-service.ts`
- Test: `apps/server/tests/farm/reconciler.test.ts`
- Test: `apps/server/tests/notifications/backfill.test.ts`

- [ ] **Step 1: Write failing reconciliation tests**

Cover idle-time crop maturation, pending task progress sync, and reminder generation while no player actions are occurring.

- [ ] **Step 2: Run reconciliation tests to verify failure**

Run: `npm test -- apps/server/tests/farm/reconciler.test.ts apps/server/tests/notifications/backfill.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement low-frequency reconciliation loop**

Add a server scheduler that periodically scans for matured crops, task state backfill, and pending notifications without requiring the player to revisit or operate.

- [ ] **Step 4: Run reconciliation tests to verify success**

Run: `npm test -- apps/server/tests/farm/reconciler.test.ts apps/server/tests/notifications/backfill.test.ts`
Expected: PASS

- [ ] **Step 5: Commit reconciliation loop**

Run: `git add apps/server && git commit -m "feat: add background reconciliation loop"`

## Task 11: Implement Tasks, Achievements, And Leaderboards

**Files:**
- Create: `apps/server/src/modules/tasks/task-service.ts`
- Create: `apps/server/src/modules/tasks/task-progressor.ts`
- Create: `apps/server/src/modules/ranking/ranking-service.ts`
- Test: `apps/server/tests/tasks/task-progress.test.ts`
- Test: `apps/server/tests/tasks/claim-rewards.test.ts`
- Test: `apps/server/tests/ranking/leaderboard-refresh.test.ts`

- [ ] **Step 1: Write failing task and leaderboard tests**

Cover onboarding tasks, daily reset, achievement accumulation, reward claiming idempotency, and leaderboard refresh snapshots.

- [ ] **Step 2: Run task tests to verify failure**

Run: `npm test -- apps/server/tests/tasks/task-progress.test.ts apps/server/tests/tasks/claim-rewards.test.ts apps/server/tests/ranking/leaderboard-refresh.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement tasks and ranking services**

Advance progress from gameplay events, support reward claiming, and build snapshot-based leaderboard queries from configured definitions.

- [ ] **Step 4: Run task tests to verify success**

Run: `npm test -- apps/server/tests/tasks/task-progress.test.ts apps/server/tests/tasks/claim-rewards.test.ts apps/server/tests/ranking/leaderboard-refresh.test.ts`
Expected: PASS

- [ ] **Step 5: Commit tasks and leaderboards**

Run: `git add apps/server packages/config && git commit -m "feat: add tasks achievements and leaderboards"`

## Task 12: Build Frontend Shell, Theme, And Socket Client

**Files:**
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/app/store/session-store.ts`
- Create: `apps/web/src/app/store/game-store.ts`
- Create: `apps/web/src/app/socket/client.ts`
- Create: `apps/web/src/app/socket/handlers.ts`
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/global.css`
- Test: `apps/web/src/app/App.test.tsx`

- [ ] **Step 1: Write failing app shell test**

Assert the mobile layout renders top stats, bottom nav shell, and connects the socket client after authentication.

- [ ] **Step 2: Run frontend shell test to verify failure**

Run: `npm test -- apps/web/src/app/App.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement React app shell and classic visual tokens**

Add Vite app bootstrap, route structure, CSS tokens for the classic colorful style, and socket client wiring.

- [ ] **Step 4: Run frontend shell test to verify success**

Run: `npm test -- apps/web/src/app/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit frontend shell**

Run: `git add apps/web && git commit -m "feat: add mobile app shell and socket client"`

## Task 13: Build Auth Screens And Session Flow

**Files:**
- Create: `apps/web/src/features/auth/LoginScreen.tsx`
- Create: `apps/web/src/features/auth/RegisterScreen.tsx`
- Create: `apps/web/src/features/auth/AuthGate.tsx`
- Test: `apps/web/src/features/auth/auth-flow.test.tsx`

- [ ] **Step 1: Write failing auth UI test**

Cover register, login, token persistence, and redirect into the farm home screen.

- [ ] **Step 2: Run auth UI test to verify failure**

Run: `npm test -- apps/web/src/features/auth/auth-flow.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement auth screens and session store flow**

Connect HTTP auth endpoints, persist session token, and open the socket only after login succeeds.

- [ ] **Step 4: Run auth UI test to verify success**

Run: `npm test -- apps/web/src/features/auth/auth-flow.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit auth UI**

Run: `git add apps/web && git commit -m "feat: add mobile auth flow"`

## Task 14: Build Farm Screen And Slot Interaction UX

**Files:**
- Create: `apps/web/src/features/farm/FarmScreen.tsx`
- Create: `apps/web/src/features/farm/FarmSlot.tsx`
- Create: `apps/web/src/features/farm/FarmActionSheet.tsx`
- Create: `apps/web/src/features/farm/FarmTopBar.tsx`
- Create: `apps/web/src/features/farm/FarmFriendStrip.tsx`
- Test: `apps/web/src/features/farm/farm-screen.test.tsx`

- [ ] **Step 1: Write failing farm UI test**

Cover rendering slot states, tapping a slot, showing context actions, and updating the screen when `farm:slotUpdated` is received.

- [ ] **Step 2: Run farm UI test to verify failure**

Run: `npm test -- apps/web/src/features/farm/farm-screen.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement farm home screen and mobile interactions**

Build the main scene, top bar, slot grid, action sheet, friend switcher, classic state icons, and floating reward feedback.

- [ ] **Step 4: Run farm UI test to verify success**

Run: `npm test -- apps/web/src/features/farm/farm-screen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit farm UI**

Run: `git add apps/web && git commit -m "feat: add farm home interactions"`

## Task 15: Build Shop, Inventory, Social, Tasks, Ranking, And Notifications UI

**Files:**
- Create: `apps/web/src/features/shop/ShopSheet.tsx`
- Create: `apps/web/src/features/inventory/InventorySheet.tsx`
- Create: `apps/web/src/features/social/FriendsDrawer.tsx`
- Create: `apps/web/src/features/tasks/TasksSheet.tsx`
- Create: `apps/web/src/features/ranking/RankingSheet.tsx`
- Create: `apps/web/src/features/notifications/NotificationsPanel.tsx`
- Test: `apps/web/src/features/social/social-ui.test.tsx`
- Test: `apps/web/src/features/tasks/tasks-ui.test.tsx`

- [ ] **Step 1: Write failing secondary-systems UI tests**

Cover opening the shop, inventory, friends drawer, task sheet, leaderboard sheet, and notification panel, including data refresh after websocket events.

- [ ] **Step 2: Run secondary UI tests to verify failure**

Run: `npm test -- apps/web/src/features/social/social-ui.test.tsx apps/web/src/features/tasks/tasks-ui.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement secondary mobile panels**

Build the panel components, wire shared store updates, and match the classic visual language in buttons, bubbles, and notification badges.

- [ ] **Step 4: Run secondary UI tests to verify success**

Run: `npm test -- apps/web/src/features/social/social-ui.test.tsx apps/web/src/features/tasks/tasks-ui.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit secondary UI systems**

Run: `git add apps/web && git commit -m "feat: add shop social tasks and ranking ui"`

## Task 16: End-To-End Flows, Verification, And Delivery Hardening

**Files:**
- Create: `tests/e2e/auth.spec.ts`
- Create: `tests/e2e/farm-loop.spec.ts`
- Create: `tests/e2e/social.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing Playwright flows**

Cover register/login, buy seed, plant, advance to mature crop using seeded test time helpers, harvest, add a friend, visit friend farm, help, steal, claim a task reward, and read a leaderboard.

- [ ] **Step 2: Run e2e suite to verify failure**

Run: `npm run test:e2e`
Expected: FAIL because frontend and backend wiring is incomplete

- [ ] **Step 3: Fill final implementation gaps exposed by e2e**

Fix missing data wiring, optimistic update issues, notification handling, and flaky timing assumptions until the full loop is stable.

- [ ] **Step 4: Run full verification suite**

Run: `npm test`
Expected: PASS

Run: `npm run test:e2e`
Expected: PASS

Run: `npm run build`
Expected: PASS for both workspace apps

- [ ] **Step 5: Update README with local setup and commands**

Document install, migrate, seed, run web, run server, and test commands.

- [ ] **Step 6: Commit verified MVP**

Run: `git add . && git commit -m "feat: deliver qq classic farm mobile mvp"`

## Suggested Execution Order

1. Tasks 1-4 to create the workspace, protocol, schema, and auth foundation.
2. Tasks 5-11 to finish the server-side authoritative game systems.
3. Tasks 12-15 to build the mobile client on top of stable contracts.
4. Task 16 to verify end-to-end behavior and close documentation gaps.


