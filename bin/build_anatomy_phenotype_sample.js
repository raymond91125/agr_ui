import fs from 'fs';
import { createGunzip } from 'zlib';
import { Readable } from 'stream';

import streamJsonObjects from './streamJsonObjects.js';
import parsePhenotypeEntities from './parsePhenotypeEntities.js';
import writeJson from './writeJson.js';

// Real phenotype annotations for a handful of anatomy terms, so the section
// can be designed against what the data actually looks like.
//
// Same argument as bin/build_anatomy_expression_sample.js: the Alliance holds
// these annotations and publishes them through the FMS, but can only be asked
// about them gene-first, so a term-first table is built here instead. When
// /api/anatomy/{id} lands, this file and the page code that reads it both go,
// and the shape written below is a usable specification for it.
//
// Phenotype is harder than expression, because only two members put an anatomy
// term on the annotation at all:
//
//   ZFIN   ZFA on 85% of annotations     FlyBase  FBbt on 39%
//
// The rest submit a term from a pre-composed phenotype ontology, and the
// structure is in that term's logical definition. Reading those definitions
// out of the OWL reaches WormBase (WBbt, 17% of annotations) and Xenbase
// (XAO, 85%). Those two figures are floors: only 964 of WBPhenotype's 2,712
// terms carry a definition at all, and nothing below is inferred down the
// hierarchy, so a term whose parent names a structure does not inherit it.
//
// The two routes are kept apart in the output and said apart on the page:
// `direct` is the curator's own statement about this structure, `definition`
// is the phenotype ontology's.
//
// The other members are not here, and it is worth saying why rather than
// leaving them looking merely unfinished:
//
//   MGI, RGD  MP terms. MP's definitions name UBERON rather than EMAPA, so
//             mouse needs a second hop, through the same UBERON table the
//             UBERON Mapping section uses. That route does work — 7,013 MP
//             terms name a UBERON entity, which reaches 1,479 EMAPA terms and
//             40% of MGI's annotations — and it is left out because it is a
//             bigger decision than this file should make on its own. It is the
//             only route that chains two independent equivalences, MP's
//             definition and UBERON's xref; and an EMAPA term carries an
//             existence window that nothing on an MP annotation can be checked
//             against. EMAPA:32685 `endocardial tube` exists to TS18, and a
//             phenotype scored in an adult would land on it unremarked. That
//             is rare — one term in a hundred sampled stops before TS26 — but
//             it is silent when it happens.
//   SGD       APO. No anatomy axis, and no anatomy ontology for yeast.
//   HUMAN     HP. Its definitions name UBERON, which is the cross-species
//             page, where phenotype is a question about no species in
//             particular.
//
// Not wired into `npm run generators`: it downloads ~110 MB across fourteen
// files. Run it by hand.
//
//   node bin/build_anatomy_phenotype_sample.js

const FMS = 'https://fms.alliancegenome.org/api/datafile/by';
const DESTINATION = 'public/anatomy-phenotype-sample.json';

// How many genes to keep per term, matching the expression sample so the two
// sections on a page are cut the same way. The true totals are kept alongside
// so the page never implies the list is all of them.
const GENES_PER_TERM = 25;

// How many distinct phenotype statements to keep per gene.
const STATEMENTS_PER_GENE = 3;

const MEMBERS = {
  WB: {
    species: 'Caenorhabditis elegans',
    anatomy: 'WBbt',
    isGene: (id) => id.startsWith('WB:WBGene'),
    // WormBase cites its phenotype terms as `WB:WBPhenotype:0000505`.
    normalize: (curie) => curie.replace(/^WB:/, ''),
    via: {
      prefix: 'WBPhenotype',
      label: 'C. elegans Phenotype Ontology',
      owl: 'http://purl.obolibrary.org/obo/wbphenotype/wbphenotype-base.owl',
    },
  },
  FB: { species: 'Drosophila melanogaster', anatomy: 'FBbt', isGene: (id) => id.startsWith('FB:FBgn') },
  // ZFIN scores a handful of annotations against a non-coding gene, whose
  // identifier says MIRNAG, LINCRNAG or SNORNAG where a protein-coding one
  // says GENE. They are genes and have gene pages.
  ZFIN: { species: 'Danio rerio', anatomy: 'ZFA', isGene: (id) => /^ZFIN:ZDB-(GENE|[A-Z]*RNAG)-/.test(id) },
  XBXL: {
    species: 'Xenopus laevis',
    anatomy: 'XAO',
    isGene: (id) => id.startsWith('Xenbase:XB-GENE-'),
    via: {
      prefix: 'XPO',
      label: 'Xenopus Phenotype Ontology',
      owl: 'http://purl.obolibrary.org/obo/xpo/xpo-base.owl',
    },
  },
  XBXT: {
    species: 'Xenopus tropicalis',
    anatomy: 'XAO',
    isGene: (id) => id.startsWith('Xenbase:XB-GENE-'),
    via: {
      prefix: 'XPO',
      label: 'Xenopus Phenotype Ontology',
      owl: 'http://purl.obolibrary.org/obo/xpo/xpo-base.owl',
    },
  },
};

// Two terms per member. Six of the eight are already in the expression sample,
// so those pages carry both tables and can be read against each other.
//
// Xenopus could not keep the expression pair: XAO:0000177 and XAO:0000132 are
// two of the nineteen system-level terms Xenbase's expression submission is
// rolled up to, and no phenotype annotation reaches either.
const SAMPLE = {
  WB: ['WBbt:0005772', 'WBbt:0006748'],
  FB: ['FBbt:00004729', 'FBbt:00001882'],
  ZFIN: ['ZFA:0000135', 'ZFA:0000123'],
  XBXL: ['XAO:0000179', 'XAO:0003026'],
  XBXT: ['XAO:0000179', 'XAO:0003026'],
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

// XPO is read once although two Xenopus files use it.
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
    console.log(`  ${via.prefix}: ${Object.keys(map).length} terms define a ${entityPrefix} entity (${versionIri})`);
    definitions.set(via.owl, { versionIri, map });
  }
  return definitions.get(via.owl);
}

const phenotypes = await latestFiles('PHENOTYPE');
const alleles = await latestFiles('ALLELE');
const bgi = await latestFiles('BGI');
const terms = {};
const sources = {};

for (const [mod, wanted] of Object.entries(SAMPLE)) {
  const member = MEMBERS[mod];
  const file = phenotypes[mod];
  if (!file) {
    throw new Error(`no PHENOTYPE file published for ${mod}`);
  }
  console.log(`\n${mod} (${member.species})`);

  const defined = member.via ? (await phenotypeEntities(member.via, member.anatomy)).map : null;
  const normalize = member.normalize || ((curie) => curie);
  const anatomyOf = (row) => {
    const cited = (row.phenotypeTermIdentifiers || []).map((t) => normalize(t.termId));
    return [...new Set(defined ? cited.flatMap((curie) => defined[curie] || []) : cited)].filter((curie) =>
      curie.startsWith(`${member.anatomy}:`)
    );
  };

  const want = new Set(wanted);
  const perTerm = new Map(
    wanted.map((curie) => [curie, { objects: new Map(), annotations: 0, unattributed: 0, statements: new Set() }])
  );

  for await (const row of records(file.url)) {
    for (const curie of anatomyOf(row)) {
      if (!want.has(curie)) {
        continue;
      }
      const bucket = perTerm.get(curie);
      bucket.annotations += 1;
      bucket.statements.add(row.phenotypeStatement);
      const object = bucket.objects.get(row.objectId) || { annotations: 0, statements: new Set() };
      object.annotations += 1;
      if (row.phenotypeStatement) {
        object.statements.add(row.phenotypeStatement);
      }
      bucket.objects.set(row.objectId, object);
    }
  }

  // An annotation is made against whatever the member scores: a gene, an
  // allele, a transgene, or — at ZFIN — a fish, which is a genotype plus the
  // conditions it was raised in. Alleles resolve to their gene through the
  // Alliance allele file. Fish and transgenes do not resolve through any
  // published file, so they are counted and dropped rather than guessed at.
  const unresolved = new Set([...perTerm.values()].flatMap((b) => [...b.objects.keys()]));
  const geneOf = new Map();
  for (const id of unresolved) {
    if (member.isGene(id)) {
      geneOf.set(id, id);
    }
  }
  if (alleles[mod]) {
    for await (const allele of records(alleles[mod].url)) {
      if (!unresolved.has(allele.primaryId) || geneOf.has(allele.primaryId)) {
        continue;
      }
      const gene = allele.alleleObjectRelations?.find((r) => r.objectRelation?.gene)?.objectRelation?.gene;
      if (gene) {
        geneOf.set(allele.primaryId, gene);
      }
    }
  }

  const symbols = new Map();
  const needed = new Set(geneOf.values());
  if (needed.size && bgi[mod]) {
    for await (const gene of records(bgi[mod].url)) {
      const id = gene.basicGeneticEntity?.primaryId;
      if (needed.has(id)) {
        symbols.set(id, gene.symbol);
      }
    }
  }

  sources[mod] = { ...file, species: member.species };
  if (member.via) {
    sources[mod].via = member.via.label;
    sources[mod].viaVersion = definitions.get(member.via.owl).versionIri;
  }

  for (const [curie, bucket] of perTerm) {
    // Several alleles of one gene are several annotations about that gene, so
    // the counts add up as the objects collapse.
    const byGene = new Map();
    for (const [objectId, object] of bucket.objects) {
      const gene = geneOf.get(objectId);
      if (!gene) {
        bucket.unattributed += object.annotations;
        continue;
      }
      const entry = byGene.get(gene) || { annotations: 0, statements: new Set() };
      entry.annotations += object.annotations;
      for (const statement of object.statements) {
        entry.statements.add(statement);
      }
      byGene.set(gene, entry);
    }

    const ranked = [...byGene]
      .map(([id, g]) => ({
        curie: id,
        symbol: symbols.get(id) || id,
        annotations: g.annotations,
        phenotypes: [...g.statements].sort().slice(0, STATEMENTS_PER_GENE),
      }))
      // Most-annotated first, then by symbol so the file is reproducible.
      .sort((a, b) => b.annotations - a.annotations || a.symbol.localeCompare(b.symbol));

    // One ontology, two species: XAO terms are submitted by both Xenopus
    // files, so a term already seen keeps its rows and gains these.
    const entry = terms[curie] || {
      sources: [],
      route: member.via ? 'definition' : 'direct',
      via: member.via?.label,
      totalGenes: 0,
      totalAnnotations: 0,
      unattributed: 0,
      genes: [],
    };
    entry.sources.push(mod);
    entry.totalGenes += byGene.size;
    entry.totalAnnotations += bucket.annotations;
    entry.unattributed += bucket.unattributed;
    entry.genes = [...entry.genes, ...ranked.slice(0, GENES_PER_TERM).map((g) => ({ ...g, species: member.species }))]
      .sort((a, b) => b.annotations - a.annotations || a.symbol.localeCompare(b.symbol))
      .slice(0, GENES_PER_TERM);
    terms[curie] = entry;

    console.log(
      `  ${curie.padEnd(16)} ${String(bucket.annotations).padStart(6)} annotations  ${String(byGene.size).padStart(5)} genes  ` +
        `${String(bucket.statements.size).padStart(5)} statements  ${String(bucket.unattributed).padStart(5)} unattributed`
    );
  }
}

await writeJson(DESTINATION, { genesPerTerm: GENES_PER_TERM, sources, terms });
console.log(`\n${DESTINATION}: ${Object.keys(terms).length} terms, ${fs.statSync(DESTINATION).size} bytes`);
