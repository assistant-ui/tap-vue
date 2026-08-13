import {
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef,
} from "vue";
import { createTapRoot, flushTapSync } from "@assistant-ui/tap";
import { useState } from "react";

// toValue treats any function as a getter
type ReactiveArg<T> = [T] extends [Function]
  ? Ref<T> | (() => T)
  : MaybeRefOrGetter<T>;

export type ReactiveArgs<Args extends unknown[]> = {
  [K in keyof Args]: ReactiveArg<Args[K]>;
};

export const toComposable = <Value, Args extends unknown[]>(
  hook: (...args: Args) => Value,
) => {
  return (...args: ReactiveArgs<Args>): ShallowRef<Value> => {
    const resolveArgs = () => args.map(toValue) as Args;

    const root = createTapRoot(
      () => {
        const [current, setArgs] = useState(resolveArgs);
        return { value: hook(...current), setArgs };
      },
      { mountOnSubscribe: true },
    );

    const { value: initialValue, setArgs } = root.getValue();
    const state = shallowRef(initialValue);

    if (typeof window !== "undefined") {
      const unsubscribe = root.subscribe(() => {
        state.value = root.getValue().value;
      });

      watch(resolveArgs, (next) => flushTapSync(() => setArgs(next)));

      onScopeDispose(unsubscribe);
    }

    return state;
  };
};
