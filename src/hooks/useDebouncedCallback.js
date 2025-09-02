import { useCallback, useRef } from 'react';

export default function useDebouncedCallback(fn, delay = 300) {
  const ref = useRef();
  return useCallback((...args) => {
    clearTimeout(ref.current);
    ref.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}
