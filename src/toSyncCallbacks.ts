import { computed, type Ref, type WritableComputedRef } from "vue";
import { flushTapSync } from "@assistant-ui/tap";

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
            return flushTapSync(() => (value as Function).apply(this, fnArgs));
          }
        : new Proxy(value, {
            get(target, key, receiver) {
              const prop = Reflect.get(target, key, receiver);
              return typeof prop === "function" ? withSyncFunctions(prop) : prop;
            },
          });
    syncCache.set(value, wrapped);
  }
  return wrapped as T;
};

export const toSyncCallbacks = <T>(source: Ref<T>): WritableComputedRef<T> =>
  computed({
    get: () => withSyncFunctions(source.value),
    set: (value) => {
      source.value = value;
    },
  });
