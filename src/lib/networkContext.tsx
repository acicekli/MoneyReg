// ============================================================
// MoneyReg — Ağ durumu context'i
// NetInfo ile online/offline takibi
// ============================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

type NetworkContextValue = {
  isOnline: boolean;
  isInitialized: boolean;
};

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  isInitialized: false,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // İlk durum
    NetInfo.fetch().then((state) => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
      setIsInitialized(true);
    });

    // Değişiklikleri dinle
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline, isInitialized }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}
