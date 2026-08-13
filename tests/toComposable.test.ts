import { afterEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useEffect, useState } from "react";
import { flushTapSync } from "@assistant-ui/tap";
import { toComposable } from "../src/toComposable";
import { toSyncCallbacks } from "../src/toSyncCallbacks";

const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const useCount = (initialValue: number) => {
  const [count, setCount] = useState(initialValue);
  const bump = () => setCount((c) => c + 1);
  return { count, bump };
};

test("method calls land on the async scheduler by default", async () => {
  const useVueCount = toComposable(useCount);
  const scope = effectScope();

  const state = scope.run(() => useVueCount(5))!;
  expect(state.value.count).toBe(5);

  state.value.bump();
  expect(state.value.count).toBe(5); // not yet flushed
  await flush();
  expect(state.value.count).toBe(6);
});

test("toSyncCallbacks: method calls update state synchronously", () => {
  const useVueCount = toComposable(useCount);
  const scope = effectScope();

  const state = scope.run(() => toSyncCallbacks(useVueCount(5)))!;
  expect(state.value.count).toBe(5);

  state.value.bump();
  expect(state.value.count).toBe(6);
});

test("toSyncCallbacks: method identity is stable across reads", () => {
  const useVueCount = toComposable(useCount);
  const scope = effectScope();

  const state = scope.run(() => toSyncCallbacks(useVueCount(0)))!;
  expect(state.value.bump).toBe(state.value.bump);
});

test("instances are isolated", () => {
  const useVueCount = toComposable(useCount);
  const scopeA = effectScope();
  const scopeB = effectScope();

  const a = scopeA.run(() => toSyncCallbacks(useVueCount(0)))!;
  const b = scopeB.run(() => toSyncCallbacks(useVueCount(10)))!;

  a.value.bump();

  expect(a.value.count).toBe(1);
  expect(b.value.count).toBe(10);
});

test("reactive args re-render the hook, state survives", async () => {
  const useStepCount = (step: number) => {
    const [count, setCount] = useState(0);
    return { step, count, bump: () => setCount((c) => c + step) };
  };
  const useVueStepCount = toComposable(useStepCount);

  const step = ref(1);
  const scope = effectScope();
  const state = scope.run(() => toSyncCallbacks(useVueStepCount(step)))!;

  state.value.bump();
  expect(state.value.count).toBe(1);

  step.value = 10;
  await nextTick();
  expect(state.value.step).toBe(10);
  expect(state.value.count).toBe(1);

  state.value.bump();
  expect(state.value.count).toBe(11);
});

test("getter args are reactive", async () => {
  const useStep = (step: number) => step;
  const useVueStep = toComposable(useStep);

  const step = ref(2);
  const scope = effectScope();
  const state = scope.run(() => useVueStep(() => step.value * 10))!;
  expect(state.value).toBe(20);

  step.value = 3;
  await nextTick();
  expect(state.value).toBe(30);
});

test("same-tick arg mutations batch into one render, no torn pairs", async () => {
  const rendered: [number, number][] = [];
  const usePair = (a: number, b: number) => {
    rendered.push([a, b]);
    return a + b;
  };
  const useVuePair = toComposable(usePair);

  const a = ref(1);
  const b = ref(2);
  const scope = effectScope();
  const state = scope.run(() => useVuePair(a, b))!;
  expect(rendered).toEqual([[1, 2]]);

  a.value = 10;
  b.value = 20;
  await nextTick();

  expect(state.value).toBe(30);
  expect(rendered).toEqual([
    [1, 2],
    [10, 20], // never [10, 2]
  ]);
});

test("function args must be wrapped in a getter", () => {
  const useCallbackRunner = (callback: () => string) => callback();
  const useVueRunner = toComposable(useCallbackRunner);

  const callback = () => "hello";
  const scope = effectScope();

  // @ts-expect-error bare functions are ambiguous with getters and rejected
  useVueRunner satisfies (cb: () => string) => unknown;

  const state = scope.run(() => useVueRunner(() => callback))!;
  expect(state.value).toBe("hello");
});

test("lifecycle follows the component scope", async () => {
  const log: string[] = [];
  const useLogger = () => {
    useEffect(() => {
      log.push("mount");
      return () => {
        log.push("unmount");
      };
    }, []);
    return null;
  };
  const useVueLogger = toComposable(useLogger);

  const scope = effectScope();
  scope.run(() => useVueLogger());
  await flush();
  expect(log).toEqual(["mount"]);

  scope.stop();
  await flush();
  expect(log).toEqual(["mount", "unmount"]);
});

test("SSR: renders a snapshot without mounting effects", () => {
  vi.stubGlobal("window", undefined);

  const log: string[] = [];
  const useLoggedCount = () => {
    useEffect(() => {
      log.push("mount");
    }, []);
    return useState(7)[0];
  };
  const useVueCount = toComposable(useLoggedCount);

  const scope = effectScope();
  const state = scope.run(() => useVueCount())!;

  expect(state.value).toBe(7);
  flushTapSync(() => {});
  expect(log).toEqual([]);
});

test("toSyncCallbacks: errors during re-render throw at the method call site", () => {
  const useBomb = () => {
    const [count, setCount] = useState(0);
    if (count === 1) throw new Error("boom");
    return { count, bump: () => setCount((c) => c + 1) };
  };
  const useVueBomb = toComposable(useBomb);

  const scope = effectScope();
  const state = scope.run(() => toSyncCallbacks(useVueBomb()))!;

  expect(() => state.value.bump()).toThrow("boom");
});
