# OŠK Kamenná Poruba — Klubový web (Frontend + Backend + Neon)

Tento projekt je web futbalového klubu OŠK Kamenná Poruba s oddeleným frontendom a backend API.
Citlivé dáta (účty, roly, oznamy, ankety, tréningy a účasť) sú spravované cez backend a uložené v Neon PostgreSQL.

## 1) Čo projekt rieši

- verejnú prezentáciu klubu (domov, o nás, zápasy, galéria, kontakt)
- internú časť po prihlásení podľa roly používateľa
- správu tréningov, udalostí (oznamov) a ankiet
- evidenciu účasti hráčov na tréningoch

## 2) Role používateľov

- **Coach (tréner)**
  - vytvára a spravuje tréningy
  - vytvára udalosti/oznamy
  - vytvára a ukončuje ankety
- **Player (hráč)**
  - vidí relevantné tréningy/oznamy/ankety
  - hlasuje v anketách
  - potvrdzuje účasť na tréningu
- **Parent (rodič)**
  - vidí tréningy a stav detí
  - môže potvrdiť účasť za svoje dieťa

## 3) Hlavné funkcionality

- autentifikácia cez backend (`httpOnly` cookie session)
- CSRF ochrana pre write operácie
- role-based prístup (RBAC)
- tréningy: create/list/attendance/close/delete
- email notifikácie pri vytvorení tréningu pre hráčov vo vybranej kategórii (ak je nastavené SMTP)

- udalosti: create/list/delete (s cieľovou skupinou)
- ankety: create/list/vote/close/delete
- audit záznamy vybraných akcií v backende

## 4) Architektúra

- **Frontend**: statické HTML + JS súbory v koreňovom priečinku
- **Backend**: Node.js/Express v priečinku `backend/`
- **Databáza**: Neon PostgreSQL + Prisma ORM
- **Auth**: JWT session v `httpOnly` cookie + endpoint `me`

## 5) Štruktúra projektu

Pre lepšiu orientáciu je repozitár rozdelený do 3 častí: **frontend (root)**, **API adaptér (root `api/`)** a **backend (`backend/`)**.

```text
OŠK-Kamenná-Poruba/
├─ index.html
├─ pages/
│  ├─ important_info.html
│  ├─ matches.html
│  ├─ trainings.html
│  ├─ account_management.html
│  ├─ players_list_coach.html
│  ├─ player_detail_coach.html
│  ├─ akademia.html
│  ├─ atim.html
│  ├─ blog.html
│  └─ timeline_ihriska.html
├─ assets/
│  ├─ images/
│  └─ js/trainings.js
├─ api/
│  ├─ [...all].js
│  └─ proxy.js
└─ backend/
  ├─ api/[...all].js
  ├─ prisma/
  ├─ scripts/
  └─ src/
```

### Frontend (root)

**Verejné stránky**

- `index.html` — hlavná stránka + login + sekcie klubu
- `pages/akademia.html`, `pages/atim.html`, `pages/blog.html`, `pages/timeline_ihriska.html`
- `pages/matches.html` — zápasy

**Interné moduly**

- `pages/important_info.html` — udalosti a ankety
- `pages/trainings.html` + `assets/js/trainings.js` — tréningový modul
- `pages/account_management.html` — správa účtov
- `pages/players_list_coach.html`, `pages/player_detail_coach.html` — tréner pohľady

**Médiá**

- `assets/images/` — obrázky, galéria a logo

### API na Vercel (root `api/`)

- `api/[...all].js` — serverless vstup pre API
- `api/proxy.js` — proxy handler

### Backend (`backend/`)

**Aplikácia**

- `src/app.js` — inicializácia Express app
- `src/server.js` — lokálny štart servera
- `src/routes/` — API routy (`auth`, `trainings`, `announcements`, `polls`, ...)
- `src/middleware/` — auth, role guard, CSRF, error handling
- `src/services/` — token, email, Sportsnet logika
- `src/config/`, `src/data/` — konfigurácia a prístup k dátam

**Databáza a seed**

- `prisma/schema.prisma` — dátový model
- `prisma/seed.js`, `scripts/seed_demo_content.js`

**Deploy a env**

- `backend/vercel.json` — backend Vercel nastavenie
- `.env.example` — vzor konfigurácie
- `.env.vercel.example` — šablóna pre Vercel environment variables

## 6) API prehľad

### Základ

- `GET /api/health`
- `GET /api/csrf-token`

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

### Tréningy

- `GET /api/trainings`
- `POST /api/trainings` (coach)
- `PATCH /api/trainings/:id/attendance` (player/parent)
- `PATCH /api/trainings/:id/close` (coach)
- `DELETE /api/trainings/:id` (coach)

### Udalosti a ankety

- `GET /api/announcements`, `POST /api/announcements`, `DELETE /api/announcements/:id`
- `GET /api/polls`, `POST /api/polls`, `POST /api/polls/:id/vote`, `PATCH /api/polls/:id/close`, `DELETE /api/polls/:id`

### Sportsnet Online (automatické dáta)

- `GET /api/sportsnet/matches`
- `GET /api/sportsnet/matches?refresh=true` (ignoruje cache)

Backend endpoint je pripravený ako adaptér na `sportsnet.online` feed/API.
Potrebné env premenné:

- `SPORTSNET_API_URL` (URL feedu/endpointu od Sportsnetu, bez API kľúča v query)
- `SPORTSNET_API_KEY` (odošle sa v hlavičke `Authorization: ApiKey {apikey}`)
- `SPORTSNET_TEAM_ID` (voliteľné)
- `SPORTSNET_COMPETITION_ID` (voliteľné)
- `SPORTSNET_SEASON` (voliteľné)
- `SPORTSNET_CACHE_SECONDS` (voliteľné, default `300`)

Poznámka: endpoint je potrebné nastaviť explicitne (`SPORTNET_API_URL` alebo `SPORTNET_API_BASE`).
Ak endpoint nie je nastavený, backend nevolá upstream API a vráti prázdne dáta namiesto chyby 502.

## 7) Lokálne spustenie

### Požiadavky

- Node.js 18+
- npm
- Neon PostgreSQL databáza

### Backend

1. Prejdi do `backend/`
2. `npm install`
3. skopíruj `.env.example` na `.env`
4. doplň minimálne:
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET`
   - `FRONTEND_ORIGIN`
5. voliteľne pre email notifikácie tréningov nastav:

- `EMAIL_NOTIFICATIONS_ENABLED=true`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASS`
- `SMTP_FROM_EMAIL` (odosielateľ)
- `CONTACT_FORM_TO_EMAIL` (voliteľné, príjemca správ z verejného kontaktného formulára; ak chýba, použije sa `SMTP_FROM_EMAIL`)

6. Prisma:
   - `npx prisma generate`
   - `npx prisma db push`
7. spusti server: `npm run dev`
8. spusti testy backendu: `npm test`

### Email notifikácie tréningov

- po vytvorení tréningu sa odošle email aktívnym hráčom danej kategórie, ktorí majú vyplnený email
- mapovanie kategórií:
  - `pripravky` -> `pripravka_u9`, `pripravka_u11`
  - `ziaci` -> `ziaci`
  - `dorastenci` -> `dorastenci`
  - `adults_young` -> `adults_young`
  - `adults_pro` -> `adults_pro`
- email používateľa zadáš pri vytvorení účtu v správe účtov

### Kontaktný formulár (Pošlite nám správu)

- formulár na hlavnej stránke odosiela správu cez backend endpoint `POST /api/contact`
- vyžaduje funkčné SMTP nastavenie (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`)
- príjemcu vieš nastaviť cez `CONTACT_FORM_TO_EMAIL` (inak ide na `SMTP_FROM_EMAIL`)

### Frontend

- otvor root projekt cez Live Server (alebo iný statický server)
- frontend komunikuje s backendom na porte podľa `.env` (štandardne `4000`)

## 8) Bezpečnostné poznámky

- do repozitára nepatria reálne heslá ani osobné účty
- `.env` je lokálny a nemá sa commitovať
- citlivé dáta patria do databázy (Neon), nie do frontend súborov

## 9) Aktuálny stav

- projekt je funkčný MVP s backend autentifikáciou a Neon perzistenciou
- verejné časti webu fungujú ako prezentačný web klubu
- interné moduly (tréningy, udalosti, ankety) sú riešené cez API

## 10) Deploy: Vercel (frontend + backend) + Neon

Táto verzia repozitára je pripravená na jeden Vercel projekt:

- **Frontend**: statické HTML súbory z rootu
- **Backend**: Vercel serverless funkcia cez `api/[...all].js` (Express app z `backend/src/app.js`)
  API = apikey-6f513b9b7effe636604698147ddeaf0d5f9c177fb36a0207d355b85bc4d91c96
