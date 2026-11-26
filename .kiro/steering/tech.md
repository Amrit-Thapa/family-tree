# Tech Stack

| Layer          | Technology                                      |
|----------------|-------------------------------------------------|
| Framework      | Next.js 16 (App Router, Server Components, Server Actions) |
| Language       | TypeScript 5 (strict mode)                      |
| Database       | MongoDB 7+ with Mongoose 9 ODM                  |
| Authentication | Firebase Auth (Google OAuth) + server-side sessions (HttpOnly cookies) |
| Validation     | Zod 4                                           |
| Styling        | Tailwind CSS 4                                  |
| Testing        | Vitest 4                                        |
| Sanitization   | isomorphic-dompurify                            |
| Linting        | ESLint 9 with eslint-config-next                |

## Commands

| Command                              | Purpose                    |
|--------------------------------------|----------------------------|
| `npm run dev`                        | Start dev server           |
| `npm run build`                      | Production build           |
| `npm start`                          | Start production server    |
| `npm run lint`                       | Run ESLint                 |
| `npm test`                           | Run tests (single run via `vitest --run`) |
| `npm run test:watch`                 | Run tests in watch mode    |
| `npx vitest run path/to/file.test.ts`| Run a specific test file   |

## Important Notes

- This project uses **Vitest**, NOT Jest. Never use `jest` or `npx jest`.
- Path alias: `@/*` maps to `./src/*`.
- TypeScript strict mode is enabled.
- Next.js 16 may have breaking changes from earlier versions — consult `node_modules/next/dist/docs/` before using unfamiliar APIs.
