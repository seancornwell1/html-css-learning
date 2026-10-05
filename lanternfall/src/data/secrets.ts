/**
 * Secrets (GAME_DESIGN §9.2). Conditions live in the sim; this is the
 * presentation data: what each secret unlocks and the cryptic death-screen
 * fragments that hint at them.
 */
export interface SecretDef {
  id: string;
  /** Character unlocked, if any. */
  unlocks?: string;
  /** Shown once when the secret is found. */
  reveal: string;
}

export const SECRETS: readonly SecretDef[] = [
  {
    id: 'kagerou',
    unlocks: 'kagerou',
    reveal: 'Something without a face walked beside you all night. It will walk with you now.',
  },
  {
    id: 'ido',
    unlocks: 'ido',
    reveal: 'The well keeper climbs out, dripping. "You let them drown in the dark. Thank you."',
  },
  {
    id: 'dawn_early',
    reveal: 'The Mother fell before the sky turned grey. Your lantern is edged in gold.',
  },
];

/** Death-screen fragments: hints first, then plain night lore. */
export const FRAGMENTS: readonly { hint?: string; text: string }[] = [
  { hint: 'kagerou', text: 'The faceless one only follows those who never eat and never mend.' },
  { hint: 'kagerou', text: 'Hunger kept until the eighth hour opens a door with no face on it.' },
  { hint: 'ido', text: 'The well keeper waits where no lantern was ever lit.' },
  { hint: 'ido', text: 'Break the seal and the drowned will come. Outlast them.' },
  { hint: 'dawn_early', text: 'Some say the Mother can be laid to rest before the dawn bell.' },
  { text: 'Every lantern you carry was lit by someone who did not come home.' },
  { text: 'The crows count the living. Do not let them finish.' },
  { text: 'Paper burns. Salt remembers. Bells forgive nothing.' },
  { text: 'The long-necked ones lean in before they strike. Watch the lean.' },
  { text: 'Stone lanterns hold old prayers. Break them; the dead do not mind.' },
];
