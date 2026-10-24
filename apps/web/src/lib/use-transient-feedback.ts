"use client";

import { useCallback, useEffect, useState } from "react";

export const TRANSIENT_FEEDBACK_DURATION_MS = 3500;
export const TRANSIENT_FEEDBACK_FADE_MS = 300;

export type FeedbackTimerId = ReturnType<typeof setTimeout> | number;

export interface FeedbackClock {
  setTimeout: (callback: () => void, delay: number) => FeedbackTimerId;
  clearTimeout: (timer: FeedbackTimerId) => void;
}

export const browserClock: FeedbackClock = {
  setTimeout: (callback, delay) => {
    if (typeof window !== "undefined") {
      return window.setTimeout(callback, delay);
    }
    return setTimeout(callback, delay);
  },
  clearTimeout: (timerId) => {
    if (typeof window !== "undefined") {
      window.clearTimeout(timerId as number);
    } else {
      clearTimeout(timerId as unknown as ReturnType<typeof setTimeout>);
    }
  },
};

export function scheduleTransientFeedback(
  onFade: () => void,
  onRemove: () => void,
  clock: FeedbackClock = browserClock
) {
  const fadeTimer = clock.setTimeout(
    onFade,
    TRANSIENT_FEEDBACK_DURATION_MS - TRANSIENT_FEEDBACK_FADE_MS
  );
  const removeTimer = clock.setTimeout(onRemove, TRANSIENT_FEEDBACK_DURATION_MS);
  return () => {
    clock.clearTimeout(fadeTimer);
    clock.clearTimeout(removeTimer);
  };
}

export function shouldAutoDismiss(value: unknown): boolean {
  if (typeof value === "string") return true;
  if (value && typeof value === "object" && "type" in value) {
    return value.type === "success" || value.type === "info";
  }
  return false;
}

export function useTransientFeedback<T>() {
  const [value, setValueState] = useState<T | null>(null);
  const [revision, setRevision] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const setValue = useCallback((next: T | null) => {
    setValueState(next);
    setRevision((previous) => previous + 1);
    setIsFading(false);
  }, []);

  useEffect(() => {
    if (value === null || !shouldAutoDismiss(value)) return;
    return scheduleTransientFeedback(() => setIsFading(true), () => setValueState(null));
  }, [value, revision]);

  return [value, setValue, isFading] as const;
}
