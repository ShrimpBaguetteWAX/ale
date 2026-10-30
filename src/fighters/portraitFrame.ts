import type { CSSProperties } from 'react'

/**
 * Where a fighter's head and shoulders sit in its full-body art, for a
 * portrait cut from it.
 *
 * The art ships a head crop of its own beside each fighter (`_avatar.webp`),
 * but those crops were scaled unevenly - Hunter Elgem's head is half as wide
 * again as in its own art - and some are off-centre. The full art is the same
 * 362 x 512 frame for every fighter and undistorted, so the portrait is cut
 * from it at one even scale instead.
 *
 * Each fighter stands differently in that frame (a short Onoros stands low),
 * so the cut was measured once per fighter from the art itself: the head
 * found from the alpha, the window half the figure's height, the zoom capped
 * so a small, big-headed fighter does not fill the card. The numbers are the
 * art's width, left and top as percentages of a 3 : 4.25 portrait.
 */
const FRAME: Record<string, [number, number, number]> = {
  arcanist_altan: [210.3, -58.8, 2.9],
  arcanist_elgem: [271.9, -98, -59],
  arcanist_human: [246.1, -48.8, -35.7],
  arcanist_robotron: [234.6, -84.3, -23.7],
  astralknight_human: [229.3, -47.8, -18.4],
  astralknight_khaured: [244.3, -71.9, -34.9],
  astralknight_lopati: [218, -66, -8.3],
  astralknight_onoros: [290, -87, -67.7],
  desperado_human: [235.2, -70.9, -21.9],
  desperado_khaured: [231.5, -67.5, -18.2],
  desperado_robotron: [240.2, -74.4, -27.3],
  explosioneer_elgem: [252.6, -70.9, -39.2],
  explosioneer_human: [246.5, -60.1, -32.7],
  explosioneer_lopati: [212.8, -51.4, 0.8],
  explosioneer_robotron: [232.5, -46.6, -19.3],
  hunter_altan: [228.4, -57.9, -15.2],
  hunter_elgem: [259.6, -71.7, -46.2],
  hunter_human: [222.9, -49.2, -9.7],
  hunter_robotron: [236.8, -60.5, -23.6],
  juggernaut_human: [235.7, -63.6, -22.5],
  juggernaut_khaured: [236.8, -68.7, -23.6],
  juggernaut_onoros: [290, -85.3, -81.9],
  lunatic_human: [248.3, -60.7, -35.5],
  lunatic_khaured: [212.3, -56, 0.4],
  lunatic_lopati: [208.9, -77.5, 5.1],
  lunatic_onoros: [290, -102.7, -85.3],
  mindblade_altan: [228.4, -49.7, -13.8],
  mindblade_elgem: [290, -108.5, -28.2],
  mindblade_khaured: [223.4, -58.5, -9.8],
  mindblade_lopati: [223.9, -60.8, -9.8],
  mindblade_onoros: [290, -96.8, -54],
  mystic_altan: [216.3, -57.6, -3.6],
  mystic_elgem: [272, -90.1, -59.1],
  mystic_lopati: [227.4, -82.1, -14.2],
  tactician_altan: [212.3, -58.1, 0.4],
  tactician_elgem: [262.3, -68.8, -49.4],
  tactician_human: [224.9, -43.6, -12.1],
  tactician_nordic: [227.9, -41.4, 2.2],
  voidcaller_altan: [213.2, -64.8, 0.4],
  voidcaller_elgem: [270.6, -70.5, -57.1],
  voidcaller_onoros: [255.7, -72.2, -42.9],
  voidcaller_robotron: [225.4, -61, -11.3],
  voidwarden_human: [233.1, -64.3, -20.3],
  voidwarden_khaured: [199, -37.3, -7],
  voidwarden_lopati: [217.3, -78.3, -3.7],
  voidwarden_onoros: [290, -90.9, -115.3],
}

/** A fighter the table does not know yet: the cut that suits most of them. */
const FALLBACK: [number, number, number] = [228, -60, -16]

/** The cut, as the custom properties `.rocard__art` reads. */
export function portraitCut(classname: string, racename: string): CSSProperties {
  const [z, x, y] = FRAME[`${classname}_${racename}`] ?? FALLBACK
  return { '--pz': `${z}%`, '--px': `${x}%`, '--py': `${y}%` } as CSSProperties
}
