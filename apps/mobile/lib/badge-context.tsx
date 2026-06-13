import { createContext, useCallback, useContext, useState } from 'react';

interface BadgeContextValue {
  count: number;
  addBadge: () => void;
  clearBadge: () => void;
}

const BadgeContext = createContext<BadgeContextValue>({
  count: 0,
  addBadge: () => {},
  clearBadge: () => {},
});

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const addBadge   = useCallback(() => setCount(c => c + 1), []);
  const clearBadge = useCallback(() => setCount(0), []);
  return (
    <BadgeContext.Provider value={{ count, addBadge, clearBadge }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadge() {
  return useContext(BadgeContext);
}
