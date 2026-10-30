/**
 * Text-to-speech.
 *
 * Uses the browser SpeechSynthesis API only — never auto-starts, never sends
 * the text anywhere, and exposes an explicit stop/pause API so the message
 * toolbar can offer "read aloud" and "stop reading" as separate controls.
 */

export type TTSState = 'idle' | 'speaking' | 'paused';

type Listener = () => void;

let utterance: SpeechSynthesisUtterance | null = null;
let state: TTSState = 'idle';
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(next: TTSState) {
  if (state === next) return;
  state = next;
  emit();
}

export const tts = {
  get state() {
    return state;
  },
  subscribe(cb: Listener) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },
  voices(): SpeechSynthesisVoice[] {
    if (!this.supported()) return [];
    return window.speechSynthesis.getVoices();
  },
  speak(
    text: string,
    opts: { lang?: 'ar' | 'en'; voiceURI?: string; onEnd?: () => void } = {},
  ) {
    if (!this.supported() || !text.trim()) return false;
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text.slice(0, 12000));
    u.lang = opts.lang === 'ar' ? 'ar-SA' : 'en-US';
    if (opts.voiceURI) {
      const match = window.speechSynthesis.getVoices().find((v) => v.voiceURI === opts.voiceURI);
      if (match) u.voice = match;
    }
    u.rate = 1;
    u.pitch = 1;
    u.onstart = () => setState('speaking');
    u.onend = () => {
      utterance = null;
      setState('idle');
      opts.onEnd?.();
    };
    u.onerror = () => {
      utterance = null;
      setState('idle');
    };

    utterance = u;
    window.speechSynthesis.speak(u);
    setState('speaking');
    return true;
  },
  stop() {
    if (!this.supported()) return;
    window.speechSynthesis.cancel();
    utterance = null;
    setState('idle');
  },
  pause() {
    if (!this.supported() || state !== 'speaking') return;
    window.speechSynthesis.pause();
    setState('paused');
  },
  resume() {
    if (!this.supported() || state !== 'paused') return;
    window.speechSynthesis.resume();
    setState('speaking');
  },
  current() {
    return utterance;
  },
};

/** Extracts a plain, readable string from a message for TTS / export. */
export function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ') // skip code blocks
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>|-]{1,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
