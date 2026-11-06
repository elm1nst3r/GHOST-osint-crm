// Builds middle-earth.json, GHOST's standard test data set: a Lord of the
// Rings themed investigation with 22 people, their relationships, places,
// travel, businesses, properties, assets, transactions, wireless networks,
// OSINT data, saved integration records and to-dos.
//
//   node test-data/build-middle-earth.mjs
//
// Import it in GHOST under Settings → Import / Export, into an empty project.
// Coordinates are New Zealand filming locations, so the map shows real
// places. Phone numbers use the reserved 555-01xx range and addresses the
// reserved .example domain; nothing here belongs to a real person.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const THIS_YEAR = 2026;
const dob = (age, monthDay = '09-22') => (age ? `${THIS_YEAR - age}-${monthDay}` : null);

// ── Places (real coordinates of the filming locations) ──────────────────────
const P = {
  bagEnd: { label: 'Bag End', address: 'Bag End, Bagshot Row', city: 'Hobbiton', country: 'The Shire', latitude: -37.8721, longitude: 175.6829 },
  bywater: { label: 'The Green Dragon', address: 'The Green Dragon, Bywater Road', city: 'Bywater', country: 'The Shire', latitude: -37.8706, longitude: 175.6837 },
  brandyHall: { label: 'Brandy Hall', address: 'Brandy Hall', city: 'Buckland', country: 'The Shire', latitude: -37.8735, longitude: 175.6801 },
  tuckborough: { label: 'Great Smials', address: 'Great Smials', city: 'Tuckborough', country: 'The Shire', latitude: -37.8749, longitude: 175.6862 },
  bree: { label: 'The Prancing Pony', address: 'The Prancing Pony, Great East Road', city: 'Bree', country: 'Eriador', latitude: -41.3271, longitude: 174.8298 },
  rivendell: { label: 'Rivendell', address: 'The Last Homely House', city: 'Rivendell', country: 'Eriador', latitude: -41.0852, longitude: 175.1793 },
  moria: { label: 'Moria (West-gate)', address: 'Doors of Durin', city: 'Moria', country: 'Misty Mountains', latitude: -39.2817, longitude: 175.5685 },
  lorien: { label: 'Caras Galadhon', address: 'Caras Galadhon', city: 'Lothlórien', country: 'Lórien', latitude: -44.7920, longitude: 168.3706 },
  argonath: { label: 'The Argonath', address: 'Gates of Argonath, Anduin', city: 'Anduin', country: 'Rhovanion', latitude: -45.0187, longitude: 168.8710 },
  isengard: { label: 'Orthanc', address: 'Tower of Orthanc, Ring of Isengard', city: 'Isengard', country: 'Rohan (Nan Curunír)', latitude: -41.1248, longitude: 175.0812 },
  edoras: { label: 'Meduseld', address: 'Meduseld, Edoras', city: 'Edoras', country: 'Rohan', latitude: -43.6127, longitude: 171.1625 },
  helmsDeep: { label: "Helm's Deep", address: 'The Hornburg', city: "Helm's Deep", country: 'Rohan', latitude: -41.1985, longitude: 174.9321 },
  fangorn: { label: 'Fangorn Forest', address: 'Edge of Fangorn', city: 'Fangorn', country: 'Rohan', latitude: -45.3036, longitude: 168.1709 },
  ithilien: { label: 'Henneth Annûn', address: 'Window on the West, Ithilien', city: 'Ithilien', country: 'Gondor', latitude: -45.4144, longitude: 167.7163 },
  minasTirith: { label: 'Minas Tirith', address: 'The Citadel, Seventh Circle', city: 'Minas Tirith', country: 'Gondor', latitude: -41.2014, longitude: 174.9406 },
  emynMuil: { label: 'Emyn Muil', address: 'Emyn Muil', city: 'Emyn Muil', country: 'Rhovanion', latitude: -39.2000, longitude: 175.5400 },
  mountDoom: { label: 'Mount Doom', address: 'Sammath Naur, Orodruin', city: 'Gorgoroth', country: 'Mordor', latitude: -39.1569, longitude: 175.6321 },
  baradDur: { label: 'Barad-dûr', address: 'Barad-dûr', city: 'Gorgoroth', country: 'Mordor', latitude: -39.2333, longitude: 175.7167 },
  mirkwood: { label: 'Thranduil’s Halls', address: 'Elvenking’s Halls', city: 'Northern Mirkwood', country: 'Mirkwood', latitude: -41.2245, longitude: 175.4570 },
  erebor: { label: 'Erebor', address: 'The Lonely Mountain', city: 'Erebor', country: 'Rhovanion', latitude: -40.0, longitude: 176.0 },
};
const loc = (place, type, notes) => ({ type, ...P[place], ...(notes ? { notes } : {}) });

// ── Cases ───────────────────────────────────────────────────────────────────
const cases = [
  { id: 1, case_name: 'The One Ring', status: 'active', description: 'Track the Ring and everyone who has held it, from Bag End to Mordor.' },
  { id: 2, case_name: 'Isengard Industries', status: 'active', description: 'Saruman’s operation at Isengard: deforestation of Fangorn, arms production, agents in Rohan and the Shire.' },
  { id: 3, case_name: 'The Fellowship', status: 'active', description: 'The nine walkers who left Rivendell: movements, contacts, losses.' },
  { id: 4, case_name: 'Scouring of the Shire', status: 'on_hold', description: 'Property buy-ups and ruffians in the Shire, financed from outside.' },
];

// ── People ──────────────────────────────────────────────────────────────────
// [id, first, patronymic, last, aliases, age, category, status, case, notes]
const peopleRows = [
  [1, 'Frodo', null, 'Baggins', ['Mr. Underhill'], 50, 'Person of Interest', 'Being Investigated', 1, 'Current Ring-bearer. Inherited Bag End and the Ring from Bilbo.'],
  [2, 'Samwise', null, 'Gamgee', ['Sam'], 38, 'Witness', 'Open', 1, 'Gardener at Bag End; with Frodo the whole way. Most reliable account of the journey.'],
  [3, 'Bilbo', null, 'Baggins', ['Mad Baggins'], 111, 'Person of Interest', 'Closed', 1, 'Held the Ring for sixty years. Left the Shire after his birthday party; now in Rivendell.'],
  [4, 'Sméagol', null, null, ['Gollum', 'Stinker', 'Slinker'], null, 'Suspect', 'Being Investigated', 1, 'Held the Ring for centuries. Escaped custody in Mirkwood. Follows the Ring-bearer.'],
  [5, 'Sauron', null, null, ['The Necromancer', 'Annatar', 'The Dark Lord', 'The Eye'], null, 'Suspect', 'Open', 1, 'Maker of the Ring. Location believed to be Barad-dûr; never seen in person.'],
  [6, 'Faramir', 'son of Denethor', null, ['Captain of Gondor'], 36, 'Witness', 'Open', 1, 'Met Frodo and Sam in Ithilien and let them go on.'],
  [7, 'Gandalf', null, null, ['Mithrandir', 'Gandalf the Grey', 'Gandalf the White', 'Olórin', 'Greyhame'], null, 'Client', 'Open', 3, 'Commissioned this investigation. Comes and goes without notice.'],
  [8, 'Aragorn', 'son of Arathorn', null, ['Strider', 'Elessar', 'Thorongil'], 87, 'Person of Interest', 'Open', 3, 'Ranger met at Bree; heir of Isildur. Led the Fellowship after Moria.'],
  [9, 'Legolas', null, 'Greenleaf', [], null, 'Witness', 'Open', 3, 'Elf of Mirkwood, son of Thranduil.'],
  [10, 'Gimli', 'son of Glóin', null, ['Elf-friend'], 139, 'Witness', 'Open', 3, 'Dwarf of Erebor.'],
  [11, 'Boromir', 'son of Denethor', null, [], 41, 'Victim', 'Closed', 3, 'Killed at Amon Hen defending Merry and Pippin. Had tried to take the Ring.'],
  [12, 'Meriadoc', null, 'Brandybuck', ['Merry'], 36, 'Witness', 'Open', 3, 'Taken by Uruk-hai at Amon Hen with Pippin; escaped into Fangorn.'],
  [13, 'Peregrin', null, 'Took', ['Pippin'], 28, 'Witness', 'Open', 3, 'Looked into the palantír of Orthanc.'],
  [14, 'Saruman', null, null, ['Saruman the White', 'Curunír', 'Sharkey'], null, 'Suspect', 'Being Investigated', 2, 'Head of the White Council turned to Sauron. Runs Isengard Industries; later seen in the Shire as "Sharkey".'],
  [15, 'Gríma', 'son of Gálmód', null, ['Wormtongue'], 52, 'Suspect', 'Being Investigated', 2, 'Adviser to Théoden, in Saruman’s pay.'],
  [16, 'Théoden', 'son of Thengel', null, ['King of Rohan'], 71, 'Victim', 'Open', 2, 'Kept in a stupor by Gríma’s counsel until Gandalf’s visit.'],
  [17, 'Éowyn', null, null, ['Dernhelm', 'Shieldmaiden of Rohan'], 24, 'Witness', 'Open', 2, 'Niece of Théoden. Rode to the Pelennor in disguise.'],
  [18, 'Lotho', null, 'Sackville-Baggins', ['Pimple', 'The Chief'], 44, 'Suspect', 'On Hold', 4, 'Bought up farms, mills and Bag End; brought in ruffians. Money traced to Isengard.'],
  [19, 'Bill', null, 'Ferny', [], 47, 'Suspect', 'Open', 4, 'Bree local; informant for the Black Riders. Sold a half-starved pony to Butterbur.'],
  [20, 'Barliman', null, 'Butterbur', [], 58, 'Witness', 'Open', 4, 'Landlord of the Prancing Pony. Forgot to send Gandalf’s letter.'],
  [21, 'Elrond', null, null, ['Lord of Rivendell', 'Half-elven'], null, 'Other', 'Open', null, 'Hosted the Council at Rivendell. No case assigned.'],
  [22, 'Galadriel', null, null, ['Lady of Lórien', 'Lady of the Golden Wood'], null, 'Other', 'Open', null, 'Received the Fellowship in Lothlórien. No case assigned.'],
];

// Ties: [from, to, type, note]. Stored on the first person.
const ties = [
  [3, 1, 'family', 'Cousin and adoptive heir'],
  [2, 1, 'employee', 'Gardener at Bag End'],
  [4, 3, 'enemy', 'Lost the Ring to Bilbo in the Misty Mountains'],
  [4, 1, 'suspect', 'Guide into Mordor; tracked the Ring-bearer from Moria'],
  [5, 4, 'associate', 'Held and questioned in Mordor, then released'],
  [7, 1, 'friend', 'Sent him on the journey'],
  [7, 3, 'friend'],
  [7, 14, 'enemy', 'Held prisoner on Orthanc'],
  [8, 1, 'friend', 'Guide from Bree'],
  [8, 7, 'associate'],
  [9, 10, 'friend', 'Started as a rivalry'],
  [11, 6, 'family', 'Brothers'],
  [11, 8, 'associate'],
  [12, 13, 'family', 'Cousins'],
  [12, 1, 'family', 'Cousin'],
  [13, 1, 'family', 'Cousin'],
  [14, 5, 'associate', 'Communicated by palantír'],
  [15, 14, 'employee', 'Informant at Edoras'],
  [15, 16, 'associate', 'Chief counsellor'],
  [17, 16, 'family', 'Niece'],
  [18, 14, 'associate', 'Financed and supplied by Isengard'],
  [18, 1, 'family', 'Cousin; bought Bag End'],
  [19, 5, 'associate', 'Passed information to the Black Riders'],
  [19, 14, 'associate', 'Later one of Sharkey’s men in the Shire'],
  [20, 7, 'friend'],
  [20, 19, 'enemy'],
  [21, 3, 'friend', 'Host in Rivendell'],
  [21, 8, 'family', 'Foster father'],
  [22, 1, 'associate', 'Gave him the phial'],
  [8, 6, 'associate'],
];

const locations = {
  1: [loc('bagEnd', 'primary_residence'), loc('rivendell', 'other', 'Recovered here after the attack at Weathertop')],
  2: [loc('bagEnd', 'work'), loc('bagEnd', 'primary_residence', 'Bagshot Row, No. 3')],
  3: [loc('rivendell', 'primary_residence'), loc('bagEnd', 'other', 'Former home')],
  4: [loc('emynMuil', 'other', 'Last confirmed sighting'), loc('mirkwood', 'other', 'Held in custody; escaped')],
  5: [loc('baradDur', 'primary_residence')],
  6: [loc('ithilien', 'work'), loc('minasTirith', 'primary_residence')],
  7: [loc('rivendell', 'other'), loc('bagEnd', 'favorite_hotel', 'Frequent guest')],
  8: [loc('bree', 'favorite_hotel'), loc('minasTirith', 'primary_residence')],
  9: [loc('mirkwood', 'primary_residence')],
  10: [loc('erebor', 'primary_residence'), loc('helmsDeep', 'other')],
  11: [loc('minasTirith', 'primary_residence'), loc('argonath', 'other', 'Last seen near Amon Hen')],
  12: [loc('brandyHall', 'primary_residence'), loc('fangorn', 'other')],
  13: [loc('tuckborough', 'primary_residence'), loc('minasTirith', 'other')],
  14: [loc('isengard', 'primary_residence'), loc('bagEnd', 'other', 'Occupied as "Sharkey"')],
  15: [loc('edoras', 'work'), loc('isengard', 'other')],
  16: [loc('edoras', 'primary_residence'), loc('helmsDeep', 'other')],
  17: [loc('edoras', 'primary_residence')],
  18: [loc('bagEnd', 'primary_residence', 'Moved in after the sale')],
  19: [loc('bree', 'primary_residence')],
  20: [loc('bree', 'work'), loc('bree', 'primary_residence')],
  21: [loc('rivendell', 'primary_residence')],
  22: [loc('lorien', 'primary_residence')],
};

const ex = (s) => `${s}@middle-earth.example`;
const osint = {
  1: [
    { type: 'Email', value: ex('frodo.baggins'), notes: 'Personal' },
    { type: 'Phone', value: '+1 555 0101', notes: 'Bag End' },
    { type: 'Username', value: 'mr.underhill', notes: 'Used at the Prancing Pony' },
  ],
  2: [{ type: 'Email', value: ex('sam.gamgee') }, { type: 'Website', value: 'https://bagshot-row-gardens.example' }],
  3: [{ type: 'Email', value: ex('bilbo') }, { type: 'Website', value: 'https://there-and-back-again.example', notes: 'Memoir draft' }],
  4: [{ type: 'Other', value: 'Fish, raw', notes: 'Diet; useful for tracking near rivers' }],
  7: [{ type: 'Email', value: ex('mithrandir') }, { type: 'Phone', value: '+1 555 0107' }],
  8: [{ type: 'Username', value: 'strider', notes: 'Ranger name' }, { type: 'Email', value: ex('dunadan') }],
  14: [
    { type: 'Email', value: ex('saruman.white') },
    { type: 'Website', value: 'https://isengard-industries.example' },
    { type: 'IP Address', value: '192.0.2.14', notes: 'Palantír relay (test range)' },
  ],
  15: [{ type: 'Email', value: ex('grima') }, { type: 'Phone', value: '+1 555 0115' }],
  18: [{ type: 'Email', value: ex('the.chief') }, { type: 'Document ID', value: 'SHIRE-DEED-1418-BE', notes: 'Bag End deed' }],
  20: [{ type: 'Phone', value: '+1 555 0120', notes: 'The Prancing Pony' }, { type: 'Website', value: 'https://prancing-pony.example' }],
};

// Saved integration records (as a leak-index service would return them), and
// OSINT entries taken from them, linked by record id.
const RETRIEVED = '2026-10-30T09:15:00.000Z';
const leakSource = { tool_name: 'Leak index (demo)', integration_id: 'demo-leak-index', operation: 'by-name', retrieved_at: RETRIEVED };
const osintRecords = [
  { id: 1, person_id: 4, record_source: 'Mirkwood Prison Register', occurrences: 1, ...leakSource, query: 'Gollum',
    data: { FULL_NAME: 'Gollum', ALSO_KNOWN_AS: ['Sméagol'], HELD_AT: 'Thranduil’s Halls', ESCAPED: '3018-06-20', GUARDS: [{ name: 'unnamed', post: 'tree' }], NOTES: 'Escaped during an orc raid' } },
  { id: 2, person_id: 4, record_source: 'Mordor Interrogation Log', occurrences: 2, ...leakSource, query: 'Gollum',
    data: { SUBJECT: 'Gollum', LOCATION: 'Barad-dûr', DISCLOSED: ['Shire', 'Baggins'], RELEASED: true } },
  { id: 3, person_id: 19, record_source: 'Bree Town Register', occurrences: 1, ...leakSource, query: 'Bill Ferny',
    data: { FULL_NAME: 'Bill Ferny', PHONE: '+1 555 0119', ADDRESS: { street: 'Bree-hill', town: 'Bree' }, OCCUPATION: null, SOLD: { item: 'pony', price: 12, currency: 'silver pennies', buyer: 'Barliman Butterbur' } } },
  { id: 4, person_id: 15, record_source: 'Edoras Court Rolls', occurrences: 1, ...leakSource, query: 'Gríma',
    data: { FULL_NAME: 'Gríma son of Gálmód', ROLE: 'Counsellor', EMAIL: ex('grima'), PAYMENTS_FROM: 'Isengard', BANISHED: '3019-03-02' } },
];
const fromRecord = (recordId, recordPath) => {
  const r = osintRecords.find((x) => x.id === recordId);
  const source = { ...leakSource, query: r.query, record_id: recordId, record_path: recordPath, record_sources: [r.record_source] };
  return { source, sources: [source], verified: false };
};
osint[4].push({ type: 'Other', value: 'Thranduil’s Halls (escaped)', notes: 'HELD_AT in a saved record', ...fromRecord(1, 'HELD_AT') });
osint[19] = [{ type: 'Phone', value: '+1 555 0119', notes: 'PHONE in a saved record', ...fromRecord(3, 'PHONE') }];
osint[15].push({ type: 'Other', value: 'Payments from Isengard', notes: 'PAYMENTS_FROM in a saved record', ...fromRecord(4, 'PAYMENTS_FROM') });

const people = peopleRows.map(([id, first, patronymic, last, aliases, age, category, status, caseId, notes]) => ({
  id,
  first_name: first,
  patronymic,
  last_name: last,
  aliases,
  date_of_birth: dob(age),
  category,
  status,
  case_id: caseId,
  case_name: caseId ? cases.find((c) => c.id === caseId).case_name : null,
  notes,
  locations: locations[id] || [],
  osint_data: osint[id] || [],
  connections: ties.filter(([a]) => a === id).map(([, b, type, note]) => ({ person_id: b, type, ...(note ? { note } : {}) })),
  custom_fields: {},
}));

// ── Businesses (with an ownership chain: Isengard owns the Shire holding) ────
const businesses = [
  { id: 1, name: 'Isengard Industries', type: 'Corporation', industry: 'Manufacturing', ...addr(P.isengard), website: 'https://isengard-industries.example', email: ex('orders'),
    owner_person_id: 14, status: 'active', notes: 'Furnaces fed from Fangorn. Arms for the Uruk-hai.',
    employees: [
      { name: 'Gríma Wormtongue', person_id: 15, role: 'Agent at Edoras', is_decision_maker: false },
      { name: 'Uglúk', person_id: null, role: 'Captain, Uruk-hai', department: 'Operations', is_decision_maker: false },
      { name: 'Saruman', person_id: 14, role: 'Founder', is_decision_maker: true },
    ] },
  { id: 2, name: 'Sackville-Baggins Holdings', type: 'LLC', industry: 'Other', ...addr(P.bagEnd), owner_person_id: 18, owner_business_id: 1, status: 'active',
    notes: 'Bought farms, mills and Bag End. Owned through Isengard Industries.',
    employees: [{ name: 'Lotho Sackville-Baggins', person_id: 18, role: 'The Chief', is_decision_maker: true }, { name: 'Bill Ferny', person_id: 19, role: 'Gatekeeper', is_decision_maker: false }] },
  { id: 3, name: 'The Prancing Pony', type: 'Sole Proprietorship', industry: 'Other', ...addr(P.bree), phone: '+1 555 0120', website: 'https://prancing-pony.example', owner_person_id: 20, status: 'active',
    notes: 'Inn at Bree.', employees: [{ name: 'Barliman Butterbur', person_id: 20, role: 'Landlord', is_decision_maker: true }, { name: 'Nob', person_id: null, role: 'Hobbit servant' }, { name: 'Bob', person_id: null, role: 'Stable hand' }] },
  { id: 4, name: 'The Green Dragon', type: 'Partnership', industry: 'Other', ...addr(P.bywater), status: 'active', notes: 'Inn at Bywater. Regulars talk too much.' },
];
function addr(p) { return { address: p.address, city: p.city, country: p.country, latitude: p.latitude, longitude: p.longitude }; }

// ── Properties ──────────────────────────────────────────────────────────────
const properties = [
  { id: 1, name: 'Bag End', property_type: 'residential', ...addr(P.bagEnd), owner_person_id: 18, case_name: 'Scouring of the Shire', description: 'Hobbit-hole under the Hill.', notes: 'Sold by Frodo to the Sackville-Bagginses before he left.' },
  { id: 2, name: 'Orthanc', property_type: 'commercial', ...addr(P.isengard), owner_person_id: 14, case_name: 'Isengard Industries', description: 'Tower in the Ring of Isengard.' },
  { id: 3, name: 'Meduseld', property_type: 'residential', ...addr(P.edoras), owner_person_id: 16, case_name: 'Isengard Industries', description: 'The Golden Hall of Edoras.' },
  { id: 4, name: 'Barad-dûr', property_type: 'other', ...addr(P.baradDur), owner_person_id: 5, case_name: 'The One Ring', description: 'Fortress in Mordor.' },
  { id: 5, name: 'Brandy Hall', property_type: 'residential', ...addr(P.brandyHall), owner_person_id: 12, description: 'Seat of the Brandybucks.' },
];

// ── Assets ──────────────────────────────────────────────────────────────────
const assets = [
  { id: 1, name: 'The One Ring', category: 'jewellery', identifier: 'Plain gold band; writing shows in fire', status: 'active', location_mode: 'with_holder', location_person_id: 1, case_name: 'The One Ring', notes: 'Holders: Sauron, Isildur, Déagol, Sméagol, Bilbo, Frodo.' },
  { id: 2, name: 'Sting', category: 'other', identifier: 'Elven short sword, glows near orcs', status: 'active', location_mode: 'with_holder', location_person_id: 1, case_name: 'The One Ring' },
  { id: 3, name: 'Mithril shirt', category: 'other', identifier: 'Dwarf-made mail', estimated_value: 1000000, currency: 'GOLD', status: 'active', location_mode: 'with_holder', location_person_id: 1, case_name: 'The One Ring', notes: 'Worth more than the Shire, according to Gandalf.' },
  { id: 4, name: 'Andúril', category: 'other', identifier: 'Reforged Narsil', status: 'active', location_mode: 'with_holder', location_person_id: 8, case_name: 'The Fellowship' },
  { id: 5, name: 'Palantír of Orthanc', category: 'electronics', identifier: 'Seeing-stone', status: 'seized', location_mode: 'with_holder', location_person_id: 8, case_name: 'Isengard Industries', notes: 'Thrown from Orthanc by Gríma; picked up by Pippin.' },
  { id: 6, name: 'Bill the Pony', category: 'vehicle', identifier: 'Pony, brown', status: 'active', location_mode: 'with_holder', location_person_id: 2, case_name: 'Scouring of the Shire' },
  { id: 7, name: 'Phial of Galadriel', category: 'other', identifier: 'Star-glass', status: 'active', location_mode: 'with_holder', location_person_id: 2, case_name: 'The One Ring' },
];

// ── Transactions ────────────────────────────────────────────────────────────
const transactions = [
  { transaction_type: 'transfer', item_label: 'The One Ring', item_category: 'physical_good', subject_asset_id: 1, from_person_id: 3, to_person_id: 1, occurred_on: '2025-09-22', ...addr(P.bagEnd), location_name: 'Bag End', case_name: 'The One Ring', notes: 'Left in an envelope on the mantelpiece after the party.' },
  { transaction_type: 'gift', item_label: 'Sting and the mithril shirt', item_category: 'physical_good', subject_asset_id: 2, from_person_id: 3, to_person_id: 1, occurred_on: '2025-12-24', ...addr(P.rivendell), location_name: 'Rivendell', case_name: 'The One Ring' },
  { transaction_type: 'sale', item_label: 'Bag End', item_category: 'real_estate', subject_property_id: 1, from_person_id: 1, to_person_id: 18, value: 4000, currency: 'GOLD', occurred_on: '2025-09-01', ...addr(P.bagEnd), location_name: 'Bag End', case_name: 'Scouring of the Shire', notes: 'Sale to the Sackville-Bagginses before the move to Crickhollow.' },
  { transaction_type: 'sale', item_label: 'Bill the Pony', item_category: 'physical_good', subject_asset_id: 6, from_person_id: 19, to_person_id: 20, value: 12, currency: 'SILVER', occurred_on: '2025-09-30', ...addr(P.bree), location_name: 'Bree', case_name: 'Scouring of the Shire', notes: 'Three times what the pony was worth.' },
  { transaction_type: 'loan', item_label: 'Funding for Shire purchases', item_category: 'business_interest', from_business_id: 1, to_business_id: 2, value: 25000, currency: 'GOLD', occurred_on: '2025-06-15', ...addr(P.isengard), location_name: 'Isengard', case_name: 'Isengard Industries', tags: ['follow-the-money', 'shell'] },
  { transaction_type: 'benefit', item_label: 'Retainer for counsel at Edoras', item_category: 'cash_donation', from_person_id: 14, to_person_id: 15, value: 500, currency: 'GOLD', occurred_on: '2025-03-01', ...addr(P.edoras), location_name: 'Edoras', case_name: 'Isengard Industries', tags: ['bribery'] },
  { transaction_type: 'gift', item_label: 'Phial of Galadriel', item_category: 'physical_good', subject_asset_id: 7, from_person_id: 22, to_person_id: 1, occurred_on: '2026-02-16', ...addr(P.lorien), location_name: 'Lothlórien', case_name: 'The One Ring' },
  { transaction_type: 'seized', item_label: 'Palantír of Orthanc', item_category: 'physical_good', subject_asset_id: 5, from_person_id: 14, to_person_id: 8, occurred_on: '2026-03-05', ...addr(P.isengard), location_name: 'Isengard', case_name: 'Isengard Industries' },
];

// ── Travel: the Ring-bearer's route, and two others ──────────────────────────
const leg = (person_id, place, arrival, departure, purpose, mode = 'other', notes) => ({
  person_id, location_type: 'travel', location_name: P[place].label, address: P[place].address, city: P[place].city, country: P[place].country,
  latitude: P[place].latitude, longitude: P[place].longitude, arrival_date: arrival, departure_date: departure, purpose, transportation_mode: mode, ...(notes ? { notes } : {}),
});
const travelHistory = [
  leg(1, 'bree', '2025-09-29', '2025-09-30', 'Meeting Gandalf (who did not come)'),
  leg(1, 'rivendell', '2025-10-20', '2025-12-25', 'Council of Elrond'),
  leg(1, 'moria', '2026-01-13', '2026-01-15', 'Passage under the mountains'),
  leg(1, 'lorien', '2026-01-17', '2026-02-16', 'Rest'),
  leg(1, 'argonath', '2026-02-25', '2026-02-26', 'Down the Anduin', 'ship'),
  leg(1, 'emynMuil', '2026-02-27', '2026-02-28', 'Lost in the hills; caught Gollum'),
  leg(1, 'ithilien', '2026-03-07', '2026-03-08', 'Held by Faramir'),
  leg(1, 'mountDoom', '2026-03-25', '2026-03-25', 'Destroy the Ring'),
  leg(12, 'fangorn', '2026-02-28', '2026-03-02', 'Escaped the Uruk-hai'),
  leg(12, 'isengard', '2026-03-03', '2026-03-05', 'With the Ents'),
  leg(14, 'bagEnd', '2026-10-20', '2026-11-03', 'As "Sharkey"'),
];

// ── Wireless networks seen at places of interest ─────────────────────────────
const net = (ssid, bssid, place, encryption, extra = {}) => ({
  ssid, bssid, latitude: P[place].latitude, longitude: P[place].longitude, encryption, signal_strength: -60, frequency: '2.4 GHz', channel: 6,
  network_type: 'infrastructure', confidence_level: 'medium', area_name: P[place].label, import_source: 'demo', tags: [], ...extra,
});
const wirelessNetworks = [
  net('PalantirNet', '02:00:00:00:00:01', 'isengard', 'WPA3', { person_id: 14, association_note: 'Orthanc private network', association_confidence: 'high', tags: ['surveillance'] }),
  net('Orthanc-Guest', '02:00:00:00:00:02', 'isengard', 'WPA2', { associated_person_ids: [15], associated_business_ids: [1] }),
  net('PrancingPony_Guests', '02:00:00:00:00:03', 'bree', 'WPA2', { associated_person_ids: [20, 19], associated_business_ids: [3], notes: 'Password on a slate behind the bar' }),
  net('BagEnd', '02:00:00:00:00:04', 'bagEnd', 'WPA2', { person_id: 1, association_confidence: 'high' }),
  net('GreenDragon-Free', '02:00:00:00:00:05', 'bywater', '', { associated_business_ids: [4] }),
  net('Meduseld-Court', '02:00:00:00:00:06', 'edoras', 'WPA3', { associated_person_ids: [16, 15, 17] }),
];

const todos = [
  { text: 'Confirm Gollum’s whereabouts after Emyn Muil', status: 'open' },
  { text: 'Request the Edoras court rolls on Gríma’s payments', status: 'in_progress' },
  { text: 'Trace the funding from Isengard Industries to Sackville-Baggins Holdings', status: 'attention' },
  { text: 'Interview Barliman Butterbur about Gandalf’s letter', status: 'done' },
  { text: 'Check who has used the Orthanc-Guest network', status: 'on_hold' },
];

const out = {
  version: '1.4',
  exportDate: '2026-11-06T00:00:00.000Z',
  description: 'GHOST standard test data set: "Middle-earth" (Lord of the Rings theme). Fictional; coordinates are New Zealand filming locations. Import into an empty project under Settings → Import / Export.',
  // People in reverse: GHOST lists the newest first, so Frodo comes out on top.
  data: { cases, people: [...people].reverse(), businesses, properties, assets, transactions, travelHistory, wirelessNetworks, osintRecords, todos },
};
fs.writeFileSync(path.join(HERE, 'middle-earth.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(`middle-earth.json: ${people.length} people, ${ties.length} ties, ${businesses.length} businesses, ${properties.length} properties, `
  + `${assets.length} assets, ${transactions.length} transactions, ${travelHistory.length} travel legs, ${wirelessNetworks.length} networks, `
  + `${osintRecords.length} saved records, ${todos.length} to-dos`);
