// Opens an entity's dialog from the graph (graph plan): fetches the record
// and hands it to the same dialog the lists open.
import { useUI } from '../../contexts/UIContext';
import {
  peopleAPI, businessAPI, cryptoWalletsAPI, assetsAPI, propertiesAPI,
} from '../../utils/api';

const OPENERS = {
  person: [peopleAPI.getById, 'setSelectedPersonForDetail'],
  business: [businessAPI.getById, 'setSelectedBusinessForDetail'],
  crypto_wallet: [cryptoWalletsAPI.getById, 'setSelectedCryptoWalletForDetail'],
  asset: [assetsAPI.getById, 'setSelectedAssetForDetail'],
  property: [propertiesAPI.getById, 'setSelectedPropertyForDetail'],
};

export const canOpen = (type) => Boolean(OPENERS[type]);

export function useOpenEntity() {
  const ui = useUI();
  return (type, id) => {
    const opener = OPENERS[type];
    if (!opener || id == null) return;
    const [fetchOne, setter] = opener;
    fetchOne(id).then((record) => ui[setter]?.(record)).catch(() => {});
  };
}
