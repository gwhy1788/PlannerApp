# PlannerApp — Claude Code Instructions

## Project Overview
iOS activity planner and tracker built with Expo (React Native) + TypeScript.
User is new to iOS/React Native development.

## Stack
- **Expo SDK 57** (managed workflow) + TypeScript
- **expo-router v3** — file-based navigation (`app/` directory)
- **expo-sqlite** — local SQLite database via `SQLiteProvider` / `useSQLiteContext`
- **expo-notifications** — scheduled reminders
- **react-native-safe-area-context** — always import `SafeAreaView` from here, not `react-native`
- **@expo/vector-icons** — Ionicons for all icons

## Git & GitHub Workflow

**Every meaningful change must be committed and pushed to GitHub.** This ensures we never lose work and can always revert.

### Rules
1. After completing any feature, fix, or significant change — commit and push immediately.
2. Use clear, conventional commit messages:
   - `feat: add streak calculation to Today screen`
   - `fix: correct SafeAreaView import across all screens`
   - `refactor: extract ActivityForm into shared component`
   - `chore: install @expo/vector-icons`
3. Never leave unpushed commits at the end of a session.
4. Never force-push to `main`.

### Commands
```bash
git add <specific-files>          # stage specific files (avoid git add -A)
git commit -m "type: description"
git push origin main
```

### Repository
- Remote: https://github.com/gwhy1788/PlannerApp
- Branch: `main`

## Development Commands
```bash
npm start              # start Expo dev server (use instead of npx expo start — npx blocked by PowerShell policy)
npm start -- --clear   # start with cleared Metro cache (use when hot-reload isn't picking up changes)
```

## Key Conventions
- Import `SafeAreaView` from `react-native-safe-area-context`, not `react-native`
- Use `npm install --legacy-peer-deps` when adding packages (avoids peer dep conflicts in SDK 57)
- Database functions live in `src/db/database.ts` — add new queries there
- All screens use `useFocusEffect` to reload data when navigated back to
- Activity soft-delete: set `is_active = 0`, never hard delete

## File Structure
```
app/
  _layout.tsx              # Root layout — SQLiteProvider wraps everything
  (tabs)/
    _layout.tsx            # Tab bar (Today, Activities, Stats)
    index.tsx              # Today screen
    activities.tsx         # All activities by category
    stats.tsx              # Streaks and completion stats
  activity/
    new.tsx                # Add new activity (modal)
    [id].tsx               # Activity detail + delete
src/
  db/database.ts           # All SQLite queries
  types/index.ts           # TypeScript types (Activity, Category, ActivityLog)
  utils/dates.ts           # Date helpers
  utils/streaks.ts         # isDueToday, calculateStreak
  constants/theme.ts       # Colors, CATEGORY_COLORS, ACTIVITY_ICONS
```
