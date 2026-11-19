# Grinder's Manual Trainer

A single-page study app for *The Grinder's Manual* (Peter Clarke): 14 chapter lessons with quizzes, a range trainer built from the book's charts, math drills, and spaced-repetition flashcards.

No build step and no dependencies. Open `index.html` in a browser, or serve the folder with any static host.

## Run locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this folder to a repo.
2. In the repo: Settings > Pages > Source: Deploy from a branch > `main` / root.
3. The app will be live at `https://<user>.github.io/<repo>/`.

## Notes

- Progress (lessons, quiz scores, drill stats, flashcard schedule) is stored in the browser's `localStorage`, so it is per browser and per device.
- Fonts load from Google Fonts. Without a connection the app falls back to system fonts.
- Lesson text is a summary in my own words; the book itself is not included. Keep the repo private if you prefer not to publish study notes based on a paid book.
