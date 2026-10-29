// The one list of workshop studios. The Workshops dropdown on the home page and
// the studio pages read it, so adding a style is one entry here plus its page.
//   id      short name, also the localStorage / thumbnail key
//   name    shown in the menu
//   blurb   one line under the name
//   href    page, relative to this file
//   thumb   static thumbnail, relative to this file
export const STUDIOS = [
  {
    id: "hand",
    name: "Hand studio",
    blurb: "Build a Kamiji hand: tint, face, pose, shape, halo.",
    href: "hand.html",
    thumb: "img/hand.png",
  },
  {
    id: "kamikin",
    name: "Kamikin studio",
    blurb: "Pick one of 14 mochi, then face, clip, tint.",
    href: "kamikin.html",
    thumb: "img/kamikin.png",
  },
  {
    id: "emoji",
    name: "Emoji studio",
    blurb: "Make a character from a 3D emoji face.",
    href: "emoji.html",
    thumb: "img/emoji.png",
  },
];
