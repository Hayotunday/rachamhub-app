import { useEffect, useState } from "react";

/**
 * Returns a debounced version of `value` that only updates after
 * `delay` milliseconds of inactivity. Useful for deferring expensive
 * operations (e.g. filtering large lists) until the user stops typing.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
