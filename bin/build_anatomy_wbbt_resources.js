import fs from 'fs';
import path from 'path';

import writeJson from './writeJson.js';

// The resources WormBase keeps about its anatomy terms — WormAtlas pages,
// WormWiring and NemaNode connectome views, the Neuralnet browser, the Zhen
// lab's 3D neuron viewer — which reach no Alliance download, no OLS record and
// not WBbt itself. externalResources.js said so: WormBase "keeps them in ACEDB
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
// Entries also carry `name` where a term has more than one link into the same
// resource and the two are not interchangeable: which EM series, which
// Neuralnet view, which WormAtlas chapter. The page prints the resource once
// and these in brackets after it.
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
//   Neuralnet   410 terms  200 over http ONLY; https gets no answer. Many
//                          neurons carry two links, `m=0` and `m=1`. The
//                          site's own form names them: m is `multiple`, 1 is
//                          "Groups of cells" and 0 is "Individual cells", so
//                          both are kept and named.
//   WormAtlas  1977 terms  All 191 distinct pages loaded in a browser.
//
// WormAtlas needs its own paragraph, because the stored link is dead and the
// obvious repair is dead too. ACEDB's template is http://wormatlas.org/%s,
// which 302s to https://wormatlas.cropsci.illinois.edu WITHOUT the slash
// before the path, so every stored link lands on a mangled host. Rebuilding
// it on wormatlas.cropsci.illinois.edu answers 200 but that host is NOT in
// the certificate — it covers cpsc-worm.cropsci.illinois.edu, wormatlas.org,
// www.wormatlas.org and the two wormimage.org names — so a browser stops at a
// privacy interstitial. The working URL is https://wormatlas.org/<path>: the
// name matches, the certificate is current, and Chrome fetches the missing
// intermediate itself. curl still refuses it ("unable to get local issuer
// certificate") because it does not chase the issuer URL, which is why these
// were checked in a browser rather than by script — all 191, by their page
// titles, which is also where WORMATLAS_CHAPTERS below comes from.
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

// The handbook chapter each WormAtlas directory holds, from the page's own
// <title> — "Hermaphrodite - Alimentary System - Intestine" — shortened to
// what distinguishes it from the other chapters a term might also link to.
// The hermaphrodite is WormAtlas's unmarked case and stays unmarked here.
//
// Three directories hold a page called Procframeset.html and they are three
// different chapters, so the system is part of the name: the proctodeum is
// described once under the male epidermal system, once under the alimentary
// and once under the reproductive.
const WORMATLAS_CHAPTERS = {
  'dauer/cuticle': 'cuticle, dauer',
  'dauer/pharynx': 'pharynx, dauer',
  'hermaphrodite/alimentary': 'alimentary system',
  'hermaphrodite/atypical': 'atypical cells',
  'hermaphrodite/coelomocyte': 'coelomocyte system',
  'hermaphrodite/cuticle': 'cuticle',
  'hermaphrodite/egglaying apparatus': 'egg-laying apparatus',
  'hermaphrodite/excretory': 'excretory system',
  'hermaphrodite/germ line': 'germ line',
  'hermaphrodite/hypodermis': 'hypodermis',
  'hermaphrodite/interfacial': 'interfacial cells',
  'hermaphrodite/intestine': 'intestine',
  'hermaphrodite/introduction': 'introduction',
  'hermaphrodite/muscleGLR': 'GLR cells',
  'hermaphrodite/muscleheadcell': 'head mesodermal cell',
  'hermaphrodite/muscleintro': 'muscle system',
  'hermaphrodite/musclenonstriated': 'nonstriated muscle',
  'hermaphrodite/musclesomatic': 'somatic muscle',
  'hermaphrodite/neuronalsupport': 'neuronal support cells',
  'hermaphrodite/pericellular': 'pericellular structures',
  'hermaphrodite/pharynx': 'pharynx',
  'hermaphrodite/rectum': 'rectum and anus',
  'hermaphrodite/reproductive': 'reproductive system',
  'hermaphrodite/seam cells': 'seam cells',
  'hermaphrodite/somatic gonad': 'somatic gonad',
  'male/alimdef': 'defecation muscles, male',
  'male/alimproct': 'proctodeum, male alimentary system',
  'male/epithelial': 'epithelial system, male',
  'male/germline': 'germ line, male',
  'male/hook': 'hook',
  'male/hypodermis': 'hypodermis, male',
  'male/introduction': 'introduction, male',
  'male/muscleintro': 'muscle system, male',
  'male/musclemale': 'male-specific muscles',
  'male/postcloacal': 'postcloacal sensilla',
  'male/proctodeum': 'proctodeum, male epidermal system',
  'male/rays': 'rays',
  'male/reproproctodeum': 'proctodeum, male reproductive system',
  'male/somaticgonad': 'somatic gonad, male',
  'male/spicules': 'spicules',
};

// Neuron pages are named by the file, which is the cell: AVMframeset.html is
// AVM. Checked against all 151 of them; WormAtlas's own title disagrees on
// three (DB is titled DBN, DD DDN, SPD SPC) and the WBbt name wins, since
// that is the term the reader came from. Neuronframeset.html is the index.
const wormAtlasName = (value) => {
  const segments = value.split('/');
  const file = segments.pop().replace(/frameset\.html$/i, '');
  const chapter = segments.join('/');
  if (chapter === 'neurons/Individual Neurons') {
    return file === 'Neuron' ? 'individual neurons' : file;
  }
  const name = WORMATLAS_CHAPTERS[chapter];
  if (!name) {
    throw new Error(`WormAtlas chapter with no name: ${value}`);
  }
  return name;
};

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
  Neuralnet: (value) => ({
    id: value,
    // The site defaults to grouping when m is absent or unreadable, so that
    // is what an unmarked link gets called here.
    name: new URLSearchParams(value).get('m') === '0' ? 'individual cells' : 'groups of cells',
    url: `http://wormweb.org/neuralnet#${value}`,
  }),
  WormAtlas: (value) => ({
    id: value,
    name: wormAtlasName(value),
    url: `https://wormatlas.org/${encodeURI(value)}`,
  }),
};

const RESOURCES = {
  WormWiring: { label: 'WormWiring', verified: CHECKED },
  NemaNode: { label: 'NemaNode', verified: CHECKED },
  ZhenLab3D: { label: 'Zhen Lab 3D Neuron Viewer', verified: CHECKED },
  Neuralnet: { label: 'Neuralnet', verified: CHECKED, note: 'http only; https does not answer' },
  WormAtlas: {
    label: 'WormAtlas',
    verified: CHECKED,
    note:
      "ACEDB's links are dead as stored and the host they redirect to is not in the certificate; rebuilt on " +
      'wormatlas.org, where all 191 pages were loaded in a browser',
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
