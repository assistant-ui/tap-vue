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

    const syncCache = new WeakMap<object, object>();
    const withSyncFunctions = <T>(value: T): T => {
      if (
        value === null ||
        (typeof value !== "object" && typeof value !== "function")
      )
        return value;
      let wrapped = syncCache.get(value);
      if (!wrapped) {
        wrapped =
          typeof value === "function"
            ? function (this: unknown, ...fnArgs: unknown[]) {
                return flushTapSync(() =>
                  (value as Function).apply(this, fnArgs),
                );
              }
            : new Proxy(value, {
                get(target, key, receiver) {
                  const prop = Reflect.get(target, key, receiver);
                  return typeof prop === "function"
                    ? withSyncFunctions(prop)
                    : prop;
                },
              });
        syncCache.set(value, wrapped);
      }
      return wrapped as T;
    };

    const root = createTapRoot(
      () => {
        const [current, setArgs] = useState(resolveArgs);
        return { value: hook(...current), setArgs };
      },
      { mountOnSubscribe: true },
    );

    const { value: initialValue, setArgs } = root.getValue();
    const state = shallowRef(withSyncFunctions(initialValue));

    if (typeof window !== "undefined") {
      const unsubscribe = root.subscribe(() => {
        state.value = withSyncFunctions(root.getValue().value);
      });

      watch(resolveArgs, withSyncFunctions(setArgs));

      onScopeDispose(unsubscribe);
    }

    return state;
  };
};
