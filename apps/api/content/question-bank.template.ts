export const questionBank = [
  {
    slug: "naziv-modula",
    titleHr: "Naziv modula",
    descriptionHr: "Kratki opis cjeline koju zelis uciti.",
    accent: "#6b8cff",
    difficulty: "EASY",
    flashcards: [
      {
        questionHr: "Koja tvrdnja je tocna?",
        explanationHr: "Ovdje napisi kratko objasnjenje zasto je odgovor tocan.",
        correctOptionId: "b",
        difficulty: "EASY",
        options: [
          { id: "a", textHr: "Prva tvrdnja" },
          { id: "b", textHr: "Druga tvrdnja" },
          { id: "c", textHr: "Treca tvrdnja" },
          { id: "d", textHr: "Cetvrta tvrdnja" }
        ]
      }
    ]
  }
] as const;

export default questionBank;
