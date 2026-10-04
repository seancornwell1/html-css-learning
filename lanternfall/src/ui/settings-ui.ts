import type { EffectsQuality, Settings } from '../meta/save';

/** Pause-menu settings controls (GAME_DESIGN §7.4 accessibility). */
export function bindSettings(settings: Settings, onChange: (s: Settings) => void): void {
  const flash = document.getElementById('set-reduce-flash') as HTMLInputElement;
  const shake = document.getElementById('set-shake') as HTMLInputElement;
  const effects = document.getElementById('set-effects') as HTMLSelectElement;
  const vols = [
    ['set-vol-master', 'volMaster'],
    ['set-vol-music', 'volMusic'],
    ['set-vol-sfx', 'volSfx'],
  ] as const;
  for (const [id, key] of vols) {
    const input = document.getElementById(id) as HTMLInputElement;
    input.value = String(Math.round(settings[key] * 100));
    input.addEventListener('input', () => {
      settings[key] = Number(input.value) / 100;
      onChange(settings);
    });
  }
  const sync = (): void => {
    flash.checked = settings.reduceFlashing;
    shake.value = String(Math.round(settings.shake * 100));
    effects.value = settings.effects;
  };
  sync();
  flash.addEventListener('change', () => {
    settings.reduceFlashing = flash.checked;
    onChange(settings);
  });
  shake.addEventListener('input', () => {
    settings.shake = Number(shake.value) / 100;
    onChange(settings);
  });
  effects.addEventListener('change', () => {
    settings.effects = effects.value as EffectsQuality;
    onChange(settings);
    // The display may have fallen back to 'off'; reflect what is real.
    sync();
  });
}

/** First-launch photosensitivity notice. Resolves when acknowledged. */
export function showNotice(settings: Settings): Promise<void> {
  const root = document.getElementById('notice') as HTMLElement;
  const box = document.getElementById('notice-reduce-flash') as HTMLInputElement;
  const ok = document.getElementById('notice-ok') as HTMLButtonElement;
  box.checked = settings.reduceFlashing;
  root.hidden = false;
  ok.focus();
  return new Promise((resolve) => {
    ok.addEventListener(
      'click',
      () => {
        settings.reduceFlashing = box.checked;
        settings.noticeSeen = true;
        root.hidden = true;
        resolve();
      },
      { once: true },
    );
  });
}
