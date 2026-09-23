# SparkSage

**AI study companion for your own notes.** Upload slides, books or scans — then chat with a tutor, generate quizzes and flashcards, and track what you're actually weak on.

**Live app:** [sparksage.lovable.app](https://sparksage.lovable.app)

## Features

- **Document library** — upload PDF, DOCX, PPTX, text/markdown/CSV/JSON/RTF, and images (OCR). Text is extracted in the browser; only the extracted text is stored.
- **AI tutor chat** — general chat plus per-document threads grounded in your uploaded material.
- **Summaries, quizzes & flashcards** — MCQ quizzes with explanations and per-concept accuracy; flashcard decks with known/review-again mastery tracking.
- **Document Studio** — generate mind maps, study reports, slide decks, audio and video overviews, infographics and data tables from a document (results are cached).
- **Study planner** — goals, deadlines and sessions on a calendar.
- **Daily review** — short mixed quizzes that focus on concepts you've been getting wrong.
- **Exam prep** — practice questions and prompts built from your weak areas.
- **Progress** — streaks, recent quiz scores and concept-level trends.
- **Owner tools** — announcements, feedback inbox, member management and site settings (owner role only).

## Tech stack

| Layer | |
| --- | --- |
| Frontend | React 19, TypeScript, TanStack Router / TanStack Start, TanStack Query |
| Styling | Tailwind CSS 4, shadcn/ui (Radix UI), Framer Motion, Recharts |
| Build | Vite 8, ESLint, Prettier |
| Backend | Supabase (auth, Postgres, RLS) via TanStack server functions |
| Validation | Zod |
| Extraction | pdfjs-dist, mammoth, jszip (client-side) |

## Local development

Requires Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/tahsan2544/sparksage.git
cd sparksage
npm install
cp .env.example .env   # fill in your Supabase values
npm run dev
```

### Environment variables

Copy `.env.example` to `.env` and set:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_PROJECT_ID` | Supabase project id (server) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (server) |
| `SUPABASE_URL` | Supabase URL (server) |
| `VITE_SUPABASE_PROJECT_ID` | Same, exposed to the client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same, exposed to the client |
| `VITE_SUPABASE_URL` | Same, exposed to the client |

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |

## Roadmap

See [roadmap.md](roadmap.md) for completed and planned work.

## Built with Lovable

This project is connected to [Lovable](https://lovable.dev).

- **Continue in the editor:** [Open in Lovable](https://lovable.dev/projects/be0ab914-3f89-4839-92c7-3c2f09731e68)
- **Stay in sync:** changes made in Lovable are committed to this repository; pushing to the connected branch syncs back to the editor.
- **Full ownership:** the code is yours.

## License

MIT — see [LICENSE](LICENSE).
