export const questionBank = [
  {
    slug: "farmakokinetika",
    titleHr: "Farmakokinetika",
    descriptionHr: "Apsorpcija, distribucija, metabolizam i eliminacija lijeka.",
    accent: "#63d5c6",
    difficulty: "EASY",
    flashcards: [
      {
        questionHr: "Što najbolje opisuje farmakokinetiku?",
        explanationHr:
          "Farmakokinetika opisuje što organizam čini lijeku: apsorpciju, distribuciju, metabolizam i eliminaciju.",
        correctOptionId: "b",
        difficulty: "EASY",
        options: [
          { id: "a", textHr: "Kako lijek djeluje na receptor" },
          { id: "b", textHr: "Kako organizam obrađuje lijek" },
          { id: "c", textHr: "Kako lijek mijenja genom" },
          { id: "d", textHr: "Kako se bira doza antibiotika" }
        ]
      },
      {
        questionHr: "Koji je glavni organ metabolizma većine lijekova?",
        explanationHr:
          "Jetra je glavno mjesto biotransformacije većine lijekova, osobito putem CYP enzima.",
        correctOptionId: "c",
        difficulty: "EASY",
        options: [
          { id: "a", textHr: "Slezena" },
          { id: "b", textHr: "Pluća" },
          { id: "c", textHr: "Jetra" },
          { id: "d", textHr: "Koža" }
        ]
      },
      {
        questionHr: "Što znači poluvijek eliminacije lijeka?",
        explanationHr:
          "Poluvijek je vrijeme potrebno da se koncentracija lijeka u plazmi smanji za 50%.",
        correctOptionId: "a",
        difficulty: "MEDIUM",
        options: [
          { id: "a", textHr: "Vrijeme potrebno da koncentracija padne za 50%" },
          { id: "b", textHr: "Vrijeme do maksimalne koncentracije" },
          { id: "c", textHr: "Vrijeme do prve doze" },
          { id: "d", textHr: "Vrijeme do potpunog vezanja na proteine" }
        ]
      },
      {
        questionHr: "Prvi prolaz kroz jetru najviše smanjuje bioraspoloživost kojeg puta primjene?",
        explanationHr:
          "Oralni lijekovi nakon apsorpcije prolaze portalnom cirkulacijom kroz jetru i mogu biti značajno metabolizirani prije ulaska u sistemsku cirkulaciju.",
        correctOptionId: "d",
        difficulty: "MEDIUM",
        options: [
          { id: "a", textHr: "Intravenskog" },
          { id: "b", textHr: "Subkutanog" },
          { id: "c", textHr: "Transdermalnog" },
          { id: "d", textHr: "Peroralnog" }
        ]
      }
    ]
  },
  {
    slug: "farmakodinamika",
    titleHr: "Farmakodinamika",
    descriptionHr: "Receptori, učinkovitost i sigurnosni profil lijeka.",
    accent: "#f0b94b",
    difficulty: "MEDIUM",
    flashcards: [
      {
        questionHr: "Što agonist radi na receptoru?",
        explanationHr:
          "Agonist se veže na receptor i aktivira ga, pokrećući biološki odgovor.",
        correctOptionId: "a",
        difficulty: "EASY",
        options: [
          { id: "a", textHr: "Veže se i aktivira receptor" },
          { id: "b", textHr: "Veže se i trajno uništava receptor" },
          { id: "c", textHr: "Blokira sintezu receptora" },
          { id: "d", textHr: "Povećava eliminaciju lijeka bubrezima" }
        ]
      },
      {
        questionHr: "Antagonist na receptoru najčešće:",
        explanationHr:
          "Antagonist se veže na receptor bez aktivacije i tako sprječava učinak agonista.",
        correctOptionId: "b",
        difficulty: "EASY",
        options: [
          { id: "a", textHr: "Aktivira receptor jače od agonista" },
          { id: "b", textHr: "Sprječava učinak agonista bez aktivacije" },
          { id: "c", textHr: "Uvijek smanjuje apsorpciju lijeka" },
          { id: "d", textHr: "Skraćuje poluvijek lijeka" }
        ]
      },
      {
        questionHr: "Terapijski indeks opisuje:",
        explanationHr:
          "Terapijski indeks uspoređuje toksičnu i učinkovitu dozu, pa govori o sigurnosnoj širini lijeka.",
        correctOptionId: "c",
        difficulty: "MEDIUM",
        options: [
          { id: "a", textHr: "Brzinu apsorpcije lijeka" },
          { id: "b", textHr: "Omjer vezanja na proteine i distribucije" },
          { id: "c", textHr: "Odnos toksične i učinkovite doze" },
          { id: "d", textHr: "Broj receptora u tkivu" }
        ]
      },
      {
        questionHr: "Parcijalni agonist u usporedbi s punim agonistom ima:",
        explanationHr:
          "Parcijalni agonist aktivira receptor, ali postiže niži maksimalni učinak od punog agonista.",
        correctOptionId: "d",
        difficulty: "HARD",
        options: [
          { id: "a", textHr: "Veću intrinzičnu aktivnost" },
          { id: "b", textHr: "Isključivo toksični učinak" },
          { id: "c", textHr: "Nultu afinitet prema receptoru" },
          { id: "d", textHr: "Niži maksimalni učinak" }
        ]
      }
    ]
  },
  {
    slug: "analgetici",
    titleHr: "Analgetici i sigurnost",
    descriptionHr: "NSAID, paracetamol, opioidi i antidoti.",
    accent: "#ff8f6b",
    difficulty: "MEDIUM",
    flashcards: [
      {
        questionHr: "Koji je antidot za predoziranje opioidima?",
        explanationHr:
          "Nalokson je kompetitivni opioidni antagonist koji brzo reverzira respiratornu depresiju izazvanu opioidima.",
        correctOptionId: "b",
        difficulty: "EASY",
        options: [
          { id: "a", textHr: "Flumazenil" },
          { id: "b", textHr: "Nalokson" },
          { id: "c", textHr: "Atropin" },
          { id: "d", textHr: "N-acetilcistein" }
        ]
      },
      {
        questionHr: "Najvažniji ozbiljni rizik kronične primjene NSAID-a je:",
        explanationHr:
          "NSAID-i mogu povećati rizik gastrointestinalnog krvarenja i ulkusne bolesti, osobito pri duljoj primjeni.",
        correctOptionId: "c",
        difficulty: "MEDIUM",
        options: [
          { id: "a", textHr: "Hipoglikemija" },
          { id: "b", textHr: "Bradikardija" },
          { id: "c", textHr: "Gastrointestinalno krvarenje" },
          { id: "d", textHr: "Hipertireoza" }
        ]
      },
      {
        questionHr: "Predoziranje paracetamolom primarno oštećuje:",
        explanationHr:
          "Toksični metabolit paracetamola uzrokuje hepatotoksičnost, zato je jetra glavni ciljni organ.",
        correctOptionId: "a",
        difficulty: "MEDIUM",
        options: [
          { id: "a", textHr: "Jetru" },
          { id: "b", textHr: "Štitnjaču" },
          { id: "c", textHr: "Slezenu" },
          { id: "d", textHr: "Koštanu srž" }
        ]
      },
      {
        questionHr: "Koji je antidot za toksičnost paracetamola ako se primijeni pravodobno?",
        explanationHr:
          "N-acetilcistein nadoknađuje glutation i smanjuje hepatotoksičnost kod predoziranja paracetamolom.",
        correctOptionId: "d",
        difficulty: "MEDIUM",
        options: [
          { id: "a", textHr: "Nalokson" },
          { id: "b", textHr: "Vitamin K" },
          { id: "c", textHr: "Protamin" },
          { id: "d", textHr: "N-acetilcistein" }
        ]
      }
    ]
  },
  {
    slug: "kardiologija",
    titleHr: "Kardiovaskularni lijekovi",
    descriptionHr: "ACE inhibitori, beta-blokatori, diuretici i antikoagulansi.",
    accent: "#7bd389",
    difficulty: "HARD",
    flashcards: [
      {
        questionHr: "Koja je česta nuspojava ACE inhibitora?",
        explanationHr:
          "Suhi kašalj je klasična nuspojava ACE inhibitora zbog nakupljanja bradikinina.",
        correctOptionId: "c",
        difficulty: "EASY",
        options: [
          { id: "a", textHr: "Hiperglikemija" },
          { id: "b", textHr: "Tremor" },
          { id: "c", textHr: "Suhi kašalj" },
          { id: "d", textHr: "Midrijaza" }
        ]
      },
      {
        questionHr: "Koji laboratorijski parametar se rutinski prati kod varfarina?",
        explanationHr:
          "Učinak varfarina prati se INR-om kako bi se doza prilagodila i smanjio rizik od krvarenja ili tromboze.",
        correctOptionId: "b",
        difficulty: "MEDIUM",
        options: [
          { id: "a", textHr: "HbA1c" },
          { id: "b", textHr: "INR" },
          { id: "c", textHr: "CRP" },
          { id: "d", textHr: "Troponin" }
        ]
      },
      {
        questionHr: "Beta-blokatori najčešće usporavaju:",
        explanationHr:
          "Blokadom beta-adrenergičkih receptora često smanjuju frekvenciju srca i AV provođenje.",
        correctOptionId: "d",
        difficulty: "MEDIUM",
        options: [
          { id: "a", textHr: "Gastričnu sekreciju" },
          { id: "b", textHr: "Glomerularnu filtraciju" },
          { id: "c", textHr: "Sintezu albumina" },
          { id: "d", textHr: "Srčanu frekvenciju" }
        ]
      },
      {
        questionHr: "Koja je karakteristična nuspojava diuretika Henleove petlje poput furosemida?",
        explanationHr:
          "Furosemid može uzrokovati gubitak kalija, pa je hipokalemija važna nuspojava koju treba pratiti.",
        correctOptionId: "a",
        difficulty: "HARD",
        options: [
          { id: "a", textHr: "Hipokalemija" },
          { id: "b", textHr: "Hiperkalcemija" },
          { id: "c", textHr: "Hipoventilacija" },
          { id: "d", textHr: "Hipotireoza" }
        ]
      }
    ]
  },
  {
    slug: "antibiotici",
    titleHr: "Antimikrobna terapija",
    descriptionHr: "Racionalna uporaba antibiotika i česte nuspojave.",
    accent: "#8fb8ff",
    difficulty: "MEDIUM",
    flashcards: [
      {
        questionHr: "Zašto je važno racionalno propisivati antibiotike?",
        explanationHr:
          "Neracionalna primjena povećava razvoj bakterijske rezistencije i izlaže bolesnika nepotrebnim nuspojavama.",
        correctOptionId: "a",
        difficulty: "EASY",
        options: [
          { id: "a", textHr: "Kako bi se smanjila rezistencija i nepotrebne nuspojave" },
          { id: "b", textHr: "Kako bi svi pacijenti primili isti lijek" },
          { id: "c", textHr: "Kako bi se izbjeglo mikrobiološko testiranje" },
          { id: "d", textHr: "Kako bi antibiotici djelovali dulje od 24 sata" }
        ]
      },
      {
        questionHr: "Koja je česta nuspojava širokospektralne antibiotske terapije?",
        explanationHr:
          "Širokospektralni antibiotici mogu narušiti normalnu mikrobiotu i uzrokovati proljev.",
        correctOptionId: "d",
        difficulty: "EASY",
        options: [
          { id: "a", textHr: "Bradikinezija" },
          { id: "b", textHr: "Mioza" },
          { id: "c", textHr: "Fotosinteza kože" },
          { id: "d", textHr: "Proljev" }
        ]
      },
      {
        questionHr: "Penicilini pripadaju kojoj velikoj skupini antibiotika?",
        explanationHr:
          "Penicilini su beta-laktamski antibiotici koji inhibiraju sintezu stanične stijenke bakterija.",
        correctOptionId: "b",
        difficulty: "MEDIUM",
        options: [
          { id: "a", textHr: "Makrolidima" },
          { id: "b", textHr: "Beta-laktamima" },
          { id: "c", textHr: "Tetraciklinima" },
          { id: "d", textHr: "Fluorokinolonima" }
        ]
      },
      {
        questionHr: "Koji podatak je posebno važan prije propisivanja penicilina?",
        explanationHr:
          "Podatak o ranijoj alergijskoj reakciji važan je zbog rizika od ozbiljne preosjetljivosti.",
        correctOptionId: "c",
        difficulty: "MEDIUM",
        options: [
          { id: "a", textHr: "Boja očiju pacijenta" },
          { id: "b", textHr: "Dominantna ruka pacijenta" },
          { id: "c", textHr: "Povijest alergije na penicilin" },
          { id: "d", textHr: "Koliko koraka napravi dnevno" }
        ]
      }
    ]
  },
  {
    slug: "endokrinologija",
    titleHr: "Endokrina farmakoterapija",
    descriptionHr: "Inzulin, kortikosteroidi i osnovna sigurnost praćenja.",
    accent: "#c79dff",
    difficulty: "HARD",
    flashcards: [
      {
        questionHr: "Najčešća akutna komplikacija primjene inzulina je:",
        explanationHr:
          "Hipoglikemija je najčešća akutna i klinički važna komplikacija liječenja inzulinom.",
        correctOptionId: "a",
        difficulty: "EASY",
        options: [
          { id: "a", textHr: "Hipoglikemija" },
          { id: "b", textHr: "Hiperkalcemija" },
          { id: "c", textHr: "Hipertermija" },
          { id: "d", textHr: "Hipernatremija" }
        ]
      },
      {
        questionHr: "Dugotrajna primjena sistemskih kortikosteroida može uzrokovati:",
        explanationHr:
          "Sistemski kortikosteroidi pri duljoj primjeni mogu dovesti do osteoporoze, hiperglikemije i drugih metaboličkih komplikacija.",
        correctOptionId: "d",
        difficulty: "MEDIUM",
        options: [
          { id: "a", textHr: "Trajnu euforiju bez nuspojava" },
          { id: "b", textHr: "Potpunu rezistenciju na inzulin u svih bolesnika" },
          { id: "c", textHr: "Isključivo hipotermiju" },
          { id: "d", textHr: "Osteoporozu i hiperglikemiju" }
        ]
      },
      {
        questionHr: "Koji je važan savjet pri naglom prekidu dugotrajne terapije kortikosteroidima?",
        explanationHr:
          "Kortikosteroide se obično ne prekida naglo nakon dulje primjene zbog rizika adrenalne insuficijencije.",
        correctOptionId: "b",
        difficulty: "HARD",
        options: [
          { id: "a", textHr: "Uvijek ih zamijeniti NSAID-om isti dan" },
          { id: "b", textHr: "Dozu treba postupno smanjivati" },
          { id: "c", textHr: "Povećati unos željeza bez praćenja" },
          { id: "d", textHr: "Dati lijek isključivo navečer" }
        ]
      },
      {
        questionHr: "Kod bolesnika na inzulinu za brzu procjenu glikemije najčešće pratimo:",
        explanationHr:
          "Samokontrola kapilarne glukoze daje brzu informaciju potrebnu za svakodnevnu prilagodbu terapije.",
        correctOptionId: "c",
        difficulty: "MEDIUM",
        options: [
          { id: "a", textHr: "INR" },
          { id: "b", textHr: "Amilazu" },
          { id: "c", textHr: "Kapilarnu glukozu" },
          { id: "d", textHr: "Bilirubin" }
        ]
      }
    ]
  }
] as const;
