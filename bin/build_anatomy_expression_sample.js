import fs from 'fs';
import { createGunzip } from 'zlib';
import { Readable } from 'stream';

import streamJsonObjects from './streamJsonObjects.js';

// Real expression annotations for a handful of anatomy terms, so the section
// can be designed against what the data actually looks like.
//
// The Alliance already holds this. Every member's expression submission
// carries the native anatomy term it was curated against — the thing the page
// needs — and the files are published through the FMS. What is missing is a
// way to *ask* by anatomy term: /api/expression takes a required list of gene
// IDs, so it can only be queried gene-first. Inverting the whole set is a
// backend job; inverting it for eight terms is this file.
//
// So these rows are not mocked. They are the same annotations the member
// pages show — ZFA:0000135 comes out at 941 genes here, which is the figure
// ZFIN's own notochord page prints — just restricted to a sample and shipped
// as a fixture. When /api/anatomy/{id} lands, this and the page code that
// reads it both go, and the shape below is a usable specification for it.
//
// Not wired into `npm run generators`: it downloads ~47 MB across ten files.
// Run it by hand.
//
//   node bin/build_anatomy_expression_sample.js

const FMS = 'https://fms.alliancegenome.org/api/datafile/by';
const DESTINATION = 'public/anatomy-expression-sample.json';

// How many genes to keep per term. ZFIN ranks its own expression table by
// evidence weight and shows the leaders, which is what this imitates; the
// true totals are kept alongside so the page never implies the list is all.
const GENES_PER_TERM = 25;

// Two or three terms per member, chosen as ones already used in the design
// review so a reader can compare the section against the member's own page.
//
// Xenbase is the odd one: its Alliance submission is rolled up to nineteen
// system-level terms, so XAO:0000101 (liver diverticulum) has no expression
// here even though Xenbase's own page shows 158 genes for it. The two picked
// are the most specific ones the submission actually carries.
const SAMPLE = {
  WB: ['WBbt:0005772', 'WBbt:0003681'],
  FB: ['FBbt:00004729', 'FBbt:00001882'],
  ZFIN: ['ZFA:0000135', 'ZFA:0000123'],
  MGI: ['EMAPA:16894', 'EMAPA:16846'],
  XBXL: ['XAO:0000177', 'XAO:0000132'],
  XBXT: ['XAO:0000177', 'XAO:0000132'],
};

const SPECIES = {
  WB: 'Caenorhabditis elegans',
  FB: 'Drosophila melanogaster',
  ZFIN: 'Danio rerio',
  MGI: 'Mus musculus',
  XBXL: 'Xenopus laevis',
  XBXT: 'Xenopus tropicalis',
};

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

// Labels for the assay ontology, which the files cite as bare MMO curies.
async function assayLabels(curies) {
  const labels = {};
  for (const curie of curies) {
    const iri = `http://purl.obolibrary.org/obo/${curie.replace(':', '_')}`;
    const url = `https://www.ebi.ac.uk/ols4/api/ontologies/mmo/terms?iri=${encodeURIComponent(iri)}`;
    const response = await fetch(url).catch(() => null);
    const term = response?.ok ? (await response.json())?._embedded?.terms?.[0] : null;
    labels[curie] = term?.label || curie;
  }
  return labels;
}

const expression = await latestFiles('EXPRESSION');
const bgi = await latestFiles('BGI');
const terms = {};
const sources = {};
const assays = new Set();

for (const [mod, wanted] of Object.entries(SAMPLE)) {
  const file = expression[mod];
  if (!file) {
    throw new Error(`no EXPRESSION file published for ${mod}`);
  }
  const want = new Set(wanted);
  const perTerm = new Map(wanted.map((curie) => [curie, { genes: new Map(), annotations: 0, assays: new Set() }]));

  for await (const row of records(file.url)) {
    const where = row.whereExpressed || {};
    const curie = where.anatomicalStructureTermId;
    if (!want.has(curie)) {
      continue;
    }
    const bucket = perTerm.get(curie);
    bucket.annotations += 1;
    if (row.assay) {
      bucket.assays.add(row.assay);
      assays.add(row.assay);
    }
    const gene = bucket.genes.get(row.geneId) || { annotations: 0, stages: new Set() };
    gene.annotations += 1;
    if (row.whenExpressed?.stageName) {
      gene.stages.add(row.whenExpressed.stageName);
    }
    bucket.genes.set(row.geneId, gene);
  }

  // Symbols come from the member's gene file; only the sampled genes are kept.
  const needed = new Set([...perTerm.values()].flatMap((b) => [...b.genes.keys()]));
  const symbols = new Map();
  if (needed.size && bgi[mod]) {
    for await (const gene of records(bgi[mod].url)) {
      const id = gene.basicGeneticEntity?.primaryId;
      if (needed.has(id)) {
        symbols.set(id, gene.symbol);
      }
    }
  }

  sources[mod] = { ...file, species: SPECIES[mod] };

  for (const [curie, bucket] of perTerm) {
    const ranked = [...bucket.genes]
      .map(([id, g]) => ({
        curie: id,
        symbol: symbols.get(id) || id,
        annotations: g.annotations,
        stages: [...g.stages].sort().slice(0, 3),
      }))
      // Most-annotated first, then by symbol so the file is reproducible.
      .sort((a, b) => b.annotations - a.annotations || a.symbol.localeCompare(b.symbol));

    // One ontology, two species: XAO terms are submitted by both Xenopus
    // files, so a term already seen keeps its rows and gains these.
    const existing = terms[curie];
    const entry = existing || { sources: [], totalGenes: 0, totalAnnotations: 0, assays: [], genes: [] };
    entry.sources.push(mod);
    entry.totalGenes += bucket.genes.size;
    entry.totalAnnotations += bucket.annotations;
    entry.assays = [...new Set([...entry.assays, ...bucket.assays])].sort();
    entry.genes = [...entry.genes, ...ranked.slice(0, GENES_PER_TERM).map((g) => ({ ...g, species: SPECIES[mod] }))]
      .sort((a, b) => b.annotations - a.annotations || a.symbol.localeCompare(b.symbol))
      .slice(0, GENES_PER_TERM);
    terms[curie] = entry;

    console.log(
      `  ${curie.padEnd(16)} ${String(bucket.annotations).padStart(7)} annotations  ${String(bucket.genes.size).padStart(6)} genes  (${mod})`
    );
  }
}

const labels = await assayLabels([...assays].sort());
for (const entry of Object.values(terms)) {
  entry.assays = entry.assays.map((curie) => labels[curie] || curie);
}

fs.writeFileSync(DESTINATION, `${JSON.stringify({ genesPerTerm: GENES_PER_TERM, sources, terms }, null, 0)}\n`);
console.log(`\n${DESTINATION}: ${Object.keys(terms).length} terms`);
