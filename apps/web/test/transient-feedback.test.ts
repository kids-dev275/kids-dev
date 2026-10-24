import assert from "node:assert";
import {
  scheduleTransientFeedback,
  shouldAutoDismiss,
  browserClock,
  TRANSIENT_FEEDBACK_DURATION_MS,
  TRANSIENT_FEEDBACK_FADE_MS,
  type FeedbackClock,
} from "../src/lib/use-transient-feedback";

interface TestResult {
  name: string;
  passed: boolean;
  error?: unknown;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error });
    console.error(`  ✗ ${name}`);
    console.error(error);
  }
}

// Deterministic test clock helper
function createTestClock() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { at: number; callback: () => void }>();

  const clock: FeedbackClock = {
    setTimeout: (callback, delay) => {
      const id = nextId++;
      pending.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout: (timer) => {
      pending.delete(timer as number);
    },
  };

  const advance = (ms: number) => {
    const target = now + ms;
    while (true) {
      const due = [...pending.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!due || due[1].at > target) break;
      pending.delete(due[0]);
      now = due[1].at;
      due[1].callback();
    }
    now = target;
  };

  return { clock, advance, getPendingCount: () => pending.size, getNow: () => now };
}

async function runSuite() {
  console.log("Starting Kids Wear — Transient Feedback Unit Tests...\n");

  // 1. Success feedback appears and auto-dismiss classification
  await runTest("1. success feedback appears and is classified for auto-dismiss", () => {
    assert.strictEqual(shouldAutoDismiss("Added to cart"), true);
    assert.strictEqual(shouldAutoDismiss({ type: "success", message: "Added to cart" }), true);
    assert.strictEqual(shouldAutoDismiss({ type: "info", message: "Cart updated" }), true);

    // Actionable errors and warnings persist indefinitely
    assert.strictEqual(shouldAutoDismiss({ type: "error", message: "Quantity exceeded" }), false);
    assert.strictEqual(shouldAutoDismiss({ type: "warning", message: "Low stock" }), false);
    assert.strictEqual(shouldAutoDismiss(null), false);
    assert.strictEqual(shouldAutoDismiss(undefined), false);

    // Immediately upon scheduling, feedback is active and neither fade nor remove has fired
    const events: string[] = [];
    const testClock = createTestClock();
    scheduleTransientFeedback(
      () => events.push("fade"),
      () => events.push("remove"),
      testClock.clock
    );

    assert.deepStrictEqual(events, [], "Neither fade nor remove should have fired at t=0");
    assert.strictEqual(testClock.getPendingCount(), 2, "Both fade and remove timers should be scheduled");
  });

  // 2. Fade starts at the expected time (3200ms)
  await runTest("2. fade starts at the expected time (3200ms = 3500ms - 300ms)", () => {
    const events: string[] = [];
    const testClock = createTestClock();
    scheduleTransientFeedback(
      () => events.push("fade"),
      () => events.push("remove"),
      testClock.clock
    );

    const fadeTriggerTime = TRANSIENT_FEEDBACK_DURATION_MS - TRANSIENT_FEEDBACK_FADE_MS; // 3200ms
    assert.strictEqual(fadeTriggerTime, 3200);

    // Advance to 1ms before fade trigger
    testClock.advance(fadeTriggerTime - 1);
    assert.deepStrictEqual(events, [], "Fade must not trigger before 3200ms");

    // Advance 1ms to exact fade trigger
    testClock.advance(1);
    assert.deepStrictEqual(events, ["fade"], "Fade must trigger at exactly 3200ms");
  });

  // 3. Message disappears at 3500ms
  await runTest("3. message disappears at the expected duration (3500ms)", () => {
    const events: string[] = [];
    const testClock = createTestClock();
    scheduleTransientFeedback(
      () => events.push("fade"),
      () => events.push("remove"),
      testClock.clock
    );

    // Advance to 1ms before full duration
    testClock.advance(TRANSIENT_FEEDBACK_DURATION_MS - 1);
    assert.deepStrictEqual(events, ["fade"], "Remove must not trigger before 3500ms");

    // Advance 1ms to exact removal time
    testClock.advance(1);
    assert.deepStrictEqual(events, ["fade", "remove"], "Message must be removed at exactly 3500ms");
    assert.strictEqual(testClock.getPendingCount(), 0, "No pending timers remaining after full lifecycle");
  });

  // 4. Repeated feedback resets the timer
  await runTest("4. repeated feedback resets the timer", () => {
    const events: string[] = [];
    const testClock = createTestClock();

    // User adds item to cart at t=0
    let cancel = scheduleTransientFeedback(
      () => {
        events.push("action1-fade");
      },
      () => {
        events.push("action1-remove");
      },
      testClock.clock
    );

    // Advance 2000ms
    testClock.advance(2000);
    assert.strictEqual(events.length, 0);

    // User clicks Add to Cart again (cancels previous, starts new action)
    cancel();
    cancel = scheduleTransientFeedback(
      () => {
        events.push("action2-fade");
      },
      () => {
        events.push("action2-remove");
      },
      testClock.clock
    );

    // Advance 2000ms more (t=4000ms total, but 2000ms from action2)
    testClock.advance(2000);
    assert.strictEqual(events.length, 0, "Action 2 should reset timer; no fade should have fired yet");

    // Advance 1200ms more (reaches 3200ms from action 2)
    testClock.advance(1200);
    assert.deepStrictEqual(events, ["action2-fade"], "Action 2 fade triggers 3200ms after action 2");

    // Advance 300ms more (reaches 3500ms from action 2)
    testClock.advance(300);
    assert.deepStrictEqual(
      events,
      ["action2-fade", "action2-remove"],
      "Action 2 remove triggers 3500ms after action 2"
    );
  });

  // 5. Cleanup clears timers on unmount
  await runTest("5. cleanup clears all active timers on unmount", () => {
    const events: string[] = [];
    const testClock = createTestClock();

    const cleanup = scheduleTransientFeedback(
      () => events.push("fade"),
      () => events.push("remove"),
      testClock.clock
    );

    assert.strictEqual(testClock.getPendingCount(), 2, "Two timers active before cleanup");

    // Component unmounts at t=1000ms
    testClock.advance(1000);
    cleanup();

    assert.strictEqual(testClock.getPendingCount(), 0, "All timers cleared upon cleanup");

    // Advance well beyond original duration
    testClock.advance(10000);
    assert.deepStrictEqual(events, [], "No callbacks should fire after cleanup");
  });

  // 6. Default browser timer implementation does not throw Illegal invocation
  await runTest("6. default browser timer implementation does not throw Illegal invocation", () => {
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;

    try {
      // Create a strict mock window that simulates browser WebIDL receiver checks.
      // In Chrome/Safari/Firefox, window.setTimeout throws 'TypeError: Illegal invocation'
      // if 'this' is not the window object.
      let setTimeoutThisVerified = false;
      let clearTimeoutThisVerified = false;

      const mockWindow: {
        setTimeout: (callback: () => void, delay: number) => number;
        clearTimeout: (timerId: number) => void;
      } = {
        setTimeout: function (this: unknown, callback: () => void, delay: number): number {
          if (this !== mockWindow) {
            throw new TypeError("Illegal invocation: setTimeout called without window binding");
          }
          setTimeoutThisVerified = true;
          return 999;
        },
        clearTimeout: function (this: unknown, timerId: number): void {
          if (this !== mockWindow) {
            throw new TypeError("Illegal invocation: clearTimeout called without window binding");
          }
          clearTimeoutThisVerified = true;
        },
      };

      (globalThis as unknown as { window?: unknown }).window = mockWindow;

      // 1. Verify browserClock object direct methods call with correct window receiver
      assert.doesNotThrow(() => {
        const id = browserClock.setTimeout(() => {}, 100);
        assert.strictEqual(id, 999);
        assert.strictEqual(setTimeoutThisVerified, true, "setTimeout must be invoked with window as this");

        browserClock.clearTimeout(id);
        assert.strictEqual(clearTimeoutThisVerified, true, "clearTimeout must be invoked with window as this");
      }, "browserClock must not throw Illegal invocation in browser environment");

      // 2. Verify scheduleTransientFeedback with default parameter (clock = browserClock)
      setTimeoutThisVerified = false;
      clearTimeoutThisVerified = false;

      let cleanupFn: () => void = () => {};
      assert.doesNotThrow(() => {
        cleanupFn = scheduleTransientFeedback(
          () => {},
          () => {}
        );
      }, "scheduleTransientFeedback default clock must not throw Illegal invocation");

      assert.strictEqual(setTimeoutThisVerified, true, "scheduleTransientFeedback used window-bound setTimeout");

      assert.doesNotThrow(() => {
        cleanupFn();
      }, "cleanup function must not throw Illegal invocation");

      assert.strictEqual(clearTimeoutThisVerified, true, "cleanup used window-bound clearTimeout");
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as unknown as { window?: unknown }).window;
      } else {
        (globalThis as unknown as { window?: unknown }).window = originalWindow;
      }
    }

    // 3. Verify browserClock also works in Node / SSR environment without window
    assert.doesNotThrow(() => {
      const timer = browserClock.setTimeout(() => {}, 50);
      browserClock.clearTimeout(timer);
    }, "browserClock should work safely in SSR / non-window context");
  });

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n==================================================`);
  console.log(`Summary: ${passed}/${total} Transient Feedback Tests Passed.`);
  console.log(`==================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
