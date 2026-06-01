/*
 * Copyright © 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

const { createDebouncedScheduler } = require("../assets/js/render-scheduler");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function createFakeTimers() {
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(callback, delay) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    runAll() {
      const queued = [...timers.entries()];
      timers.clear();
      queued.forEach(([, timer]) => timer.callback());
    },
    count() {
      return timers.size;
    },
    lastDelay() {
      return [...timers.values()].at(-1)?.delay;
    },
  };
}

{
  const timers = createFakeTimers();
  let calls = 0;
  const scheduler = createDebouncedScheduler(() => {
    calls += 1;
  }, 150, timers);

  scheduler.schedule();
  scheduler.schedule();
  scheduler.schedule();

  assertEqual(calls, 0, "scheduled work should not run immediately");
  assertEqual(timers.count(), 1, "repeated scheduling should keep only one pending timer");
  assertEqual(timers.lastDelay(), 150, "scheduler should use the configured debounce delay");

  timers.runAll();

  assertEqual(calls, 1, "debounced work should run once after the delay");
}

{
  const timers = createFakeTimers();
  let calls = 0;
  const scheduler = createDebouncedScheduler(() => {
    calls += 1;
  }, 150, timers);

  scheduler.schedule();
  scheduler.flush();

  assertEqual(calls, 1, "flush should run pending work immediately");
  assertEqual(timers.count(), 0, "flush should clear the pending timer");
}

{
  const timers = createFakeTimers();
  let calls = 0;
  const scheduler = createDebouncedScheduler(() => {
    calls += 1;
  }, 150, timers);

  scheduler.schedule();
  scheduler.cancel();
  timers.runAll();

  assertEqual(calls, 0, "cancel should prevent pending work");
}

console.log("render scheduler tests passed");
