// Opens an entity's dialog or form from the graph (graph plan): fetches the
// record and hands it to the same dialog or form the lists use.
import { useUI } from '../../contexts/UIContext';
import {
  peopleAPI, businessAPI, cryptoWalletsAPI, assetsAPI, propertiesAPI,
} from '../../utils/api';

const FETCH = {
  person: peopleAPI.getById,
  business: businessAPI.getById,
  crypto_wallet: cryptoWalletsAPI.getById,
  asset: assetsAPI.getById,
  property: propertiesAPI.getById,
};
const DETAIL = {
  person: 'setSelectedPersonForDetail',
  business: 'setSelectedBusinessForDetail',
  crypto_wallet: 'setSelectedCryptoWalletForDetail',
  asset: 'setSelectedAssetForDetail',
  property: 'setSelectedPropertyForDetail',
};
const EDIT = {
  person: 'setEditingPerson',
  business: 'setEditingBusiness',
  crypto_wallet: 'setEditingCryptoWallet',
  asset: 'setEditingAsset',
  property: 'setEditingProperty',
};
const CREATE = {
  person: 'setShowAddPersonForm',
  business: 'setShowAddBusinessForm',
  crypto_wallet: 'setShowAddCryptoWalletForm',
};

export const canOpen = (type) => Boolean(FETCH[type]);
export const canEdit = (type) => Boolean(EDIT[type]);
export const CREATABLE = Object.keys(CREATE);

export function useOpenEntity() {
  const ui = useUI();
  return (type, id) => {
    if (!FETCH[type] || id == null) return;
    FETCH[type](id).then((record) => ui[DETAIL[type]]?.(record)).catch(() => {});
  };
}

// Edit and create forms, and whether one is open (the graph reloads when it
// closes, so a change shows at once).
export function useEntityForms() {
  const ui = useUI();
  const open = Boolean(
    ui.editingPerson || ui.showAddPersonForm || ui.editingBusiness || ui.showAddBusinessForm
    || ui.editingCryptoWallet || ui.showAddCryptoWalletForm || ui.editingAsset || ui.editingProperty,
  );
  return {
    open,
    edit: (type, id) => {
      if (!FETCH[type] || !EDIT[type] || id == null) return;
      FETCH[type](id).then((record) => ui[EDIT[type]]?.(record)).catch(() => {});
    },
    create: (type) => ui[CREATE[type]]?.(true),
  };
}
