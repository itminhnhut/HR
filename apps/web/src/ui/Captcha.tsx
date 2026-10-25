import { useCallback, useEffect, useRef, useState } from 'react';
import { FieldError } from './Field';

/** Cloudflare Turnstile site key; without it the widget is not shown (and the BE has no secret either). */
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';
export const captchaEnabled = !!SITE_KEY;

/** How long a submit waits for the background check before telling the visitor what to do. */
const WAIT_MS = 15_000;

const LOAD_FAILED = 'Không tải được bước chống spam. Kiểm tra mạng rồi bấm "Thử lại".';
const NEEDS_CLICK = 'Bấm vào ô "Xác minh bạn là con người" bên dưới rồi gửi lại.';
const TOO_SLOW = 'Bước chống spam chưa xong. Đợi vài giây rồi bấm lại.';

interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;
function loadTurnstile(): Promise<Turnstile> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing')));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('Could not load Turnstile'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** A submit could not get a token; `message` tells the visitor what to do. */
export class CaptchaError extends Error {}

interface Waiter {
  resolve: (token: string) => void;
  reject: (error: CaptchaError) => void;
}

export interface CaptchaControl {
  /** Resolves with a token, waiting for the background check if it is still running. '' when CAPTCHA is off. */
  getToken: () => Promise<string>;
  /** Each token works once: call after every submit so the next one gets a fresh token. */
  renew: () => void;
  box: (el: HTMLDivElement | null) => void;
  failed: boolean;
  retry: () => void;
}

/**
 * "Tôi không phải robot" (Cloudflare Turnstile, free). Runs in the background; the box only shows when
 * Cloudflare wants a click. A submit made before the check finishes waits for it instead of failing.
 */
export function useCaptcha(): CaptchaControl {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const token = useRef('');
  // Cloudflare is showing the box and waits for a click: a submit cannot get a token by waiting.
  const needsClick = useRef(false);
  const waiters = useRef<Waiter[]>([]);
  const widget = useRef<{ ts: Turnstile; id: string } | null>(null);

  const settle = (fn: (w: Waiter) => void) => {
    const list = waiters.current;
    waiters.current = [];
    list.forEach(fn);
  };

  useEffect(() => {
    if (!captchaEnabled || !el) return;
    let cancelled = false;
    loadTurnstile()
      .then((ts) => {
        if (cancelled) return;
        const id = ts.render(el, {
          sitekey: SITE_KEY,
          language: 'vi',
          theme: 'light',
          appearance: 'interaction-only',
          size: 'flexible',
          callback: (t: string) => {
            needsClick.current = false;
            token.current = t;
            settle((w) => w.resolve(t));
          },
          'expired-callback': () => (token.current = ''),
          // The box is now visible: a waiting submit tells the visitor to click it.
          'before-interactive-callback': () => {
            needsClick.current = true;
            settle((w) => w.reject(new CaptchaError(NEEDS_CLICK)));
          },
          'error-callback': () => {
            token.current = '';
            settle((w) => w.reject(new CaptchaError(TOO_SLOW)));
          },
        });
        widget.current = { ts, id };
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.warn('CAPTCHA could not load', e);
        setFailed(true);
        settle((w) => w.reject(new CaptchaError(LOAD_FAILED)));
      });
    return () => {
      cancelled = true;
      widget.current?.ts.remove(widget.current.id);
      widget.current = null;
    };
  }, [el, attempt]);

  const getToken = useCallback((): Promise<string> => {
    if (!captchaEnabled || token.current) return Promise.resolve(token.current);
    if (failed) return Promise.reject(new CaptchaError(LOAD_FAILED));
    if (needsClick.current) return Promise.reject(new CaptchaError(NEEDS_CLICK));
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters.current = waiters.current.filter((w) => w !== waiter);
        reject(new CaptchaError(TOO_SLOW));
      }, WAIT_MS);
      const waiter: Waiter = {
        resolve: (t) => (clearTimeout(timer), resolve(t)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      };
      waiters.current = [...waiters.current, waiter];
    });
  }, [failed]);

  const renew = useCallback(() => {
    token.current = '';
    if (widget.current) widget.current.ts.reset(widget.current.id);
  }, []);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  return { getToken, renew, box: setEl, failed, retry };
}

/** Where the box appears when Cloudflare asks for a click, plus a retry when the check could not load. */
export function Captcha({ control, error }: { control: CaptchaControl; error?: string }) {
  if (!captchaEnabled) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div ref={control.box} className="empty:hidden" />
      {control.failed && (
        <span className="flex flex-wrap items-center gap-2 text-sm text-error">
          {LOAD_FAILED}
          <button
            type="button"
            onClick={control.retry}
            className="min-h-9 border-0 bg-transparent p-0 font-medium text-link underline"
          >
            Thử lại
          </button>
        </span>
      )}
      <FieldError>{error}</FieldError>
    </div>
  );
}
