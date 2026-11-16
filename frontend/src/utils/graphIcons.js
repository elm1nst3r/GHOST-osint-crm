// Icons drawn inside graph nodes (graph plan, phase 1): the app's own lucide
// icons, turned into SVG data URIs because Cytoscape paints images, not
// React components. data: images are allowed by the CSP (img-src data:).
import { __iconData as user } from 'lucide-react/icons/user';
import { __iconData as building } from 'lucide-react/icons/building-complex';
import { __iconData as wallet } from 'lucide-react/icons/wallet';
import { __iconData as gem } from 'lucide-react/icons/gem';
import { __iconData as house } from 'lucide-react/icons/house';
import { __iconData as wifi } from 'lucide-react/icons/wifi';
import { __iconData as mail } from 'lucide-react/icons/mail';
import { __iconData as phone } from 'lucide-react/icons/phone';
import { __iconData as atSign } from 'lucide-react/icons/at-sign';
import { __iconData as globe } from 'lucide-react/icons/globe';
import { __iconData as link } from 'lucide-react/icons/link';
import { __iconData as network } from 'lucide-react/icons/network';
import { __iconData as fingerprint } from 'lucide-react/icons/fingerprint-pattern';

export const NODE_ICONS = {
  person: user, business: building, crypto_wallet: wallet, asset: gem,
  property: house, wireless_network: wifi, identifier: fingerprint,
};

export const IDENTIFIER_ICONS = {
  email: mail, phone, username: atSign, domain: globe, url: link, ip: network,
};

const escapeAttr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function nodeToSvg([tag, attrs, children = []]) {
  const a = Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('');
  return `<${tag}${a}>${children.map(nodeToSvg).join('')}</${tag}>`;
}

// An icon as an SVG data URI in the given stroke colour.
export function iconUri(icon, color) {
  const body = icon.node.map(nodeToSvg).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${escapeAttr(color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
