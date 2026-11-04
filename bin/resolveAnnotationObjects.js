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
export default async function resolveAnnotationObjects(ids, { isGene, records, alleleUrl, agmUrl }) {
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
      reagents.set(allele.primaryId, {
        // As the member writes it: `gukh<sup>142</sup>`, `3m76`. symbolText
        // exists but spells the same superscript `<142>`, which reads as a
        // different allele rather than as plain text.
        symbol: allele.symbol,
        gene: allele.alleleObjectRelations?.find((r) => r.objectRelation?.gene)?.objectRelation?.gene,
      });
    }
  }

  return { genes, models, reagents };
}
