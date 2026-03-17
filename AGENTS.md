# Repository Guidelines

## Project Structure & Module Organization
This is a Vite + React + TypeScript frontend app. The entry points are `index.tsx` and `App.tsx`. Reusable UI lives in `components/`, API integration logic lives in `services/`, and shared browser utilities live in `utils/`. Keep cross-cutting constants in `constants.ts` and shared types in `types.ts`. Build tooling is defined in `vite.config.ts` and `tsconfig.json`.

## Build, Test, and Development Commands
- `npm install`: install project dependencies.
- `npm run dev`: start the Vite dev server on `http://localhost:5173`.
- `npm run build`: create a production build.
- `npm run preview`: serve the built output locally for final verification.

Run `npm run build` before opening a pull request. This repository does not currently define dedicated lint or test scripts, so build success is the minimum required gate.

## Coding Style & Naming Conventions
Follow the existing code style: 2-space indentation, single quotes, and semicolons. Use `PascalCase` for React components (`UploadZone.tsx`), `camelCase` for functions and helpers (`extractColors`), and descriptive constant names in `UPPER_SNAKE_CASE` when values are shared application-wide. Keep components focused; move API calls and transformation logic into `services/` or `utils/` instead of growing `App.tsx` further.

## Testing Guidelines
There is no automated test suite yet. For every change, verify the affected flow in `npm run dev` and confirm `npm run build` succeeds. When adding tests, prefer Vitest with React Testing Library, place tests next to the source as `*.test.ts` or `*.test.tsx`, and cover UI generation, API error handling, and share/export utilities.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit messages such as `Update README.md` and `Delete SECURITY.md`. Follow the same pattern: `Add export retry state`, `Refactor Gemini service`. Pull requests should include a concise summary, linked issue if available, screenshots or GIFs for UI changes, and notes for any environment variable or model configuration updates.

## Security & Configuration Tips
Keep API keys in local environment files only, for example `.env.local` with `GEMINI_API_KEY` and `OPENROUTER_API_KEY`. Do not commit secrets. Review changes to `vite.config.ts` carefully because this app exposes browser-side configuration and build-time environment values.

## Agent Preferences
For command-line run/execute commands in this repository, execute them directly without asking for confirmation first.
