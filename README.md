# Doza Znanja

Gamificirana web aplikacija za ucenje farmakologije na hrvatskom jeziku, sada
organizirana kao library predmeta s posebnim `Home`, `Learn` i `Test` stranicama.

## Stack

- `Vue 3 + Vite + Tailwind CSS + Vue Router` frontend
- `Node.js + Express` API
- `Prisma` ORM
- `PostgreSQL` u Docker Composeu
- `Orval` generirani typed client iz OpenAPI specifikacije
- `pdfjs-dist` za citanje PDF dokumenata u frontendu
- `OpenAI` opcionalno za AI obradu cijelog TXT/PDF dokumenta

## Lokalni razvoj

1. Instaliraj ovisnosti:

```bash
npm install
```

Ako zelis puni AI import za velike skripte i PDF-ove, dodaj `.env` u root:

```bash
OPENAI_API_KEY=your_key_here
# opcionalno
OPENAI_STUDY_MODEL=gpt-4o-mini
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

Ovaj seed skript puni Docker bazu iz lokalnog workspacea, pa je rezultat isti kao i u razvoju.

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

- homepage library s istaknutom `Training` karticom
- top add button za novi predmet i `+` kartica za dodavanje jos jednog
- spremanje vlastitih predmeta iz `TXT` i `PDF` dokumenata
- skripta se vise ne ispisuje kao raw tekst u UI-ju nakon importa
- search bar po nazivu predmeta
- abecedni redoslijed s mogucnoscu pinanja zvjezdicom na vrh
- `show more` nakon prva 4 korisnicka predmeta
- preimenovanje i brisanje korisnickih predmeta
- `Learn` stranica za ucenje iz jednog predmeta
- `Test` stranica za scoped kviz iz jednog predmeta
- lokalno spremljen nadimak za pracenje XP-a, streaka i rezultata
- AI preview i generation iz cijelog importiranog dokumenta kada je `OPENAI_API_KEY` postavljen
- heuristicki fallback kada AI nije konfiguriran
- backend i baza zajedno u Docker okruzenju

## Import kroz aplikaciju

U `Import Center` tabu sada mozes:

- ucitati `TXT` i `PDF` datoteke
- dodijeliti naziv predmetu i kasnije ga preimenovati
- dobiti preview Learn lekcija i primjera pitanja prije spremanja
- spremiti predmet kao novu karticu u libraryju
- otvoriti `Uci` ili `Uradi test` za tocno taj predmet

Kada je `OPENAI_API_KEY` postavljen, backend obraduje cijeli dokument i vraca
cist Learn/Test sadrzaj bez prikaza sirovog teksta skripte u aplikaciji.

Ako AI nije konfiguriran, aplikacija koristi lokalni fallback parser za TXT i
PDF-ove koji imaju tekstualni sloj.

## Napomena o sadrzaju

Seedani farmakoloski sadrzaj je pocetni demo skup pitanja za MVP i nije zamjena za sluzbeni kurikulum, lokalne smjernice ili fakultetske materijale. Prije sire upotrebe vrijedi ga prosiriti i recenzirati s nastavnikom ili klinickim mentorom.

## Izvori za pocetni seed sadrzaj

- MSD Manual Professional: pregled farmakokinetike, farmakodinamike i apsorpcije
- FDA: naloxone za opioidno predoziranje, acetaminophen overdose i liver injury
- NHS: warfarin i INR pracenje, short-acting insulin i hypoglycaemia
- WHO: racionalna uporaba antibiotika i antimikrobna rezistencija
