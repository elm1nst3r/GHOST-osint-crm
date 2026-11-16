// "Show in graph" (graph plan, phase 4): the Entity Network section centred
// on one entity, at /relationships?focus=<type>:<id>. Closes whatever detail
// dialog is open first. Null when an admin switched the section off.
import { useNavigate } from 'react-router';
import { useUI } from '../contexts/UIContext';
import { useModules } from '../contexts/ModulesContext';

export const FOCUS_RE = /^(person|business|crypto_wallet|asset|property|wireless_network):\d+$/;
export const graphLink = (type, id) => `/relationships?focus=${type}:${id}`;

export function useShowInGraph() {
  const navigate = useNavigate();
  const ui = useUI();
  const { isOn } = useModules();
  if (!isOn('relationships')) return null;
  return (type, id) => {
    if (!FOCUS_RE.test(`${type}:${id}`)) return;
    ui.setSelectedPersonForDetail(null);
    ui.setSelectedBusinessForDetail(null);
    ui.setSelectedCryptoWalletForDetail(null);
    ui.setSelectedAssetForDetail(null);
    ui.setSelectedPropertyForDetail(null);
    ui.setSelectedTransactionForDetail(null);
    navigate(graphLink(type, id));
  };
}
