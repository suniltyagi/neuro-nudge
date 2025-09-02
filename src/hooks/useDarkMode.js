import { useEffect, useState } from 'react';

export default function useDarkMode() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  return [dark, setDark];
}
