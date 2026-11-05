import fs from 'fs';
import { createGunzip } from 'zlib';
import { Readable } from 'stream';

import streamJsonObjects from './streamJsonObjects.js';
import parsePhenotypeEntities from './parsePhenotypeEntities.js';
import resolveAnnotationObjects from './resolveAnnotationObjects.js';
import writeJson from './writeJson.js';

// The alleles, variations and transgenes whose phenotype reaches an anatomy
// term, so a reader can go from a structure to something they could obtain and
// work with.
//
// Same argument as the expression and phenotype samples: the Alliance holds
// this and publishes it, but can only be asked gene-first. The shape written
// below is a usable specification for /api/anatomy/{id}.
//
// Reagents arrive by the same route as phenotypes because they ARE the
// phenotype annotations' objects. The phenotype sample resolves each object
// back to a gene and shows the gene; this file stops one step earlier and
// shows the reagent. Nothing new is downloaded that the phenotype sample did
// not already read.
//
// What the Alliance does not publish is as much of the answer as what it does.
// There is no ANTIBODY, PROBE or IMAGE datatype in the FMS at all, so ZFIN's
// Thisse in situ probes and antibody labelling — the things its own term page
// shows under this heading — cannot be reached from here. What is published is
// ALLELE (FB, MGI, RGD, SGD, WB, ZFIN), AGM (the same six), CONSTRUCT (FB,
// MGI, WB, ZFIN), VARIATION and GENOTYPE. The section says so rather than
// implying these are all the reagents that exist.
//
// Xenbase is absent on purpose and is not an oversight: it scores every
// phenotype annotation against a gene directly, and the Alliance publishes no
// ALLELE file for either Xenopus species, so there is no reagent to show. That
// is a hide, not an empty table.
//
// Not wired into `npm run generators`: it downloads ~130 MB. Run it by hand.
//
//   node bin/build_anatomy_reagent_sample.js

const FMS = 'https://fms.alliancegenome.org/api/datafile/by';
const DESTINATION = 'public/anatomy-reagent-sample.json';

const REAGENTS_PER_TERM = 25;

// A reagent's kind comes from the member's own associationType, in
// bin/resolveAnnotationObjects.js, not from the shape of its identifier. The
// first version of this file guessed from the prefix and got ZFIN wrong: a
// `ZDB-ALT` is a point mutation or a transgenic insertion and the identifier
// does not say which.
const MEMBERS = {
  WB: {
    species: 'Caenorhabditis elegans',
    anatomy: 'WBbt',
    isGene: (id) => id.startsWith('WB:WBGene'),
    normalize: (curie) => curie.replace(/^WB:/, ''),
    via: {
      prefix: 'WBPhenotype',
      label: 'C. elegans Phenotype Ontology',
      owl: 'http://purl.obolibrary.org/obo/wbphenotype/wbphenotype-base.owl',
    },
  },
  FB: {
    species: 'Drosophila melanogaster',
    anatomy: 'FBbt',
    isGene: (id) => id.startsWith('FB:FBgn'),
  },
  ZFIN: {
    species: 'Danio rerio',
    anatomy: 'ZFA',
    isGene: (id) => /^ZFIN:ZDB-(GENE|[A-Z]*RNAG)-/.test(id),
  },
};

// The same terms as the phenotype sample, so the two tables on a page are cut
// from the same annotations and a reader can check one against the other.
const SAMPLE = {
  WB: ['WBbt:0005772', 'WBbt:0006748'],
  FB: ['FBbt:00004729', 'FBbt:00001882'],
  ZFIN: ['ZFA:0000135', 'ZFA:0000123'],
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
const agms = await latestFiles('AGM');
const constructs = await latestFiles('CONSTRUCT');
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
    wanted.map((curie) => [
      curie,
      { objects: new Map(), annotations: 0, toGene: 0, models: new Set(), modelsEmpty: new Set(), unresolved: 0 },
    ])
  );

  for await (const row of records(file.url)) {
    for (const curie of anatomyOf(row)) {
      if (!want.has(curie)) {
        continue;
      }
      const bucket = perTerm.get(curie);
      bucket.annotations += 1;
      bucket.objects.set(row.objectId, (bucket.objects.get(row.objectId) || 0) + 1);
    }
  }

  const objectIds = new Set([...perTerm.values()].flatMap((b) => [...b.objects.keys()]));
  const { genes, models, reagents } = await resolveAnnotationObjects(objectIds, {
    isGene: member.isGene,
    records,
    alleleUrl: alleles[mod]?.url,
    agmUrl: agms[mod]?.url,
    constructUrl: constructs[mod]?.url,
  });

  const symbols = new Map();
  const needed = new Set([...reagents.values()].map((r) => r.gene).filter(Boolean));
  if (needed.size && bgi[mod]) {
    for await (const gene of records(bgi[mod].url)) {
      const id = gene.basicGeneticEntity?.primaryId;
      if (needed.has(id)) {
        symbols.set(id, gene.symbol);
      }
    }
  }

  sources[mod] = { ...file, species: member.species, allele: alleles[mod], agm: agms[mod] };
  if (member.via) {
    sources[mod].via = member.via.label;
    sources[mod].viaVersion = definitions.get(member.via.owl).versionIri;
  }

  for (const [curie, bucket] of perTerm) {
    // A reagent earns a row whether it was scored directly or carried by a
    // model. The two are counted apart: `throughModels` is how many of a
    // reagent's annotations came to it through a genotype rather than from a
    // curator naming the reagent itself, and a reader weighing the row needs
    // to know which it is looking at.
    const byReagent = new Map();
    const add = (id, annotations, throughModel) => {
      const known = reagents.get(id);
      if (!known) {
        return false;
      }
      const entry = byReagent.get(id) || { annotations: 0, throughModels: 0, models: new Set() };
      entry.annotations += annotations;
      if (throughModel) {
        entry.throughModels += annotations;
        entry.models.add(throughModel);
      }
      byReagent.set(id, entry);
      return true;
    };

    for (const [objectId, annotations] of bucket.objects) {
      if (genes.has(objectId)) {
        bucket.toGene += annotations;
        continue;
      }
      const model = models.get(objectId);
      if (model) {
        bucket.models.add(objectId);
        const carried = model.alleles.filter((allele) => add(allele, annotations, objectId));
        if (!carried.length) {
          bucket.modelsEmpty.add(objectId);
          bucket.unresolved += annotations;
        }
        continue;
      }
      if (!add(objectId, annotations, null)) {
        bucket.unresolved += annotations;
      }
    }

    const ranked = [...byReagent]
      .map(([id, entry]) => {
        const { symbol, kind, gene, driver, constructName } = reagents.get(id);
        return {
          curie: id,
          symbol: symbol || id,
          kind,
          gene: gene ? { curie: gene, symbol: symbols.get(gene) || gene } : null,
          // The promoter the construct was driven from, where the thing it
          // expresses is not a gene of this species. Tg(-2.8fabp10a:EGFP)
          // implicates no zebrafish gene and is still worth seeing on liver:
          // it is a liver reporter line, which is what a reader asking what
          // is available here most wants to know.
          driver: driver || undefined,
          construct: constructName || undefined,
          annotations: entry.annotations,
          throughModels: entry.throughModels,
        };
      })
      .sort((a, b) => b.annotations - a.annotations || a.symbol.localeCompare(b.symbol));

    // Cut per kind rather than over the whole list. A mutation carries far
    // more annotations than a transgene does, so one list of the top 25 on
    // FBbt:00004729 is 25 mutations and the reader never learns the term has
    // transgenes at all. Each kind keeps its own total, which is what the
    // counts above the tables are for: the question "what is available here"
    // is answered by the totals, not by whichever rows fit.
    const kinds = [];
    for (const kind of ['mutation', 'transgene', 'other']) {
      const of = ranked.filter((reagent) => reagent.kind === kind);
      if (of.length) {
        kinds.push({
          kind,
          total: of.length,
          annotations: of.reduce((sum, reagent) => sum + reagent.annotations, 0),
          reagents: of.slice(0, REAGENTS_PER_TERM),
        });
      }
    }

    terms[curie] = {
      sources: [mod],
      species: member.species,
      route: member.via ? 'definition' : 'direct',
      via: member.via?.label,
      totalReagents: byReagent.size,
      totalAnnotations: bucket.annotations,
      toGene: bucket.toGene,
      models: bucket.models.size,
      modelsEmpty: bucket.modelsEmpty.size,
      unresolved: bucket.unresolved,
      kinds,
    };

    console.log(
      `  ${curie.padEnd(16)} ${String(bucket.annotations).padStart(6)} annotations  ` +
        `${String(byReagent.size).padStart(5)} reagents  ${String(bucket.toGene).padStart(5)} to a gene  ` +
        `${String(bucket.models.size).padStart(5)} models (${bucket.modelsEmpty.size} empty)  ` +
        `${String(bucket.unresolved).padStart(5)} unresolved  ` +
        kinds.map((k) => `${k.kind} ${k.total}`).join(', ')
    );
  }
}

await writeJson(DESTINATION, { reagentsPerTerm: REAGENTS_PER_TERM, sources, terms });
console.log(`\n${DESTINATION}: ${Object.keys(terms).length} terms, ${fs.statSync(DESTINATION).size} bytes`);
