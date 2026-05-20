
# LiU-AIS FPL App

A Fantasy Premier League companion app built for **LiU AI Society** (Linköping University). Track our mini-league standings, view gameweek results, and compare stats with other members, all in one place.

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- A [Supabase](https://supabase.com) project
- A [Netlify](https://netlify.com) account (for deployment or local dev with functions)

### Installation

```bash
git clone https://github.com/DanielWalkerTunek/LiU-AIS-fpl-app.git
cd LiU-AIS-fpl-app
npm install
```

### Environment Variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these values in your Supabase project under **Settings → API**.

### Running Locally

**Without Netlify functions:**
```bash
npm run dev
```
App runs at `http://localhost:5173`.

**With Netlify functions (recommended):**
```bash
npm install -g netlify-cli
netlify dev
```
App runs at `http://localhost:8888`, with serverless functions available.

## Project Structure

```
LiU-AIS-fpl-app/
├── netlify/
│   └── functions/       # Netlify serverless functions
├── src/                 # React application source
├── supabase/            # Supabase config / migrations
├── index.html
├── netlify.toml         # Netlify build & redirect config
├── vite.config.js
└── tailwind.config.js
```

## Deployment

The app is configured for one-click deployment on Netlify. Connect the repository in the Netlify dashboard and set the environment variables under **Site settings → Environment variables**. Netlify will pick up the build settings from `netlify.toml` automatically.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |


## Tech Stack

- **Frontend:** React 18, React Router v6, Recharts
- **Styling:** Tailwind CSS
- **Backend/DB:** Supabase (auth + database)
- **Serverless Functions:** Netlify Functions
- **Build Tool:** Vite
- **Deployment:** Netlify


## Database

The app uses [Supabase](https://supabase.com) for user authentication and data persistence. Any database migrations or seed files live in the `supabase/` directory.

## Contributing

Pull requests are welcome. For significant changes, open an issue first to discuss what you'd like to change.

## License

This project is maintained by LiU AI Society.
