import { expect, test } from "vitest";
import { computed, effectScope, isRef } from "vue";
import { toRefs } from "@vueuse/core";
import { useState } from "react";
import { toComposable } from "../src/toComposable";
import { toSyncCallbacks } from "../src/toSyncCallbacks";

const useCount = (initialValue: number) => {
  const [count, setCount] = useState(initialValue);
  const bump = () => setCount((c) => c + 1);
  return { count, bump };
};

test("VueUse toRefs: destructured value refs stay reactive", () => {
  const useVueCount = toComposable(useCount);
  const scope = effectScope();

  const { count, bump } = scope.run(() => toRefs(toSyncCallbacks(useVueCount(0))))!;

  expect(isRef(count)).toBe(true);
  expect(count.value).toBe(0);

  const doubled = computed(() => count.value * 2);
  expect(doubled.value).toBe(0);

  bump.value();
  expect(count.value).toBe(1);
  expect(doubled.value).toBe(2);
});

test("VueUse toRefs: function keys come out as refs, not plain functions", () => {
  const useVueCount = toComposable(useCount);
  const scope = effectScope();

  const { bump } = scope.run(() => toRefs(toSyncCallbacks(useVueCount(0))))!;

  // storeToRefs would pass `bump` through as a function; VueUse toRefs wraps
  // every key, so script usage needs `.value` (templates auto-unwrap).
  expect(isRef(bump)).toBe(true);
  expect(typeof bump.value).toBe("function");
});

test("VueUse toRefs: writing to a ref does not corrupt hook state", () => {
  const useVueCount = toComposable(useCount);
  const scope = effectScope();

  const state = scope.run(() => toSyncCallbacks(useVueCount(0)))!;
  const { count } = toRefs(state);

  // VueUse toRefs is two-way: a write replaces the snapshot object. The next
  // hook render must overwrite it again — hook state stays authoritative.
  count.value = 99;
  expect(state.value.count).toBe(99); // snapshot was clobbered...

  state.value.bump();
  expect(state.value.count).toBe(1); // ...but the hook re-render wins
  expect(count.value).toBe(1);
});
