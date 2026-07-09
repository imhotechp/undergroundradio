/**
 * Letter order for "undergroundradio" — matches client asset naming.
 * Sequence: u → n → d → e → r → g → r → o → u → n → d → r → a → d → i → o
 */
import uSvg from "@/public/assets/underground-radio/u.svg?raw";
import nSvg from "@/assets/underground-radio/N.svg?raw";
import dSvg from "@/assets/underground-radio/D.svg?raw";
import eSvg from "@/assets/underground-radio/E.svg?raw";
import rSvg from "@/assets/underground-radio/R.svg?raw";
import gSvg from "@/assets/underground-radio/G.svg?raw";
import r2Svg from "@/assets/underground-radio/R-2.svg?raw";
import oSvg from "@/assets/underground-radio/O.svg?raw";
import uCapSvg from "@/assets/underground-radio/U-cap.svg?raw";
import n2Svg from "@/assets/underground-radio/N-2.svg?raw";
import d2Svg from "@/assets/underground-radio/D-2.svg?raw";
import r3Svg from "@/assets/underground-radio/R-3.svg?raw";
import aSvg from "@/assets/underground-radio/A.svg?raw";
import d3Svg from "@/assets/underground-radio/D-3.svg?raw";
import iSvg from "@/assets/underground-radio/I.svg?raw";
import o2Svg from "@/assets/underground-radio/O-2.svg?raw";

export interface LetterAsset {
  char: string;
  svg: string;
}

export const UNDERGROUND_RADIO_LETTERS: LetterAsset[] = [
  { char: "u", svg: uSvg },
  { char: "n", svg: nSvg },
  { char: "d", svg: dSvg },
  { char: "e", svg: eSvg },
  { char: "r", svg: rSvg },
  { char: "g", svg: gSvg },
  { char: "r", svg: r2Svg },
  { char: "o", svg: oSvg },
  { char: "u", svg: uCapSvg },
  { char: "n", svg: n2Svg },
  { char: "d", svg: d2Svg },
  { char: "r", svg: r3Svg },
  { char: "a", svg: aSvg },
  { char: "d", svg: d3Svg },
  { char: "i", svg: iSvg },
  { char: "o", svg: o2Svg },
];
