import fs from 'fs';
import path from 'path';

import writeJson from './writeJson.js';

// The resources WormBase keeps about its anatomy terms — WormAtlas pages,
// WormWiring and NemaNode connectome views, the Neuralnet browser, the Zhen
// lab's 3D neuron viewer — which reach no Alliance download, no OLS record and
// not WBbt itself. externalResources.js says so: WormBase "keeps them in ACEDB
// rather than in WBbt, so they reach no download and no OLS record and cannot
// be read from here at all". This file is that route.
//
// The input is the converter's ACEDB dump (dump_anatomy_resources.pl), which
// records every `DB_info Database <db> <field> <value>` on ?Anatomy_term and
// each database's URL_constructor. This generator builds a URL per link and
// writes, per WBbt term, entries in the `{ database, id, url }` shape that
// src/lib/ols.js already passes to toExternalResources() for OLS xrefs. So a
// WBbt page can concatenate these onto `term.resources`, and the allowlist in
// externalResources.js decides what is shown, as it does for FlyBase.
//
// What is a resource and what is not, decided here, with the counts as of
// WS298 and checks made on 2026-11-06 by request:
//
//   WormWiring  520 terms  200. One link per neuron per EM series; the
//                          series code (N2U, JSH, n2y, n930, JSE, N2W) is the
//                          id, which is how WormWiring itself labels them.
//   NemaNode    225 terms  200.
//   ZhenLab3D   180 terms  200 over https; ACEDB's template says http and
//                          the host redirects, so https is built directly.
//   Neuralnet   410 terms  200 over http ONLY; https gets no answer. Two
//                          links on many neurons, `m=0` and `m=1`, whose
//                          meaning the site's scripts do not reveal; both
//                          are kept as stored.
//   WormAtlas  1977 terms  NOT verified. ACEDB's template is
//                          http://wormatlas.org/%s, which redirects to
//                          https://wormatlas.cropsci.illinois.edu WITHOUT the
//                          slash before the path, so every stored link is dead
//                          as written. The URL here is built on that host with
//                          the slash restored. Whether it answers could not be
//                          checked from a script: the server stalls a modern
//                          TLS handshake and, with an older one, sends an
//                          incomplete certificate chain. A browser may well
//                          cope with both. Open one before allowlisting it.
//
// Left out, with reasons, so nobody re-derives them:
//
//   GLOWorm_Scene  1,489 terms  fsbill.vcell.uchc.edu does not answer
//   MODEncodeTissue*  34 terms  31 databases, none with a per-term value: each
//                               is one fixed modENCODE GBrowse track, and
//                               modencode.oicr.on.ca does not answer
//   Spencer2011       19 terms  no per-term value; one fixed Vanderbilt page
//                               (it answers, but says nothing per structure)
//
// Spot checks prove a host answers, not that every id resolves. WormWiring,
// NemaNode, ZhenLab3D and Neuralnet are single-page apps that return 200 for
// any query string, so an unknown cell name fails only in the browser.
//
// Not wired into `npm run generators`: its input comes from a live ACEDB
// server. Run it by hand, pointing it at the converter's folder:
//
//   node bin/build_anatomy_wbbt_resources.js ~/local/src/git/anatomy_function_conversion

const DESTINATION = 'public/anatomy-wbbt-resources.json';
const CHECKED = '2026-11-06';

// database -> how to turn ACEDB's stored value into { id, url }.
const BUILD = {
  WormWiring: (value) => {
    const params = new URLSearchParams(value);
    return {
      id: params.get('db'),
      cell: params.get('cell'),
      url: `https://wormwiring.org/apps/neuronMaps/?${value}`,
    };
  },
  NemaNode: (value) => ({ id: value, url: `https://nemanode.org/?in=${encodeURIComponent(value)}` }),
  ZhenLab3D: (value) => ({ id: value, url: `https://zhen-tools.com/#/3d-viewer?neurons=${encodeURIComponent(value)}` }),
  Neuralnet: (value) => ({ id: value, url: `http://wormweb.org/neuralnet#${value}` }),
  WormAtlas: (value) => ({ id: value, url: `https://wormatlas.cropsci.illinois.edu/${encodeURI(value)}` }),
};

const RESOURCES = {
  WormWiring: { label: 'WormWiring', verified: CHECKED },
  NemaNode: { label: 'NemaNode', verified: CHECKED },
  ZhenLab3D: { label: 'Zhen Lab 3D Neuron Viewer', verified: CHECKED },
  Neuralnet: { label: 'Neuralnet', verified: CHECKED, note: 'http only; https does not answer' },
  WormAtlas: {
    label: 'WormAtlas',
    verified: null,
    note:
      'stored links redirect to a broken URL; rebuilt on wormatlas.cropsci.illinois.edu but not checked ' +
      '(TLS handshake stalls, certificate chain incomplete); open one in a browser before showing',
  },
};

const EXCLUDED_REASONS = [
  [/^GLOWorm_Scene$/, 'host fsbill.vcell.uchc.edu does not answer'],
  [/^MODEncodeTissue/, 'no per-term value; one fixed modENCODE GBrowse track, host does not answer'],
  [/^Spencer2011$/, 'no per-term value; one fixed page, not about the structure'],
];

const folder = process.argv[2];
if (!folder) {
  throw new Error('usage: node bin/build_anatomy_wbbt_resources.js <converter folder>');
}
const dump = JSON.parse(fs.readFileSync(path.join(folder, 'anatomy_resources.json'), 'utf8'));

const terms = {};
const excluded = {};
const unknown = new Set();
const counts = {};

for (const curie of Object.keys(dump.terms).sort()) {
  const seen = new Set();
  const out = [];
  for (const { database, value } of dump.terms[curie].links) {
    const build = BUILD[database];
    if (!build) {
      const reason = EXCLUDED_REASONS.find(([pattern]) => pattern.test(database));
      if (reason) {
        const key = database.startsWith('MODEncodeTissue') ? 'MODEncodeTissue*' : database;
        excluded[key] = excluded[key] || { terms: new Set(), reason: reason[1] };
        excluded[key].terms.add(curie);
      } else {
        unknown.add(database);
      }
      continue;
    }
    if (!value) {
      continue;
    }
    const entry = { database, ...build(value) };
    if (seen.has(entry.url)) {
      continue;
    }
    seen.add(entry.url);
    out.push(entry);
    counts[database] = counts[database] || new Set();
    counts[database].add(curie);
  }
  if (out.length) {
    terms[curie] = out;
  }
}

// A database WormBase adds later must not slip onto the page unexamined, and
// must not silently vanish either: fail, so whoever regenerates decides.
if (unknown.size) {
  throw new Error(`unexamined ACEDB databases on anatomy terms: ${[...unknown].sort().join(', ')}`);
}

const resources = {};
for (const [name, info] of Object.entries(RESOURCES)) {
  const db = dump.databases[name] || {};
  resources[name] = {
    ...info,
    description: db.description || null,
    homepage: db.url || null,
    acedbTemplate: db.template || null,
    terms: counts[name]?.size || 0,
  };
}

await writeJson(DESTINATION, {
  source: {
    mod: 'WB',
    species: 'Caenorhabditis elegans',
    release: dump.release,
    origin: 'WormBase ACEDB Anatomy_term DB_info, via dump_anatomy_resources.pl',
  },
  resources,
  excluded: Object.fromEntries(
    Object.entries(excluded)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, { terms: t, reason }]) => [name, { terms: t.size, reason }])
  ),
  terms,
});

console.log(`${Object.keys(terms).length} WBbt terms with a resource, from ${dump.release}`);
for (const [name, r] of Object.entries(resources)) {
  console.log(`  ${name.padEnd(11)} ${String(r.terms).padStart(5)} terms  ${r.verified ? 'verified' : 'NOT verified'}`);
}
for (const [name, { terms: t, reason }] of Object.entries(excluded)) {
  console.log(`  excluded ${name}: ${t.size} terms, ${reason}`);
}
console.log(`${DESTINATION}: ${fs.statSync(DESTINATION).size} bytes`);
