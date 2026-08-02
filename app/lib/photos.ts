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

  // ---- Added Aug 1 2026. Only photographs with NO identifiable minors
  // appear here. Shots containing recognisable children are held in
  // docs/PHOTO-HOLDS.md pending signed media releases.
  {
    id: 'ASU_Walkout_Red',
    era: 'asu',
    alt: 'A wrestler in a black Arizona State singlet walks out through red-lit arena haze as two flame jets fire beside him; an arena banner reading \'YE WHO ENTER\' hangs above.',
    caption: 'The walkout. Everything before this was preparation.',
    orientation: 'landscape',
  },
  {
    id: 'ASU_committed_post',
    era: 'asu',
    alt: 'A recruiting announcement graphic reading \'COMMITTED\' and \'JESSE VASQUEZ\', showing a wrestler in a gold Arizona State singlet with the pitchfork logo, shouting and holding headgear.',
    caption: 'Committed. Arizona State.',
    orientation: 'portrait',
  },
  {
    id: 'ASU_interview_shot',
    era: 'asu',
    alt: 'A young man in a black polo shirt with a clip-on microphone speaks to camera in a training room, in front of a yellow wall with an ASU logo and a row of exercise bikes.',
    caption: 'On the record at Arizona State.',
    orientation: 'landscape',
  },
  {
    id: 'Asu_Match_Shot',
    era: 'asu',
    alt: 'A wrestler in a navy and gold Arizona State singlet stands on the mat shouting after a match, with a blurred arena crowd behind him.',
    caption: 'The moment the work shows.',
    orientation: 'landscape',
  },
  {
    id: 'asu_jesse_in_stance',
    era: 'asu',
    alt: 'A wrestler in a gold Arizona State singlet and white headgear crouches in a low stance on a maroon mat, under a banner reading \'ABANDON ALL HOPE YE WHO ENTER HERE\'.',
    caption: 'Stance first. Everything else follows.',
    orientation: 'landscape',
  },
  {
    id: 'jesse_coaching_deep_waters_pointing_right',
    era: 'asu',
    alt: 'Jesse Vasquez in a maroon, white and gold Arizona State Sun Devils warm-up top with the interlocking AS logo and an NCAA Wrestling Championships patch, arm extended to his left, holding a phone, standing against a plain wall.',
    caption: 'Arizona State. The standard set early.',
    orientation: 'portrait',
  },
  {
    id: 'Jesse_portrait_shot',
    era: 'cbu',
    alt: 'A man in a maroon, white and gold Arizona State warmup top stands against a wall, looking at the camera, in front of a banner reading \'#KEEPCBUWRESTLING\'.',
    caption: 'Confidence. Discipline. Standard.',
    orientation: 'portrait',
  },
  {
    id: 'jesse_coaching_deep_waters',
    era: 'training',
    alt: 'Jesse Vasquez in a white t-shirt bent at the waist, locked up with a training partner in gray shorts, demonstrating a takedown position in an orange-walled wrestling room.',
    caption: 'The position is taught by holding it.',
    orientation: 'landscape',
  },
  {
    id: 'jesse_deep_waters_pic_with_kid',
    era: 'training',
    alt: 'Low-angle shot of Jesse Vasquez standing against a wall hung with championship belts, pointing at the Deep Waters Wrestling logo on the back of a young boy\'s shirt; the boy faces away from the camera with his head down.',
    caption: 'The logo goes on the next one.',
    orientation: 'portrait',
  },
  {
    id: 'jesse_deep_waters_shirt_back',
    era: 'training',
    alt: 'A man photographed from behind with his head bowed, wearing a black t-shirt with a large white Deep Waters Wrestling logo across the back, standing in front of gym banners.',
    caption: 'The name on the back is the whole point.',
    orientation: 'portrait',
  },
  {
    id: 'jesse_sitting_matside',
    era: 'training',
    alt: 'Jesse Vasquez sits on the floor against a padded wall in a sweat-soaked white t-shirt and black sweatpants, knees drawn up, tying a shoelace and looking off to his right, with a large orange gym crest on the wall behind him.',
    caption: 'The work does not announce itself.',
    orientation: 'landscape',
  },


  // Team and training photographs containing identifiable minors.
  // Sam confirmed on Aug 1 2026 that these are approved for publication.
  // If a family ever withdraws consent, remove the entry here — every
  // page reads from this list, so one deletion pulls it site-wide.
  {
    id: 'Jesse_Coach_Stance',
    era: 'training',
    alt: 'A coach in a maroon and white Arizona State warmup top and black sweatpants walks across a gym floor talking, with tournament posters on the wall behind him and young wrestlers training in the background.',
    caption: 'Same standard, different side of the mat.',
    orientation: 'landscape',
  },
  {
    id: 'deep_waters_athlete_action_shot',
    era: 'training',
    alt: 'A young wrestler in a black and blue Deep Waters singlet stands in a low stance on a white USA Wrestling mat, with an official and another wrestler at the edge of frame.',
    caption: 'Learning the position young.',
    orientation: 'landscape',
  },
  {
    id: 'deep_waters_campers',
    era: 'training',
    alt: 'Two young boys in black Deep Waters Wrestling t-shirts stand side by side against a wall, one with an arm around the other, both looking at the camera and smiling.',
    caption: 'The next group in the room.',
    orientation: 'portrait',
  },
  {
    id: 'deep_waters_jesse_talk_to_team',
    era: 'training',
    alt: 'A coach stands at the right of frame speaking to a tight group of teenage and younger athletes wearing tournament lanyards outside a building, with other adults nearby.',
    caption: 'The talk before the session.',
    orientation: 'landscape',
  },
  {
    id: 'deep_waters_team_pic_1',
    era: 'training',
    alt: 'A large group of about forty-five wrestlers, children and adults, posed together in rows on an orange and black wrestling mat in a gym.',
    caption: 'The whole room, on the record.',
    orientation: 'landscape',
  },
  {
    id: 'deep_waters_team_pic_special_',
    era: 'training',
    alt: 'A group of about fourteen wrestlers and coaches posed together outdoors against a block wall at a tournament venue, most wearing black Deep Waters Wrestling shirts, several with tournament credentials on lanyards; Jesse Vasquez crouches at the front right.',
    caption: 'One room, one standard.',
    orientation: 'landscape',
  },
  {
    id: 'jesse_coach_behind_shot',
    era: 'training',
    alt: 'Jesse Vasquez seen from behind in a maroon and white Arizona State warm-up top reading VASQUEZ 02V, facing a wrestling room full of youth and teen athletes warming up on the mat inside a gym with an open roll-up door.',
    caption: 'He faces the room. The room faces forward.',
    orientation: 'landscape',
  },
  {
    id: 'jesse_coaching_deep_waters_2',
    era: 'training',
    alt: 'Jesse Vasquez, seen from behind in a white t-shirt, gripping wrists with a teenage athlete in a black shirt who faces him, both standing on the mat in an orange-walled wrestling room with other athletes training behind them.',
    caption: 'Hand fighting starts before the whistle.',
    orientation: 'landscape',
  },
  {
    id: 'jesse_deep_waters_behind_shot_2',
    era: 'training',
    alt: 'Jesse Vasquez stands with arms raised in a maroon and white Arizona State warm-up top reading VASQUEZ 02V, seen from behind on a jiu-jitsu mat logo, addressing a wide spread of youth and teen wrestlers scattered across the room.',
    caption: 'Attention, then work.',
    orientation: 'landscape',
  },
  {
    id: 'jesse_deep_waters_duo_pic',
    era: 'training',
    alt: 'Jesse Vasquez stands against a wall in a black Deep Waters Wrestling t-shirt with his hands on the shoulders of a young boy in a matching oversized shirt, who flexes both arms and smiles at the camera.',
    caption: 'Every standard is handed down.',
    orientation: 'portrait',
  },
  {
    id: 'remy_coaching_deep_waters',
    era: 'training',
    alt: 'Remy Murillo kneels matside in a Deep Waters polo, hand on the back of a young wrestler in a black Deep Waters singlet who is walking off the mat, at an indoor tournament with spectators and a second Deep Waters coach in the background.',
    caption: 'Corner work. The part nobody films.',
    orientation: 'landscape',
  },

];

export const byEra = (era: Era) => photos.filter((p) => p.era === era);
export const photo = (id: string) => photos.find((p) => p.id === id)!;




