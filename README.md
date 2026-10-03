# ✦ Skribbl Studio – Draw together

A polished, client-side drawing and guessing game built with **vanilla HTML, CSS, and JavaScript**. It is intentionally dependency-free, responsive, touch-friendly, and ready to deploy to GitHub Pages.

---

## ✨ Features

- 🎨 **Full drawing canvas** — Pen, Brush, Pencil, Eraser, Rect, Circle, Line tools
- 🪣 **Flood fill** — paint-bucket fill any enclosed area
- 🔁 **Undo / Clear**
- 🎭 **16 emoji avatars** to choose from
- 💬 **Guess panel** — live chat with correct-guess detection and scoring
- 🏆 **Scoreboard** — live player scores update in real time
- 🎨 **Built-in themes** plus a custom theme builder
- 🎨 **Custom theme builder** — pick any colour for 9 UI elements with live preview
- 📱 **Touch / mobile support** on canvas

---

## 🗂️ Project Structure

```
skribbl/
├── index.html          ← Main HTML + all screens
├── css/
│   └── style.css       ← All styles (theme variables, layout, animations)
├── assets/
│   └── pixel-characters.png ← Pixel character sprite sheet
├── manifest.json      ← Installable app metadata
├── sw.js              ← Offline cache for deployed apps
└── js/
    ├── words.js        ← Word list + randWords() helper
    ├── themes.js       ← Theme presets + custom builder logic
    ├── canvas.js       ← Drawing engine (strokes, shapes, flood fill)
    ├── game.js         ← Round logic, timer, chat, scoreboard
    └── main.js         ← Global state, home/lobby screens, and boot
```

---

## 🚀 Getting Started

### Open directly in a browser

Just open `index.html` in any modern browser. Local play does not need a server.

For installable PWA behavior and offline caching, serve the folder over HTTP.
Service workers are not enabled for `file://` URLs.

### Option 2 – Serve locally

```bash
# Python 3
python -m http.server 8080

# Node (npx)
npx serve .
```

Then visit `http://localhost:8080`.

### Option 3 – Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to `main` branch, `/ (root)`
4. Your game will be live at `https://<you>.github.io/<repo>/`

---

## 🎮 How to Play

1. Enter your name and pick an avatar
2. **Create Room** → share the 6-letter room code with friends
3. The host chooses the number of rounds and timer length
4. Friends enter the code and click **Join Room**
5. Host clicks **Start Game**
6. The drawer picks a word from 3 options and draws it on the canvas
7. Other players type guesses in the chat — the faster you guess, the more points!
8. After all rounds the leaderboard shows the winner 🏆

---

## 🎨 Theming

Click a theme button in the top bar to switch instantly.  
Click **🎨 Custom** to open the colour builder — pick any colour for:

| Setting | Controls |
|---|---|
| Background 1 / 2 / 3 | The gradient background |
| Accent / Title | Titles, word display, highlights |
| Primary Button | Create Room, Start Game, etc. |
| Secondary Button | Join Room, timer |
| Card Background | Panel backgrounds |
| Input Background | Input fields, rows |
| Text Color | All body text |

Hit **✓ Apply My Theme** to see it live.

---

## 🌐 Multiplayer

The app uses Supabase Realtime channels for browser multiplayer:

- Room presence keeps the lobby and leaderboard players in sync
- Broadcast events sync drawing strokes, clears, undo actions, chat, room settings, and round starts
- The host controls prompts and broadcasts the selected word to the room
- The lobby shows whether Realtime is connected; if it cannot connect, the app clearly falls back to local mode
- Test multiplayer through HTTP (for example `python -m http.server 8080`) rather than `file://`, then open the room in two browser windows

The browser-safe anon key is stored in `js/supabase-config.js`. Never place a Supabase
service-role key in a browser project.

---

## 📄 License

MIT — do whatever you like with it!
