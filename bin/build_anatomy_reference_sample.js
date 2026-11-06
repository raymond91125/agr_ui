import fs from 'fs';
import { createGunzip } from 'zlib';
import { Readable } from 'stream';

import streamJsonObjects from './streamJsonObjects.js';
import parsePhenotypeEntities from './parsePhenotypeEntities.js';
import writeJson from './writeJson.js';

// The papers behind what this page shows about a structure.
//
// No member publishes this. Six member term pages were read for it and every
// one of them either has no reference block at all, or has one that is empty
// on every anatomy term checked: WormBase renders "There are no known or
// curated references annotations for vulva", Xenbase states its own count as
// "Anatomy Item Literature (0)", and the field labelled References on a ZFIN
// summary holds TAO:0000123 — a Teleost Anatomy Ontology cross-reference, not
// a publication. There is no file to download and no widget to copy.
//
// But the literature is already there, one layer down. Every annotation the
// sections above are built from cites the paper it was read out of, so the
// question "what has been published about this structure" can be answered by
// turning the annotations inside out and counting. That is what this does,
// over the four sources on the page that carry a publication per row:
//
//   expression  Alliance EXPRESSION files, evidence.publicationId
//   phenotype   Alliance PHENOTYPE files, same field
//   marker      public/anatomy-marker-sample.json
//   function    public/anatomy-function-sample.json
//
// Reagents are not a fifth source. A reagent reaches this page through a
// phenotype annotation, so its paper is already counted under phenotype, and
// counting it twice would say a paper did more work than it did. Images are
// not a source either: ZFIN keys a figure to a publication, but the figure
// rows this page shows come from a rendered page that does not carry it.
//
// Which terms. Expression and phenotype are read for exactly the terms their
// own committed samples cover, by reading those files rather than by
// repeating their lists — a reference row for a term whose expression table
// does not exist would be citing a section the reader cannot see. Markers and
// function are complete sets, so every term in them is here.
//
// That leaves two kinds of term in one file, and the component has to say
// which a reader is on: for the thirteen sampled terms the list covers all
// four sources, and for the other 433 it covers the two complete WormBase
// sets and nothing else. The second is not a smaller version of the first.
// WBbt:0005792 has 33 papers here and certainly more in the expression file;
// they are absent because the file cannot be asked by anatomy term, which is
// the same limit the expression section states for itself.
//
// Citations come from the Alliance's own literature index, one search per
// publication, which answers with the AGRKB curie as well as the short
// citation. That curie is what makes a row a link rather than a string:
// /reference/{curie} is a page on this site, and src/components/dataTable/
// referenceList.jsx uses the same rule — AGRKB links, anything else is text.
// All 580 publications in the current cut resolve, including the 22 that
// reach the annotation as a member paper id rather than a PMID.
//
// Not wired into `npm run generators`: it downloads ~160 MB across eleven
// files and makes a few hundred API calls. Run it by hand.
//
//   node bin/build_anatomy_reference_sample.js

const FMS = 'https://fms.alliancegenome.org/api/datafile/by';
// Staging rather than www, and the reason is the rate limit rather than the
// data: www answers a few hundred lookups in a row with 429 and a rolling
// Retry-After that every further request renews, so a bulk resolution cannot
// finish against it however patiently it waits. Staging served all 580 in 38
// seconds. The records are the same either way — an AGRKB curie and a short
// citation are assigned in curation, upstream of both — and the curie is the
// part that has to be right, since it is what the row links to.
const SEARCH = 'https://stage.alliancegenome.org/api/search';
const DESTINATION = 'public/anatomy-reference-sample.json';

// How many publications to keep per term, the same cut the expression and
// phenotype tables take and the threshold SampleTable hides a table behind.
// Only 16 of the 446 terms reach it; the median term has one paper. The true
// total is kept alongside, so a page never implies the list is all of them —
// EMAPA:16894 brain has 4,202.
const PUBLICATIONS_PER_TERM = 25;

// Mirrors bin/build_anatomy_phenotype_sample.js, which is the file to change
// first if a member's route changes. Only the parts needed to get from an
// annotation to an anatomy term are here: this generator never resolves the
// object a phenotype was scored against, so it needs no allele, AGM,
// construct or gene file, which is most of that generator's download.
const MEMBERS = {
  WB: {
    species: 'Caenorhabditis elegans',
    anatomy: 'WBbt',
    normalize: (curie) => curie.replace(/^WB:/, ''),
    via: {
      prefix: 'WBPhenotype',
      label: 'C. elegans Phenotype Ontology',
      owl: 'http://purl.obolibrary.org/obo/wbphenotype/wbphenotype-base.owl',
    },
  },
  FB: { species: 'Drosophila melanogaster', anatomy: 'FBbt' },
  ZFIN: { species: 'Danio rerio', anatomy: 'ZFA' },
  MGI: { species: 'Mus musculus', anatomy: 'EMAPA' },
  XBXL: {
    species: 'Xenopus laevis',
    anatomy: 'XAO',
    via: { prefix: 'XPO', label: 'Xenopus Phenotype Ontology', owl: 'http://purl.obolibrary.org/obo/xpo/xpo-base.owl' },
  },
  XBXT: {
    species: 'Xenopus tropicalis',
    anatomy: 'XAO',
    via: { prefix: 'XPO', label: 'Xenopus Phenotype Ontology', owl: 'http://purl.obolibrary.org/obo/xpo/xpo-base.owl' },
  },
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

async function text(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  return response.text();
}

const read = (name) => JSON.parse(fs.readFileSync(`public/${name}`, 'utf8'));

// Which terms each committed sample covers, and which member file each came
// from, so this reads the same files for the same terms and cannot drift.
const sampledBy = (sample) => {
  const byMod = {};
  for (const [curie, entry] of Object.entries(sample.terms)) {
    for (const mod of entry.sources) {
      (byMod[mod] ||= []).push(curie);
    }
  }
  return byMod;
};

// An annotation's publication. The files give a PMID where the member has one
// and its own paper id where it does not, and both resolve below.
const publicationOf = (row) => row.evidence?.publicationId || row.evidence?.crossReference?.id || null;

// curie -> kind -> publication -> annotations
const counted = {};
const modsFor = {};
const unattributed = [];
const count = (curie, kind, publication, mod) => {
  if (!publication) {
    unattributed.push(`${curie} ${kind}`);
    return;
  }
  counted[curie] ||= {};
  counted[curie][kind] ||= {};
  counted[curie][kind][publication] = (counted[curie][kind][publication] || 0) + 1;
  (modsFor[curie] ||= new Set()).add(mod);
};

const sources = {};

// Expression. One pass per member file, keeping only the sampled terms.
const expressionSample = read('anatomy-expression-sample.json');
const expressionFiles = await latestFiles('EXPRESSION');
sources.expression = {};
for (const [mod, wanted] of Object.entries(sampledBy(expressionSample))) {
  const file = expressionFiles[mod];
  if (!file) {
    throw new Error(`no EXPRESSION file published for ${mod}`);
  }
  const want = new Set(wanted);
  let annotations = 0;
  for await (const row of records(file.url)) {
    const curie = row.whereExpressed?.anatomicalStructureTermId;
    if (!want.has(curie)) {
      continue;
    }
    annotations += 1;
    count(curie, 'expression', publicationOf(row), mod);
  }
  sources.expression[mod] = { ...file, species: MEMBERS[mod].species };
  console.log(`expression ${mod.padEnd(5)} ${String(annotations).padStart(6)} annotations over ${want.size} terms`);
}

// Phenotype. WormBase and Xenbase reach an anatomy term only through the
// logical definition of the phenotype term, exactly as in the phenotype
// generator; FlyBase and ZFIN name the structure on the annotation.
const definitions = new Map();
async function phenotypeEntities(via, entityPrefix) {
  if (!definitions.has(via.owl)) {
    const { versionIri, map } = parsePhenotypeEntities(await text(via.owl), {
      phenotypePrefix: via.prefix,
      entityPrefix,
    });
    if (Object.keys(map).length === 0) {
      throw new Error(`${via.owl} yielded no ${entityPrefix} definitions — has the release changed shape?`);
    }
    definitions.set(via.owl, { versionIri, map });
  }
  return definitions.get(via.owl);
}

const phenotypeSample = read('anatomy-phenotype-sample.json');
const phenotypeFiles = await latestFiles('PHENOTYPE');
sources.phenotype = {};
for (const [mod, wanted] of Object.entries(sampledBy(phenotypeSample))) {
  const member = MEMBERS[mod];
  const file = phenotypeFiles[mod];
  if (!file) {
    throw new Error(`no PHENOTYPE file published for ${mod}`);
  }
  const defined = member.via ? (await phenotypeEntities(member.via, member.anatomy)).map : null;
  const normalize = member.normalize || ((curie) => curie);
  const want = new Set(wanted);
  let annotations = 0;
  for await (const row of records(file.url)) {
    const cited = (row.phenotypeTermIdentifiers || []).map((term) => normalize(term.termId));
    const curies = [...new Set(defined ? cited.flatMap((curie) => defined[curie] || []) : cited)];
    for (const curie of curies) {
      if (!want.has(curie)) {
        continue;
      }
      annotations += 1;
      count(curie, 'phenotype', publicationOf(row), mod);
    }
  }
  sources.phenotype[mod] = { ...file, species: member.species };
  if (member.via) {
    sources.phenotype[mod].via = member.via.label;
    sources.phenotype[mod].viaVersion = definitions.get(member.via.owl).versionIri;
  }
  console.log(`phenotype  ${mod.padEnd(5)} ${String(annotations).padStart(6)} annotations over ${want.size} terms`);
}

// Markers and function, both complete WormBase sets already committed. Read
// from the files rather than rebuilt, so a page can never cite a paper for a
// row the section above it does not show.
const markerSample = read('anatomy-marker-sample.json');
sources.marker = markerSample.source;
let markerAnnotations = 0;
for (const [curie, entry] of Object.entries(markerSample.terms)) {
  for (const marker of entry.markers) {
    markerAnnotations += 1;
    count(curie, 'marker', marker.publication, 'WB');
  }
}
console.log(
  `marker     WB    ${String(markerAnnotations).padStart(6)} markers over ${Object.keys(markerSample.terms).length} terms`
);

const functionSample = read('anatomy-function-sample.json');
sources.function = functionSample.source;
let functionAnnotations = 0;
for (const [curie, entry] of Object.entries(functionSample.terms)) {
  for (const id of [...entry.involved, ...entry.notInvolved]) {
    functionAnnotations += 1;
    count(curie, 'function', functionSample.annotations[id].publication, 'WB');
  }
}
console.log(
  `function   WB    ${String(functionAnnotations).padStart(6)} rows over ${Object.keys(functionSample.terms).length} terms`
);

// Rank, and cut to the term's top slice.
const KINDS = ['expression', 'marker', 'phenotype', 'function'];
const total = (row) => KINDS.reduce((sum, kind) => sum + (row[kind] || 0), 0);

const terms = {};
const wanted = new Set();
for (const curie of Object.keys(counted).sort()) {
  const perPublication = new Map();
  for (const [kind, publications] of Object.entries(counted[curie])) {
    for (const [publication, annotations] of Object.entries(publications)) {
      const row = perPublication.get(publication) || { id: publication };
      row[kind] = annotations;
      perPublication.set(publication, row);
    }
  }
  const ranked = [...perPublication.values()].sort((a, b) => total(b) - total(a) || a.id.localeCompare(b.id));

  // Section by section rather than overall, taking one from each in turn.
  // A straight top 25 lets the largest section drown the rest: intestine has
  // 3,656 expression annotations against 2 markers and 3 function rows, so
  // its slice came out twenty-five expression papers and two columns of
  // dashes — a table saying, wrongly, that nothing was published behind the
  // other two sections. Round-robin gives every section its leaders first.
  const queues = KINDS.filter((kind) => counted[curie][kind]).map((kind) =>
    [...perPublication.values()]
      .filter((row) => row[kind])
      .sort((a, b) => b[kind] - a[kind] || a.id.localeCompare(b.id))
  );
  const kept = [];
  const taken = new Set();
  const deepest = Math.max(...queues.map((queue) => queue.length));
  for (let depth = 0; depth < deepest && kept.length < PUBLICATIONS_PER_TERM; depth += 1) {
    for (const queue of queues) {
      const row = queue[depth];
      if (!row || taken.has(row.id) || kept.length >= PUBLICATIONS_PER_TERM) {
        continue;
      }
      taken.add(row.id);
      kept.push(row);
    }
  }
  // Shown most cited first all the same, so the table reads as one list.
  kept.sort((a, b) => total(b) - total(a) || a.id.localeCompare(b.id));
  kept.forEach((row) => wanted.add(row.id));

  terms[curie] = {
    sources: [...modsFor[curie]].sort(),
    // Which sections of the page these papers are behind, in the order the
    // page shows them, so a reader can see at a glance whether a term is one
    // of the thirteen with all four or one of the rest with WormBase's two.
    kinds: KINDS.filter((kind) => counted[curie][kind]),
    totalPublications: perPublication.size,
    totalAnnotations: ranked.reduce((sum, row) => sum + total(row), 0),
    publications: kept.map((row) => ({
      id: row.id,
      ...Object.fromEntries(KINDS.filter((k) => row[k]).map((k) => [k, row[k]])),
    })),
  };
}

// Citations, from the Alliance's own literature index. A search rather than
// /api/reference/{id}, which answers 400 for anything but an AGRKB curie and
// so cannot be asked about a PMID at all. The hit is accepted only when it
// cross-references the identifier asked for: a bare PMID can match a second
// record on its digits alone.
const publications = {};
const unresolved = [];
const ids = [...wanted].sort();

// Patient, and quiet about it. A missed lookup is recorded rather than
// thrown: by the time this runs, eleven files have been streamed and the
// whole count is in memory, and discarding that over one flaky request would
// be the wrong trade. A flood of misses is a different thing and does throw,
// below — a file where most rows are unlinked is not worth committing.
async function search(id) {
  // A prefixed PMID finds nothing — the index tokenizes the colon away —
  // while a member paper id has to keep its prefix to be found at all.
  const query = encodeURIComponent(id.startsWith('PMID:') ? id.slice(5) : id);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(`${SEARCH}?category=literature_search_result&q=${query}&limit=5`);
    if (response.ok) {
      return response.json();
    }
    if (response.status !== 429 && response.status < 500) {
      return null;
    }
    // Retry-After is in seconds and is what the gateway actually wants; the
    // doubling is only for a 5xx that gives no advice.
    const after = Number(response.headers.get('retry-after'));
    await new Promise((resolve) => setTimeout(resolve, after ? after * 1000 : 1000 * 2 ** attempt));
  }
  return null;
}

for (let i = 0; i < ids.length; i += 4) {
  const batch = ids.slice(i, i + 4);
  await Promise.all(
    batch.map(async (id) => {
      const found = await search(id);
      const hit = (found?.results || []).find((result) => (result.crossReferences || []).includes(id));
      if (!hit) {
        unresolved.push(id);
        return;
      }
      publications[id] = { curie: hit.id, citation: hit.shortCitation, year: hit.publicationYear };
    })
  );
}

// A handful of papers the index has not reached is ordinary and the component
// renders those as a bare identifier. Most of them failing means the index
// was unreachable, not that the Alliance has forgotten its own literature.
if (unresolved.length > ids.length / 20) {
  throw new Error(`${unresolved.length} of ${ids.length} publications found no citation — is ${SEARCH} reachable?`);
}

if (Object.keys(terms).length === 0) {
  throw new Error('no publications found — have the annotation files changed shape?');
}

const everyPublication = new Set();
for (const kinds of Object.values(counted)) {
  for (const perKind of Object.values(kinds)) {
    Object.keys(perKind).forEach((id) => everyPublication.add(id));
  }
}

await writeJson(DESTINATION, {
  publicationsPerTerm: PUBLICATIONS_PER_TERM,
  sources,
  coverage: {
    terms: Object.keys(terms).length,
    // Terms whose list covers all four sources, against those carrying only
    // the two complete WormBase sets. The component says which a reader is on.
    sampled: Object.keys(terms).filter((curie) =>
      terms[curie].kinds.some((kind) => kind !== 'marker' && kind !== 'function')
    ).length,
    publications: everyPublication.size,
    shown: Object.keys(publications).length,
  },
  publications,
  terms,
});

const counts = Object.values(terms).map((entry) => entry.totalPublications);
console.log(`\n${Object.keys(terms).length} terms, ${everyPublication.size} distinct publications`);
console.log(
  `  ${Object.keys(publications).length} kept and cited, ${counts.filter((n) => n > PUBLICATIONS_PER_TERM).length} terms cut to ${PUBLICATIONS_PER_TERM}`
);
console.log(
  `  busiest term has ${Math.max(...counts)}, median ${counts.sort((a, b) => a - b)[Math.floor(counts.length / 2)]}`
);
if (unresolved.length) {
  console.log(`  no citation for ${unresolved.length}, shown as the bare id: ${unresolved.join(' ')}`);
}
if (unattributed.length) {
  console.log(`  ${unattributed.length} annotations cite no publication and were skipped`);
}
console.log(`${DESTINATION}: ${fs.statSync(DESTINATION).size} bytes`);
