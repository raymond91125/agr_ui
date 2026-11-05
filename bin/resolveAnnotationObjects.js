// What a phenotype annotation was actually made against, and which genes that
// implicates.
//
// A member scores whatever it keeps in its collection: a gene, an allele, a
// variation, a transgene, or — at ZFIN — a fish, which is a genotype raised
// under stated conditions. Only the gene case is already an answer; the rest
// have to be resolved through the files the Alliance publishes beside the
// annotations.
//
//   allele, variation, transgene   ALLELE_{mod}, alleleObjectRelations[].objectRelation.gene
//   fish, genotype, strain         AGM_{mod}, affectedGenomicModelComponents[].alleleID,
//                                  then each of those through ALLELE_{mod}
//
// The AGM hop was missed the first time this was written, and the Phenotypes
// section said no published file resolved a fish at all. It does: over the two
// ZFA sample terms the chain recovers 3,694 of the 7,936 annotations that were
// being counted and dropped. What is genuinely unresolvable is narrower — 604
// of the 2,578 fish carry no allele components whatsoever, being a background
// plus conditions, and some of the alleles they do carry have no gene relation
// of their own.
export default async function resolveAnnotationObjects(ids, { isGene, records, alleleUrl, agmUrl, constructUrl }) {
  const genes = new Set([...ids].filter(isGene));

  // Models first, because their components are alleles the ALLELE pass has to
  // look for as well as the objects scored directly.
  const models = new Map();
  if (agmUrl) {
    for await (const model of records(agmUrl)) {
      if (!ids.has(model.primaryID) || genes.has(model.primaryID)) {
        continue;
      }
      models.set(model.primaryID, {
        name: model.name,
        alleles: (model.affectedGenomicModelComponents || []).map((c) => c.alleleID).filter(Boolean),
      });
    }
  }

  const wanted = new Set([...ids].filter((id) => !genes.has(id) && !models.has(id)));
  for (const { alleles } of models.values()) {
    for (const allele of alleles) {
      wanted.add(allele);
    }
  }

  const reagents = new Map();
  if (alleleUrl && wanted.size) {
    for await (const allele of records(alleleUrl)) {
      if (!wanted.has(allele.primaryId)) {
        continue;
      }
      // What kind of reagent this is, from the member's own word for the
      // relation rather than from the shape of its identifier. `allele_of` is
      // a lesion in the gene; `contains` is a transgene or construct that
      // carries it. The two are not interchangeable as evidence, and the
      // identifier cannot tell them apart: a ZFIN `ZDB-ALT` is either, and
      // guessing from the prefix called every one of them an allele.
      //
      // WormBase labels the same split a second way, in crossReferences pages
      // — 1,704 `transgene` against 9,684 `allele` — and the two agree, which
      // is why associationType is trusted for the members that have only it.
      const relations = (allele.alleleObjectRelations || []).map((r) => r.objectRelation).filter(Boolean);
      const lesion = relations.find((r) => r.associationType === 'allele_of' && r.gene);
      const carries = relations.find((r) => r.associationType === 'contains');
      reagents.set(allele.primaryId, {
        // As the member writes it: `gukh<sup>142</sup>`, `3m76`. symbolText
        // exists but spells the same superscript `<142>`, which reads as a
        // different allele rather than as plain text.
        symbol: allele.symbol,
        kind: lesion ? 'mutation' : carries ? 'transgene' : 'other',
        gene: (lesion || relations.find((r) => r.gene))?.gene,
        // A transgene usually names a construct rather than a gene, and the
        // gene is a step further on. Without this the reagent looks like it
        // implicates nothing, which is how 80 of FBbt:00004729's and 258 of
        // ZFA:0000123's came to be filed under `other`.
        construct: lesion ? undefined : carries?.construct,
      });
    }
  }

  // Construct components, for the transgenes that named one. The relation on
  // each component decides whether it may be used: `expresses` is the gene the
  // construct puts into the animal, and is the one a phenotype is about;
  // `is_regulated_by` is only the promoter it was driven from, and attributing
  // a phenotype to the driver would name the wrong gene. So the two are kept
  // apart and only the first is treated as the reagent's gene.
  const wantConstructs = new Set([...reagents.values()].map((r) => r.construct).filter(Boolean));
  const constructs = new Map();
  if (constructUrl && wantConstructs.size) {
    for await (const construct of records(constructUrl)) {
      if (!wantConstructs.has(construct.primaryId)) {
        continue;
      }
      const components = construct.constructComponents || [];
      constructs.set(construct.primaryId, {
        name: construct.name,
        expresses: components.filter((c) => c.componentRelation === 'expresses' && c.componentID),
        regulatedBy: components.filter((c) => c.componentRelation === 'is_regulated_by' && c.componentID),
      });
    }
  }

  for (const reagent of reagents.values()) {
    const construct = reagent.construct && constructs.get(reagent.construct);
    if (!construct) {
      continue;
    }
    reagent.constructName = construct.name;
    reagent.gene = reagent.gene || construct.expresses[0]?.componentID;
    reagent.driver = construct.regulatedBy[0]?.componentSymbol;
  }

  return { genes, models, reagents, constructs };
}
