# File Sorter

Local Next.js utility for macOS and Windows. Pick a folder on your machine; the app walks that folder and all subfolders, then moves each file into a capitalized extension folder created **inside** the folder you selected (for example `PDF/`, `JPG/`, `OTHER/`).

Name clashes use `_0`, `_1`, and so on (`report.pdf`, `report_0.pdf`, …). Files that are already in the correct extension folder at the root of your selection are left alone. Empty subfolders are not removed.

## Requirements

- Node.js 20+
- macOS or Windows (native folder picker). On Linux, paste a folder path manually.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), choose or paste a folder, click **Preview moves**, then **Sort files**.

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Development server       |
| `npm run build`| Production build         |
| `npm run start`| Start production server  |
| `npm test`     | Run sorter unit tests    |
| `npm run lint` | ESLint                   |

## API

- `POST /api/pick-folder` — open the native folder dialog (macOS / Windows).
- `POST /api/sort` — body `{ "directory": "/path", "apply": false | true }`. With `apply: false`, returns a move plan; with `apply: true`, performs the moves.