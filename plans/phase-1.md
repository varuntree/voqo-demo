# Phase 1: Project Setup (Local)

## What & Why
Initialize Next.js app with full directory structure for VoqoLeadEngine. Foundation for all subsequent phases.

## Prerequisites
- Node.js installed locally
- Working directory: `/Users/varunprasad/code/prjs/voqo-demo`

## Execution Context
| Action Type | How to Execute |
|-------------|----------------|
| Local code | Write/Edit tools |
| Shell | Bash tool |
| Verification | npm commands, file checks |

---

## IMPLEMENTATION STEPS

### Step 1.1: Create Next.js Project
**Why**: Base framework with TypeScript + Tailwind

**Actions**:
- Run create-next-app in current directory (or subdirectory, then move)
- Use flags: `--typescript --tailwind --app --no-eslint`

**Commands**:
```bash
npx create-next-app@latest voqo-app --typescript --tailwind --app --no-eslint --yes
# Move contents to project root
```

**Verify**:
- [x] package.json exists with next, react, typescript deps
- [x] app/ directory exists
- [x] Tailwind via postcss (v4 style)

**Status**: [✓] Complete

---

### Step 1.2: Create Directory Structure
**Why**: Data storage + Claude skills + generated pages

**Actions**:
- Create `.claude/skills/agency-researcher/`
- Create `.claude/skills/demo-page-builder/`
- Create `.claude/skills/postcall-page-builder/`
- Create `data/agencies/`
- Create `data/calls/`
- Create `data/context/`
- Create `public/demo/`
- Create `public/call/`
- Create `lib/`

**Verify**:
- [x] All directories exist
- [x] `ls -la .claude/skills/` shows 3 dirs

**Status**: [✓] Complete

---

### Step 1.3: Install Dependencies
**Why**: Twilio SDK needed for SMS

**Actions**:
- Install twilio package

**Commands**:
```bash
npm install twilio
```

**Verify**:
- [x] package.json includes "twilio"
- [x] node_modules/twilio exists

**Status**: [✓] Complete

---

### Step 1.4: Create Placeholder .env.local
**Why**: Config template for credentials (real values in Phase 2)

**Actions**:
- Create `.env.local` with placeholder values

**Verify**:
- [x] .env.local exists
- [x] Contains all 7 variables (plus comments = 12 lines)

**Status**: [✓] Complete

---

### Step 1.5: Verify Dev Server Runs
**Why**: Confirm project setup complete

**Actions**:
- Run `npm run dev`
- Check localhost:3000 loads

**Verify**:
- [x] No errors in terminal
- [x] http://localhost:3000 returns 200 (used port 3002 due to port conflict)
- [x] `npm run build` succeeds

**Status**: [✓] Complete

---

### Step 1.6: Phase Checkpoint
**Why**: Confirm Phase 1 complete before Phase 2

**Verify**:
- [x] Project structure created
- [x] Dependencies installed (next, react, twilio)
- [x] Dev server runs without errors
- [x] .env.local exists with placeholders

**Status**: [✓] Complete

---

## VALIDATION

1. `npm run dev` → Server starts on port 3000 ✓
2. `ls .claude/skills/` → Shows 3 skill directories ✓
3. `ls data/` → Shows agencies/, calls/, context/ ✓
4. `cat .env.local` → Shows all 7 env vars ✓
5. `npm run build` → Completes without errors ✓

## Notes
- Next.js 16 with Tailwind v4 uses @tailwindcss/postcss instead of tailwind.config.ts
- Port 3000 may be in use; Next.js auto-selects next available port
