const SOUND_PREFERENCE_KEY = 'frettrack.notice-sounds-enabled';
const PLAYED_NOTICE_KEY = 'frettrack.played-important-notices';
const MAX_PLAYED_NOTICES = 30;

export function getNoticeSoundsEnabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(SOUND_PREFERENCE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setNoticeSoundsEnabled(enabled, storage = globalThis.localStorage) {
  try {
    storage?.setItem(SOUND_PREFERENCE_KEY, enabled ? 'true' : 'false');
  } catch {
    // A blocked storage API must not interfere with notice visibility.
  }
}

export function getImportantNoticeFingerprint(notice) {
  return [
    notice?.status || '',
    notice?.noticeType || '',
    notice?.lastUpdatedAt || '',
    notice?.publicNoticeTitle || '',
    notice?.publicNoticeMessage || ''
  ].join('|');
}

export async function playImportantNoticeOnce(
  notice,
  {
    enabled = true,
    storage = globalThis.sessionStorage,
    playSound = playNoticeChime
  } = {}
) {
  if (!enabled || !notice?.publicNoticeTitle) {
    return false;
  }

  const fingerprint = getImportantNoticeFingerprint(notice);
  let played = [];
  try {
    played = JSON.parse(storage?.getItem(PLAYED_NOTICE_KEY) || '[]');
  } catch {
    played = [];
  }

  if (played.includes(fingerprint)) {
    return false;
  }

  try {
    await playSound(notice.noticeType);
  } catch {
    // Autoplay rejection and unavailable audio are intentionally non-fatal.
  }

  try {
    storage?.setItem(
      PLAYED_NOTICE_KEY,
      JSON.stringify([...played, fingerprint].slice(-MAX_PLAYED_NOTICES))
    );
  } catch {
    // Notice rendering remains authoritative if session storage is unavailable.
  }
  return true;
}

export async function playNoticeChime(noticeType = 'warning') {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  try {
    if (context.state === 'suspended') {
      await context.resume();
    }
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
    gain.connect(context.destination);

    const frequencies = noticeType === 'recovery' ? [523.25, 659.25] : [440, 349.23];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + (index * 0.12));
      oscillator.stop(context.currentTime + 0.28 + (index * 0.12));
    });
    await new Promise((resolve) => globalThis.setTimeout(resolve, 470));
  } finally {
    await context.close().catch(() => {});
  }
}
