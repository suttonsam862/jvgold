export type Era = "four-peat" | "asu" | "cbu" | "training";

export interface Photo {
  /** basename without extension, present in /public/img/{hero,web,thumb}/ */
  id: string;
  era: Era;
  alt: string;
  caption: string;
  orientation: "landscape" | "portrait" | "square";
}

export const photos: Photo[] = [
  {
    id: "19HSWCIFF9832",
    era: "four-peat",
    alt: "Jesse Vasquez finishing a takedown at the 2019 CIF State Finals",
    caption: "CIF State Finals, 2019 — the third title",
    orientation: "landscape",
  },
  {
    id: "19HSWCIFF9864",
    era: "four-peat",
    alt: "Jesse Vasquez in the white Excelsior singlet at the 2019 CIF State Finals",
    caption: "CIF State Finals, 2019",
    orientation: "landscape",
  },
  {
    id: "19HSWCIFF9929",
    era: "four-peat",
    alt: "Jesse Vasquez pointing to his temple after a state finals win",
    caption: "Mind over everything — CIF Finals, 2019",
    orientation: "portrait",
  },
  {
    id: "19HSWCIFF9945",
    era: "four-peat",
    alt: "Jesse Vasquez embraced by his coach after winning a state title",
    caption: "The corner that built a champion",
    orientation: "portrait",
  },
  {
    id: "19HSWCIFF9963",
    era: "four-peat",
    alt: "Referee raising Jesse Vasquez's arm at the CIF State Finals",
    caption: "Arm raised, again — 2019",
    orientation: "landscape",
  },
  {
    id: "19HSWCIFF9983",
    era: "four-peat",
    alt: "Jesse Vasquez celebrating with his team after a state finals win",
    caption: "Carried off the mat, 2019",
    orientation: "square",
  },
  {
    id: "20CIFFNL3798",
    era: "four-peat",
    alt: "Jesse Vasquez roaring in celebration after his fourth straight state title",
    caption: "Four in a row. First in Southern California history.",
    orientation: "landscape",
  },
  {
    id: "20CIFFNL3801",
    era: "four-peat",
    alt: "Jesse Vasquez celebrating with his fourth state championship medal",
    caption: "The four-peat, sealed — 2020",
    orientation: "portrait",
  },
  {
    id: "20CIFFNL3895",
    era: "four-peat",
    alt: "Jesse Vasquez from behind, arms raised, VASQUEZ across his back",
    caption: "VASQUEZ — a name the state learned by heart",
    orientation: "landscape",
  },
  {
    id: "20CIFFNL3912",
    era: "four-peat",
    alt: "Jesse Vasquez with both arms raised in victory at the 2020 CIF Finals",
    caption: "CIF State Finals, 2020",
    orientation: "portrait",
  },
  {
    id: "20CIFFNL3921",
    era: "four-peat",
    alt: "A CIF official raising Jesse Vasquez's hand after the 2020 final",
    caption: "The last high school match — a win, of course",
    orientation: "landscape",
  },
  {
    id: "20CIFFNL6383",
    era: "four-peat",
    alt: "Jesse Vasquez embracing family after the 2020 state finals",
    caption: "Family, first and always",
    orientation: "landscape",
  },
  {
    id: "23CMW_ASU_STANFORD11323",
    era: "asu",
    alt: "Jesse Vasquez courtside at an ASU vs Stanford dual",
    caption: "The desert years — Arizona State",
    orientation: "landscape",
  },
  {
    id: "24COL_NCAA_QRTS_0063",
    era: "asu",
    alt: "Jesse Vasquez warming up at the 2024 NCAA Championships",
    caption: "NCAA Championships, 2024",
    orientation: "landscape",
  },
  {
    id: "24COL_NCAA_RND16_9991",
    era: "asu",
    alt: "Jesse Vasquez in the ASU singlet at the 2024 NCAA round of 16",
    caption: "Round of 16, NCAA 2024",
    orientation: "landscape",
  },
  {
    id: "25CMW_SCUFFLE_QF_6325",
    era: "cbu",
    alt: "Jesse Vasquez in a low stance at the Southern Scuffle quarterfinals",
    caption: "Southern Scuffle quarterfinals — CBU",
    orientation: "landscape",
  },
  {
    id: "25CMW_SCUFFLE_QF_6342",
    era: "cbu",
    alt: "Jesse Vasquez controlling his opponent at the Southern Scuffle",
    caption: "In control — Southern Scuffle",
    orientation: "landscape",
  },
  {
    id: "25CMW_SCUFFLE_QF_6387",
    era: "cbu",
    alt: "Jesse Vasquez in the CBU singlet and white headgear",
    caption: "The last uniform — California Baptist",
    orientation: "portrait",
  },
  {
    id: "25CMW_SCUFFLE_QF_6647",
    era: "cbu",
    alt: "Jesse Vasquez driving through a takedown at the Southern Scuffle",
    caption: "Still dangerous — Southern Scuffle",
    orientation: "landscape",
  },
];

export const byEra = (era: Era) => photos.filter((p) => p.era === era);
export const photo = (id: string) => photos.find((p) => p.id === id)!;




