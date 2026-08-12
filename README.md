# tap-vue

Use React hooks in Vue. Hook runtime powered by [tap](https://github.com/assistant-ui/assistant-ui/tree/main/packages/tap).

## Install

```bash
npm install tap-vue
```

## Hooks as composables

`toComposable(hook)` turns a React hook into a Vue composable.

```ts
import { useEffect, useState } from "react";
import { toComposable } from "tap-vue";

const useCount = (initialValue: number) => {
  const [count, setCount] = useState(initialValue);
  const bump = () => setCount((c) => c + 1);
  return { count, bump };
};

const useVueCount = toComposable(useCount);
```

```vue
<script setup>
const counter = useVueCount(5); // ShallowRef<{ count, bump }>
</script>

<template>
  <button @click="counter.bump">{{ counter.count }}</button>
</template>
```

The hook mounts when the component's scope is created and unmounts (running effect cleanups) when the scope is disposed.

## Reactive args

```ts
const step = ref(1);
const counter = useVueStepCount(step);

step.value = 10; // hook re-renders with the new step
```

Args accept plain values, refs, and getters. When a reactive arg changes, the hook re-renders with the new value — its internal state is preserved, just like a React component receiving new props. Like props, arg changes are batched: mutations in the same tick produce a single re-render on the next tick.

## Destructuring

The composable returns a single `ShallowRef` snapshot, so plain destructuring loses reactivity. To destructure into individual refs, use [VueUse's `toRefs`](https://vueuse.org/shared/toRefs/):

```ts
import { toRefs } from "@vueuse/core";

const { count, bump } = toRefs(useVueCount(0));
count.value; // Ref<number>, stays reactive
bump.value(); // functions are wrapped too — call via .value in script
```

Templates auto-unwrap, so `{{ count }}` and `@click="bump"` work directly. Don't write to the refs — state is owned by the hook.

## Synchronous updates

Updates triggered through the hook's returned functions are synchronous, matching Vue's mutation semantics:

```ts
counter.value.bump();
counter.value.count; // already updated
```

Errors thrown by the hook during such a re-render throw at the call site. Updates from other sources (timers, subscriptions inside the hook) land on tap's async scheduler; use `flushTapSync` from `@assistant-ui/tap` if you need to force those synchronously.
