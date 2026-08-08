// File: frontend/src/utils/edgeLayers.js
//
// Relationship *layers* for the entity network (issue #65).
//
// The graph used to lump everything into three buckets — people connections,
// ownership, transactions — which made the interesting question hard to ask.
// zbyte64's use case is conflict-of-interest mapping: a person sits on the
// board of a council, has a private interest in a business, and the council
// does business with that business. Reading that off the graph means being able
// to show governance and financial ties on their own and let everything else
// drop away. Hence named layers that can be toggled independently, or soloed.
//
// Every edge type must map to exactly one layer; unknown types fall to `other`
// so a user-created connection type can never be silently invisible.

export const EDGE_LAYERS = ['governance', 'employment', 'financial', 'social', 'investigative', 'other'];

const TYPES_BY_LAYER = {
  // Who controls the entity: ownership (person→business and business→business)
  // and board seats / decision-making roles.
  governance: ['owner', 'owns_business', 'board_member'],
  employment: ['employer', 'employee'],
  // "Broadly an exchange of value or gifts" — includes endorsements, not just
  // cash, per zbyte64's newspaper-endorsement example.
  financial: ['transaction'],
  social: ['family', 'friend', 'associate', 'enemy'],
  investigative: ['suspect', 'witness', 'victim'],
  other: ['other'],
};

const LAYER_BY_TYPE = Object.entries(TYPES_BY_LAYER).reduce((acc, [layer, types]) => {
  types.forEach((type) => { acc[type] = layer; });
  return acc;
}, {});

export const layerForType = (type) => LAYER_BY_TYPE[type] || 'other';

export const typesInLayer = (layer) => TYPES_BY_LAYER[layer] || [];

export const DEFAULT_EDGE_LAYERS = {
  governance: true,
  employment: true,
  financial: false, // off by default: transaction edges are dense and aggregate
  social: true,
  investigative: true,
  other: true,
};

// Is this edge type currently drawn? `solo` (a layer name or null) overrides the
// toggles entirely, so "show me governance only" is one click rather than five.
export const isTypeVisible = (type, layers = DEFAULT_EDGE_LAYERS, solo = null) => {
  const layer = layerForType(type);
  if (solo) return layer === solo;
  return layers[layer] !== false;
};
