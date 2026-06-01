/*
 * Copyright © 2026 Chaeseong Lim.
 * This software and its underlying algorithms may not be copied, modified, distributed, reverse engineered, or used to create derivative works without explicit written permission.
 */

function createDebouncedScheduler(callback, delay = 150, timers = globalThis) {
  let timerId = null;

  function clearPending() {
    if (timerId === null) return;
    timers.clearTimeout(timerId);
    timerId = null;
  }

  function run() {
    timerId = null;
    callback();
  }

  return {
    schedule() {
      clearPending();
      timerId = timers.setTimeout(run, delay);
    },
    flush() {
      if (timerId === null) return;
      clearPending();
      callback();
    },
    cancel: clearPending,
  };
}

const LeafSpineRenderScheduler = {
  createDebouncedScheduler,
};

if (typeof window !== "undefined") {
  window.LeafSpineRenderScheduler = LeafSpineRenderScheduler;
}

if (typeof module !== "undefined") {
  module.exports = LeafSpineRenderScheduler;
}
