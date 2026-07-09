/**
 * Letter order for "undergroundradio" — matches client asset naming.
 * Sequence: u → n → d → e → r → g → r → o → u → n → d → r → a → d → i → o
 */
export interface LetterAsset {
  char: string;
  path: string;
}

export const UNDERGROUND_RADIO_LETTERS: LetterAsset[] = [
  { char: "u", path: "/assets/underground-radio/u.svg" },
  { char: "n", path: "/assets/underground-radio/N.svg" },
  { char: "d", path: "/assets/underground-radio/D.svg" },
  { char: "e", path: "/assets/underground-radio/E.svg" },
  { char: "r", path: "/assets/underground-radio/R.svg" },
  { char: "g", path: "/assets/underground-radio/G.svg" },
  { char: "r", path: "/assets/underground-radio/R-2.svg" },
  { char: "o", path: "/assets/underground-radio/O.svg" },
  { char: "u", path: "/assets/underground-radio/U-cap.svg" },
  { char: "n", path: "/assets/underground-radio/N-2.svg" },
  { char: "d", path: "/assets/underground-radio/D-2.svg" },
  { char: "r", path: "/assets/underground-radio/R-3.svg" },
  { char: "a", path: "/assets/underground-radio/A.svg" },
  { char: "d", path: "/assets/underground-radio/D-3.svg" },
  { char: "i", path: "/assets/underground-radio/I.svg" },
  { char: "o", path: "/assets/underground-radio/O-2.svg" },
];