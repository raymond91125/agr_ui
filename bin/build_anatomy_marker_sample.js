import fs from 'fs';
import { createGunzip } from 'zlib';
import { Readable } from 'stream';

import streamJsonObjects from './streamJsonObjects.js';
import writeJson from './writeJson.js';

// Genes curated as markers FOR an anatomy term, which is a different claim
// from being expressed in it. A marker asserts that the gene identifies the
// structure — elt-2 and end-3 for intestine — and it is what a reader needs
// when they want to label a structure rather than survey it.
//
// WormBase is the only member with the concept. The others were surveyed and
// have nothing of this shape: FlyBase and Xenbase attach no cross-reference to
// an expression annotation at all, ZFIN's is a figure and MGI's an assay. Note
// the false friend while reading those pages — at MGI and ZFIN a "marker" is
// any genomic feature, which is why their gene pages live under /marker/ and
// /action/marker/. That collision is why this section, which uses WormBase's
// own name for WormBase's own concept, is shown only on WBbt terms.
//
// Unlike images, no scraping is needed: the Alliance already carries this
// inside EXPRESSION_WB, where an annotation citing a WB:Marker### expression
// pattern rather than a WB:Expr### one is a marker. 305 of 105,273 do.
//
// Unlike the other three samples, this one is COMPLETE rather than sampled.
// The whole set is 278 annotations over 176 terms once the root is dropped,
// which fits in a committed file with room to spare, so no term is left out
// and the page needs no "most annotated" cut. The thinness that remains is
// WormBase's curation rather than our sampling — 176 terms of 7,573 — and the
// section says so in those words, because the two are not the same admission.
//
// Two traps, both found by checking these rows against WormBase's own widget
// instead of trusting either source alone.
//
// The first is the root, handled here. 27 annotations are pinned to
// WBbt:0000100, `C. elegans anatomical entity`, the top of the ontology, and
// 18 of those also carry a GO cellular-component term — synapse, cilium,
// centrosome, mitochondrion, axon. They are markers for a subcellular
// compartment with the anatomy slot filled by the root as a placeholder.
// Rendering them would hang 27 markers on a page describing the whole animal;
// WormBase shows none there, correctly. They are excluded and counted.
//
// The second cannot be handled here, only declared. A marker naming no gene
// cannot appear in a gene-keyed expression file at all. Across thirteen terms
// checked against WormBase, the two sources agreed exactly on seven and every
// one of the six disagreements was the same absentee: Marker87, which has no
// gene and which WormBase describes at length as the marker for VPC daughters
// and granddaughters. On vulva it is the only marker there is, so vulva comes
// out of this file empty while WormBase shows one. The component says that a
// marker without a gene is missing and sends the reader to WormBase; it is not
// something this file can fix.
//
// The stage is deliberately not carried. Every marker annotation in the set
// gives the same one, `Nematoda Life Stage`, which is WormBase's way of saying
// the claim is not stage-scoped; printing it would read as information and
// carry none.
//
// Not wired into `npm run generators`: it downloads the WB expression and gene
// files. Run it by hand.
//
//   node bin/build_anatomy_marker_sample.js

const FMS = 'https://fms.alliancegenome.org/api/datafile/by';
const DESTINATION = 'public/anatomy-marker-sample.json';

const MOD = 'WB';
const SPECIES = 'Caenorhabditis elegans';

// The top of WBbt. Not a structure anyone browses to, and used in this data as
// a placeholder for "the anatomy slot does not apply".
const ROOT = 'WBbt:0000100';

// What separates a marker annotation from an ordinary expression one. This is
// a real distinction in WormBase's model — Marker### and Expr### are different
// objects — not a guess from the shape of a string, which is the mistake that
// classified ZFIN's reagents wrongly the first time.
const MARKER = /^WB:Marker\d+$/;

async function latestFiles(dataType) {
  const response = await fetch(`${FMS}/${dataType}?latest=true`);
  if (!response.ok) {
    throw new Error(`FMS ${dataType} answered ${response.status}`);
  }
  const byMod = {};
  for (const file of await response.json()) {
    byMod[file.dataSubType.name] = {
      url: file.stableURL,
      release: file.releaseVersions?.[0]?.releaseVersion,
      uploaded: (file.uploadDate || '').slice(0, 10),
    };
  }
  return byMod;
}

async function* records(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  const stream = Readable.fromWeb(response.body).pipe(createGunzip());
  stream.setEncoding('utf8');
  yield* streamJsonObjects(stream);
}

const expression = await latestFiles('EXPRESSION');
const bgi = await latestFiles('BGI');
const file = expression[MOD];
if (!file) {
  throw new Error(`no EXPRESSION file published for ${MOD}`);
}

const perTerm = new Map();
const excluded = { root: 0, cellularComponent: 0 };
let total = 0;

for await (const row of records(file.url)) {
  const id = row.crossReference?.id;
  if (!MARKER.test(id || '')) {
    continue;
  }
  total += 1;
  const where = row.whereExpressed || {};
  const curie = where.anatomicalStructureTermId;
  if (!curie) {
    continue;
  }
  if (curie === ROOT) {
    excluded.root += 1;
    if (where.cellularComponentTermId) {
      excluded.cellularComponent += 1;
    }
    continue;
  }

  if (!perTerm.has(curie)) {
    perTerm.set(curie, new Map());
  }
  const markers = perTerm.get(curie);
  // One row per marker per term. A marker annotated several times to the same
  // term is one marker, and the count of rows behind it is kept rather than
  // repeated.
  const key = id.replace(/^WB:/, '');
  const marker = markers.get(key) || {
    id: key,
    geneId: row.geneId,
    annotations: 0,
    statements: new Set(),
    publications: new Set(),
  };
  marker.annotations += 1;
  if (where.whereExpressedStatement) {
    marker.statements.add(where.whereExpressedStatement);
  }
  if (row.evidence?.publicationId) {
    marker.publications.add(row.evidence.publicationId);
  }
  markers.set(key, marker);
}

// Symbols come from the member's gene file; only the genes used are kept.
const needed = new Set([...perTerm.values()].flatMap((m) => [...m.values()].map((x) => x.geneId)));
const symbols = new Map();
if (needed.size && bgi[MOD]) {
  for await (const gene of records(bgi[MOD].url)) {
    const id = gene.basicGeneticEntity?.primaryId;
    if (needed.has(id)) {
      symbols.set(id, gene.symbol);
    }
  }
}

const terms = {};
for (const [curie, markers] of [...perTerm].sort(([a], [b]) => a.localeCompare(b))) {
  const list = [...markers.values()]
    .map((marker) => ({
      id: marker.id,
      // Built here rather than in the page so the template lives beside the
      // data it describes. It is the `gene/expression/annotation/detail` page
      // from src/resourceDescriptors.js, which is where a WB:Expr### or
      // WB:Marker### resolves to.
      url: `https://www.wormbase.org/species/all/expr_pattern/${marker.id}`,
      curie: marker.geneId,
      symbol: symbols.get(marker.geneId) || marker.geneId,
      annotations: marker.annotations,
      // Kept although it is almost always the term's own name, because when it
      // is not it is the whole point: `ventral cord neuron (partial)` says the
      // marker labels some of the structure and not the rest. The component
      // prints it only when it differs from the term name, so the usual case
      // costs the reader nothing.
      statement: [...marker.statements][0],
      // Always exactly one across the whole set, so it is stored as one.
      publication: [...marker.publications].sort()[0],
    }))
    // By symbol, not by annotation count: with a median of one marker per term
    // a ranking would be noise, and a stable order keeps the diff readable
    // when the file is regenerated.
    .sort((a, b) => a.symbol.localeCompare(b.symbol) || a.id.localeCompare(b.id));
  terms[curie] = { sources: [MOD], species: SPECIES, totalMarkers: list.length, markers: list };
}

const counts = Object.values(terms).map((t) => t.totalMarkers);
if (counts.length === 0) {
  throw new Error('no marker annotations found — has EXPRESSION_WB changed shape?');
}

// How many terms the vocabulary holds, so the page can say what fraction is
// curated without a number hardcoded into a component, where it would quietly
// go stale as WBbt grows.
const ontology = await fetch('https://www.ebi.ac.uk/ols4/api/ontologies/wbbt').then((r) => r.json());
const ontologyTerms = ontology.numberOfTerms;
if (!ontologyTerms) {
  throw new Error('OLS did not report a term count for wbbt');
}

await writeJson(DESTINATION, {
  source: { mod: MOD, species: SPECIES, ...file },
  coverage: { terms: Object.keys(terms).length, ontologyTerms },
  // Published so the page can say what it left out rather than quietly
  // showing a smaller number than WormBase does.
  excluded,
  terms,
});

console.log(`${total} marker annotations in ${file.url.split('/').pop()}`);
console.log(`  excluded ${excluded.root} on ${ROOT} (${excluded.cellularComponent} of them a cellular component)`);
console.log(`  kept ${counts.reduce((a, b) => a + b, 0)} markers over ${counts.length} terms`);
console.log(
  `  ${counts.filter((n) => n === 1).length} terms with one marker, ${counts.filter((n) => n >= 5).length} with five or more`
);
console.log(`${DESTINATION}: ${fs.statSync(DESTINATION).size} bytes`);
