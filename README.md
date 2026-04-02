# Doza Znanja

Gamificirana web aplikacija za ucenje farmakologije na hrvatskom jeziku.

## Stack

- `Vue 3 + Vite + Tailwind CSS` frontend
- `Node.js + Express` API
- `Prisma` ORM
- `PostgreSQL` u Docker Composeu
- `Orval` generirani typed client iz OpenAPI specifikacije

## Lokalni razvoj

1. Instaliraj ovisnosti:

```bash
npm install
```

2. Pokreni bazu:

```bash
docker compose up -d db
```

3. Generiraj Prisma client i sinkroniziraj schemu:

```bash
npm run prisma:generate
npm run prisma:push
```

4. Napuni bazu seed podacima:

```bash
npm run prisma:seed
```

5. Pokreni razvojne servere:

```bash
npm run dev
```

Frontend ce biti dostupan na `http://localhost:5173`, a API na `http://localhost:3000`.

## Docker backend

Ako zelis da backend i baza budu zajedno u Dockeru:

1. Podigni `api + db`:

```bash
npm run docker:up
```

2. Napuni bazu pocetnim podacima:

```bash
npm run docker:seed
```

Nakon toga API radi na `http://localhost:3000`, a frontend mozes pokrenuti lokalno:

```bash
npm run dev --workspace apps/web
```

## Korisni skriptovi

```bash
npm run build
npm run orval
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run docker:up
npm run docker:seed
npm run docker:down
```

## Sto je ukljuceno

- onboarding s lokalno spremljenim nadimkom
- premium minimalisticki redesign s vise sekcija
- hero pregled sesije, kurikulum, aktivna sesija i insights sekcija
- dashboard s razinom, XP-om, streakom i srcima
- adaptivni izbor sljedeceg pitanja
- odabir teme ili "adaptivni mix"
- povratna informacija nakon odgovora
- leaderboard i dnevna misija
- seedani skup pitanja iz osnovnih podrucja farmakologije
- import skripta za vlastiti bank pitanja
- in-app Import Center za obicnu skriptu, markdown ili question bank
- Learn view koji iz importa radi pregledne lekcije i checklistu za repeticiju
- quiz preview i scoped kviz iz tocno odabrane importirane kolekcije

## Uvoz vlastitih pitanja

Mozes definirati vlastitu skriptu ili JSON datoteku za pitanja.

Predlozak se nalazi u:

`apps/api/content/question-bank.template.ts`

Import iz `apps/api` direktorija:

```bash
npm run questions:import -- ./content/question-bank.template.ts
```

Podrzano je:

- `.ts`, `.js`, `.mjs` datoteka koja exporta `questionBank` ili `default`
- `.json` datoteka istog oblika

Napomena:

- import pitanja resetira attempts i progress kako bi baza ostala konzistentna
- seed i import koriste isti format, pa je lako zamijeniti demo sadrzaj vlastitim modulima

## Import kroz aplikaciju

U `Import Center` tabu sada mozes:

- zalijepiti obicnu skriptu, markdown biljeske ili gotov `questionBank`
- ucitati `.txt`, `.md`, `.json`, `.ts`, `.js` ili `.mjs` datoteku
- prvo dobiti preview tema, Learn lekcija i primjera kviz pitanja
- tek nakon toga objaviti kolekciju i uciti ili kvizirati samo iz tog importa

Ako je ulaz vec strukturirani `questionBank`, aplikacija ga cita direktno.
Ako je ulaz obicna skripta, aplikacija ga heuristicki dijeli po cjelinama, stvara
lekcije za Learn view i generira pocetna kviz pitanja iz istog izvora.

## Napomena o sadrzaju

Seedani farmakoloski sadrzaj je pocetni demo skup pitanja za MVP i nije zamjena za sluzbeni kurikulum, lokalne smjernice ili fakultetske materijale. Prije sire upotrebe vrijedi ga prosiriti i recenzirati s nastavnikom ili klinickim mentorom.

## Izvori za pocetni seed sadrzaj

- MSD Manual Professional: pregled farmakokinetike, farmakodinamike i apsorpcije
- FDA: naloxone za opioidno predoziranje, acetaminophen overdose i liver injury
- NHS: warfarin i INR pracenje, short-acting insulin i hypoglycaemia
- WHO: racionalna uporaba antibiotika i antimikrobna rezistencija
