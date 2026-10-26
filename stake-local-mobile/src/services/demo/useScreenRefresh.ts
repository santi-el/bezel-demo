import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';
// Refresh current-state routing/deadlines without replacing the original loading UI.
export function useScreenRefresh(refresh: (silent?: boolean) => Promise<void>) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useFocusEffect(useCallback(() => {
    let busy = false;
    const update = async () => {
      if (busy || AppState.currentState !== 'active') return;
      busy = true;
      try {
        await latest.current(true);
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => void update(), 2000);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void update();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []));
}
