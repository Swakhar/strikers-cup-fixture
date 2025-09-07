# Strikers Cup 2025 — Draw Wheel & Fixture Generator

This web app helps organize the Strikers Cup 2025 football tournament by providing a visual draw wheel for team assignment and generating a printable fixture schedule.

## Features

- **Draw Wheel:** Spin to randomly assign 9 teams into 3 groups (A, B, C).
- **Editable Team Names:** Customize team names before the draw.
- **Group Display:** See live group assignments as teams are drawn.
- **Fixture Generator:** Automatically builds the match schedule for group and knockout stages.
- **PDF Export:** Download the full tournament fixture as a PDF.
- **State Persistence:** All changes are saved automatically in your browser.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- [npm](https://www.npmjs.com/)

### Installation

```sh
npm install
```

### Development

```sh
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```sh
npm run build
```

## Usage

1. Enter or edit team names in the right panel.
2. Click **Apply Names to Wheel**.
3. Spin the wheel to assign teams to groups.
4. Once all teams are assigned, click **Download Fixture PDF** for a printable schedule.

## Project Structure

- `src/App.jsx` — Main application logic and UI.
- `src/App.css` — Styles.
- `src/main.jsx` — Entry point.
- `src/assets/logo.jpeg` — Tournament logo.
- `index.html` — HTML template.

## License

This project is for personal and non-