import fs from 'fs';
import path from 'path';

import writeJson from './writeJson.js';

// Anatomy function: what an experiment showed a structure is FOR. Either a gene
// was shown to act in it (mosaic analysis, tissue-specific rescue), or the
// structure itself was removed or silenced (laser ablation, genetic ablation,
// optogenetics) and a phenotype followed — or did not.
//
// Not the same claim as expression or phenotype. Expression says a gene is on
// here; a phenotype annotation says a gene matters somewhere. This says where
// it matters, or that this structure matters, and for what. That is why it is
// a section of its own.
//
// WormBase is the only member that curates it, and the Alliance does not yet
// publish it: there is no FMS file to download, unlike every other sample on
// this page. The model for it is on raymond91125/agr_curation_schema
// (anatomyFunctionAnnotation.yaml), and the data comes from WormBase's ACEDB
// through a converter kept outside this repo. This generator reads that
// converter's two outputs:
//
//   anatomy_function_ingest.json  — the Alliance ingest DTOs, IDs only
//   anatomy_function_labels.json  — symbols, names, PMIDs and citations for
//                                   those IDs, from the same ACEDB release
//
// When the Alliance publishes the data, this should read the published file
// instead, as the marker sample reads EXPRESSION_WB.
//
// COMPLETE, like the marker sample, not sampled: 1,165 annotations touch 297
// terms, and the busiest term (touch receptor neuron) has 76 rows.
//
// Two tables per term, because a structure appears in an annotation in one of
// two opposite roles. "Involved" means the structure was shown to be where the
// gene acts, or the structure itself was shown to matter. "Not involved" means
// it was tested and shown not to — expression there did not rescue, or
// ablating it changed nothing. A reader skimming one mixed table would take
// the second for the first.
//
// Exact term only. Annotations on a part of this structure (a single neuron of
// a class, say) are not rolled up, matching the marker section.
//
// One subtlety the page must respect. ACEDB records necessity and sufficiency
// per structure; the Alliance model records them per annotation, describing
// the involved structures when the annotation has any, else the not-involved
// ones. `qualifies` on each annotation names which role they describe, and the
// component shows them only on a row in that role. Otherwise a row in the
// not-involved table could print "necessary" beside a structure shown not to
// be needed. In WS298 one annotation, WBbtf0070, has both roles.
//
// Not wired into `npm run generators`: its input comes from the converter and
// a live ACEDB server. Run it by hand, pointing it at the converter's folder:
//
//   node bin/build_anatomy_function_sample.js ~/local/src/git/anatomy_function_conversion

const DESTINATION = 'public/anatomy-function-sample.json';

const MOD = 'WB';
const SPECIES = 'Caenorhabditis elegans';

// ACEDB AO_code names, as a reader would say them. Anything unlisted falls
// back to the code with its underscores spaced out, so a new assay shows up
// readable rather than breaking the build.
const ASSAYS = {
  Blastomere_isolation: 'blastomere isolation',
  Chemogenetics: 'chemogenetics',
  Expression_mosaic: 'expression mosaic',
  Genetic_ablation: 'genetic ablation',
  Genetic_mosaic: 'genetic mosaic',
  Laser_ablation: 'laser ablation',
  Neuronal_genetics: 'neuronal genetics',
  Optogenetic: 'optogenetics',
};

// The ingest file's controlled values, as a reader would say them.
const WORDS = {
  necessary: 'necessary',
  unnecessary: 'not necessary',
  sufficient: 'sufficient',
  insufficient: 'not sufficient',
  cell_autonomous: 'cell-autonomous',
  non_cell_autonomous: 'non-cell-autonomous',
};

const folder = process.argv[2];
if (!folder) {
  throw new Error('usage: node bin/build_anatomy_function_sample.js <converter folder>');
}
const read = (name) => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'));
const ingest = read('anatomy_function_ingest.json');
const labels = read('anatomy_function_labels.json');

const release = ingest.alliance_member_release_version;
if (release !== labels.release) {
  throw new Error(`ingest file is ${release} but labels are ${labels.release}; rerun dump_labels.pl`);
}

const word = (value) => (value ? WORDS[value] || value : null);
const assay = (code) => (code ? ASSAYS[code] || code.replace(/_/g, ' ').toLowerCase() : null);
const missingLabels = new Set();
const label = (table, id) => {
  if (!labels[table][id] || labels[table][id] === id) {
    missingLabels.add(id);
  }
  return labels[table][id] || id;
};

const annotations = {};
const perTerm = new Map();
const place = (curie, role, id) => {
  if (!perTerm.has(curie)) {
    perTerm.set(curie, { involved: [], notInvolved: [] });
  }
  perTerm.get(curie)[role].push(id);
};

const sets = [
  ['gene', ingest.gene_anatomy_function_annotation_ingest_set],
  ['structure', ingest.anatomical_structure_function_annotation_ingest_set],
];

for (const [kind, rows] of sets) {
  for (const row of rows) {
    const id = row.mod_internal_id;
    const involved =
      kind === 'gene'
        ? (row.anatomical_site_dtos || []).map((s) => s.anatomical_structure_curie)
        : row.anatomical_structure_curies || [];
    const notInvolved =
      kind === 'gene'
        ? (row.anatomical_site_not_involved_dtos || []).map((s) => s.anatomical_structure_curie)
        : row.anatomical_structure_not_involved_curies || [];
    if (involved.some((curie) => notInvolved.includes(curie))) {
      throw new Error(`${id} lists a structure as both involved and not involved`);
    }

    const paper = labels.papers[row.evidence_curie] || {};
    if (!paper.pmid) {
      missingLabels.add(row.evidence_curie);
    }

    annotations[id] = {
      kind,
      // The generic WormBase resolver, the same one the marker section's
      // footnote links anatomy terms through. Not checked from here: WormBase
      // answers scripted requests with a Cloudflare challenge.
      url: `https://www.wormbase.org/db/get?name=${id};class=Anatomy_function`,
      ...(kind === 'gene' && {
        gene: { curie: row.gene_identifier, symbol: label('genes', row.gene_identifier) },
      }),
      phenotype: { curie: row.phenotype_term_curie, name: label('phenotypes', row.phenotype_term_curie) },
      involved,
      notInvolved,
      necessity: word(row.necessity_name),
      sufficiency: word(row.sufficiency_name),
      // Which role necessity and sufficiency describe; see the header.
      qualifies: involved.length ? 'involved' : 'notInvolved',
      cellAutonomy: word(row.cell_autonomy_name),
      assay: assay(row.assay_name),
      publication: paper.pmid || null,
      citation: paper.citation || null,
    };

    involved.forEach((curie) => place(curie, 'involved', id));
    notInvolved.forEach((curie) => place(curie, 'notInvolved', id));
  }
}

// Gene rows first, then structure rows; within each by gene symbol, then
// phenotype, then ID. A stable order keeps the diff readable on regeneration,
// and a ranking by anything else would be noise at a median of two rows.
const order = (a, b) => {
  const x = annotations[a];
  const y = annotations[b];
  return (
    (x.kind === y.kind ? 0 : x.kind === 'gene' ? -1 : 1) ||
    (x.gene?.symbol || '').localeCompare(y.gene?.symbol || '') ||
    x.phenotype.name.localeCompare(y.phenotype.name) ||
    a.localeCompare(b)
  );
};

const terms = {};
for (const [curie, roles] of [...perTerm].sort(([a], [b]) => a.localeCompare(b))) {
  roles.involved.sort(order);
  roles.notInvolved.sort(order);
  terms[curie] = {
    sources: [MOD],
    species: SPECIES,
    totalAnnotations: roles.involved.length + roles.notInvolved.length,
    involved: roles.involved,
    notInvolved: roles.notInvolved,
  };
}

// Names for every structure an annotation mentions, so a row can list the
// other structures beside this one without a lookup per term. Kept once here
// rather than repeated in every annotation.
const anatomy = {};
for (const curie of [...perTerm.keys()].sort()) {
  anatomy[curie] = label('anatomy', curie);
}

if (Object.keys(terms).length === 0) {
  throw new Error('no anatomy function annotations found — has the ingest file changed shape?');
}

// As in the marker sample: the vocabulary's size, so the page can say what
// fraction of terms is curated without a number hardcoded into a component.
const ontology = await fetch('https://www.ebi.ac.uk/ols4/api/ontologies/wbbt').then((r) => r.json());
const ontologyTerms = ontology.numberOfTerms;
if (!ontologyTerms) {
  throw new Error('OLS did not report a term count for wbbt');
}

await writeJson(DESTINATION, {
  source: {
    mod: MOD,
    species: SPECIES,
    release,
    // Not an Alliance release: there is no published file yet. Said here so
    // the component can say it too.
    origin: 'WormBase ACEDB Anatomy_function, via the anatomy function converter',
    linkmlVersion: ingest.linkml_version,
  },
  coverage: { terms: Object.keys(terms).length, ontologyTerms, annotations: Object.keys(annotations).length },
  annotations,
  terms,
  anatomy,
});

const counts = Object.values(terms).map((t) => t.totalAnnotations);
console.log(`${Object.keys(annotations).length} annotations from ${release}`);
console.log(`  ${counts.length} terms, ${Math.max(...counts)} rows on the busiest`);
console.log(
  `  ${counts.filter((n) => n === 1).length} terms with one row, ${counts.filter((n) => n >= 10).length} with ten or more`
);
if (missingLabels.size) {
  console.log(`  no label for ${missingLabels.size}, shown as the bare ID: ${[...missingLabels].sort().join(' ')}`);
}
console.log(`${DESTINATION}: ${fs.statSync(DESTINATION).size} bytes`);
