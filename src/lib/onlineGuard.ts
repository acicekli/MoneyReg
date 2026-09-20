// ============================================================
// MoneyReg — Online guard helper
// Offline'da belirli aksiyonları engeller + bilgi verir.
// ============================================================

import { useNetworkStatus } from './networkContext';
import { showAlert } from './alertHelper';

export function useOnlineGuard() {
  const { isOnline } = useNetworkStatus();

  /**
   * Aksiyonu çalıştır. Offline ise alert göster.
   */
  function guard(action: () => void, featureName?: string) {
    if (isOnline) {
      action();
    } else {
      showAlert(
        'İnternet gerekli',
        featureName
          ? `"${featureName}" için çevrimiçi olmalısın.`
          : 'Bu özellik için çevrimiçi olmalısın.'
      );
    }
  }

  return { isOnline, guard };
}
