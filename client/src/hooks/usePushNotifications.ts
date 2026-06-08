import { useEffect, useState } from 'react';
import * as pushService from '../services/pushService';

export interface PushState {
  supported: boolean;   // browser + server support push
  subscribed: boolean;  // this browser is currently subscribed
  loading: boolean;
  toggle: () => Promise<void>;
}

export function usePushNotifications(): PushState {
  const [supported,  setSupported]  = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sup = await pushService.isPushSupported();
      if (cancelled) return;
      setSupported(sup);
      if (sup) {
        const sub = await pushService.isSubscribed();
        if (!cancelled) setSubscribed(sub);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      if (subscribed) {
        await pushService.unsubscribe();
        setSubscribed(false);
      } else {
        const ok = await pushService.subscribe();
        setSubscribed(ok);
      }
    } finally {
      setLoading(false);
    }
  };

  return { supported, subscribed, loading, toggle };
}
