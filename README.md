# OŠK Kamenná Poruba Web

Web futbalového klubu OŠK Kamenná Poruba. Repo obsahuje statický frontend, Vercel API adaptér, Express backend a Prisma schému pre Neon PostgreSQL.

## Prehľad

- verejný klubový web v `index.html`, `pages/` a `assets/`
- interné moduly po prihlásení pre trénerov, hráčov a rodičov
- backend API pre auth, oznamy, ankety, tréningy, Sportsnet a Instagram integrácie
- nasadenie cez Vercel, dáta cez Neon PostgreSQL

## Štruktúra repozitára

Zdrojové súbory sú v koreni repozitára. `public/` je iba build výstup.

```text
OŠK-Kamenná-Poruba-Web/
├─ index.html                # hlavná stránka
├─ pages/                    # statické podstránky
├─ assets/                   # spoločné JS, CSS a obrázky
├─ api/                      # root Vercel API entrypointy
├─ src/                      # root Express app používaná root api/[...all].js
├─ prisma/                   # root Prisma schéma a seed
├─ backend/                  # paralelný backend workspace pre lokálny/dev deploy
│  ├─ src/
│  ├─ prisma/
│  ├─ api/
│  ├─ scripts/
│  └─ tests/
├─ public/                   # generované z index.html + pages/ + assets/
├─ scripts/
│  ├─ build-public.js        # sync root frontendu do public/
│  ├─ hooks/                 # hook automation pre workspace tools
│  └─ manual/                # tracked jednorazové utility a migrácie obsahu
├─ docs/
│  ├─ superpowers/
│  └─ archive/               # zachované recovery poznámky a historické artefakty
└─ tmp/                      # lokálne scratch súbory, napr. cookie jars
```

## Pravidlá zdrojov pravdy

- Frontend upravuj v `index.html`, `pages/` a `assets/`, nie v `public/`.
- Po úpravách frontendu regeneruj `public/` cez `npm run build`.
- Zmeny v `src/` zrkadli aj do `backend/src/`, ak sa týkajú rout, middleware, auth, configu alebo shared services.
- Zmeny v `prisma/` zrkadli aj do `backend/prisma/`.
- Lifecycle automation ukladaj do `scripts/hooks/`.
- Jednorazové utility ukladaj do `scripts/manual/`, nie do rootu.
- Recovery alebo archívne textové výstupy ukladaj do `docs/archive/`.
- Lokálne pomocné výstupy ukladaj do `tmp/`.

## Kľúčové časti aplikácie

- `index.html` obsahuje homepage logiku a vlastné inline skripty.
- `pages/important_info.html` rieši oznamy a ankety.
- `pages/trainings.html` a `assets/js/trainings.js` riešia tréningový modul.
- `pages/account_management.html` rieši správu používateľov a rolí.
- `pages/matches.html`, `pages/tabulka.html` a `pages/akademia.html` používajú Sportsnet dáta.
- `assets/js/header.js`, `assets/js/footer.js`, `assets/js/session.js` a `assets/js/cloudinary-assets.js` sú shared frontend helpery.

## Lokálne spustenie

### Požiadavky

- Node.js 18+
- npm
- Neon PostgreSQL databáza

### Root build a preview

```bash
npm install
npm run build
```

`npm run build` negeneruje produkčný Vercel build. Iba skopíruje root frontend do `public/`.

Frontend môžeš lokálne servovať ľubovoľným statickým serverom. API base si stránky určujú cez `window.OSKSession`; pri lokálnom override môžeš použiť `localStorage.setItem('OSK_API_BASE', 'http://localhost:4000/api')`.

### Backend

```bash
cd backend
npm install
npm run db:push
npm run dev
```

Minimálne backend env premenné:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `FRONTEND_ORIGIN`

Často používané voliteľné premenné:

- `PUBLIC_APP_URL`
- `PASSWORD_RESET_EXPIRES_MINUTES`
- `EMAIL_NOTIFICATIONS_ENABLED`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`
- `CONTACT_FORM_TO_EMAIL`
- `SPORTSNET_API_URL`, `SPORTSNET_API_KEY`, `SPORTSNET_TEAM_ID`, `SPORTSNET_COMPETITION_ID`, `SPORTSNET_SEASON`, `SPORTSNET_CACHE_SECONDS`
- `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`, `INSTAGRAM_FEED_LIMIT`, `INSTAGRAM_CACHE_SECONDS`

## Užitočné príkazy

### Root

```bash
npm run build
npm run vercel:build
npm run vercel:build:prod
npm run vercel:deploy
npm run vercel:deploy:prod
```

### Backend

```bash
cd backend
npm run dev
npm test
npm run db:push
npm run db:seed
npm run db:studio
```

## Deploy

Root `vercel.json` smeruje `/api/:path*` do `api/[...all].js`, ktoré používa root `src/app.js`.
`backend/` zostáva samostatný workspace pre backend-only spustenie, testovanie a alternatívny deploy flow.

Workspace hook v `.github/hooks/vercel-prod-deploy.json` spúšťa `scripts/hooks/deploy-vercel-prod.js` pri `Stop` evente. Ak repo obsahuje zmeny, hook skúsi automaticky spustiť produkčný `vercel build` a `vercel deploy`.

Ak chceš ručný deploy bez automatického Git buildu vo Verceli:

1. Vo Vercel projekte otvor `Settings -> Git`.
2. V `Ignored Build Step` nastav `exit 0`.
3. Deploy rob cez:

```bash
npm run vercel:build:prod
npm run vercel:deploy:prod
```

Pre `vercel deploy --prebuilt` nestačí obyčajné `npm run build`; treba použiť `vercel build` alebo `vercel build --prod`.

## Poznámky pre údržbu

- Do repozitára nepatria reálne heslá ani osobné údaje.
- `public/` nereorganizuj ručne; je generovaný.
- Keď upravíš backend routu alebo Prisma model, skontroluj obidve kópie v roote aj v `backend/`.
- Keď pridávaš nové pracovné utility alebo recovery výstupy, drž root čistý a ukladaj ich do `scripts/hooks/`, `scripts/manual/`, `docs/archive/` alebo `tmp/` podľa účelu.
