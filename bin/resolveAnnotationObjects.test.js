import assert from 'assert';

import resolveAnnotationObjects from './resolveAnnotationObjects.js';

// Keyed by the url the generator would pass, so a test can assert which files
// were read as well as what came back.
const FILES = {
  agm: [
    {
      primaryID: 'ZFIN:ZDB-FISH-1',
      name: 'lama1<sup>a/a</sup>',
      affectedGenomicModelComponents: [{ alleleID: 'ZFIN:ZDB-ALT-1' }, { alleleID: 'ZFIN:ZDB-ALT-2' }],
    },
    // A fish that is a background and a set of conditions, nothing more.
    { primaryID: 'ZFIN:ZDB-FISH-2', name: 'AB', affectedGenomicModelComponents: [] },
    { primaryID: 'ZFIN:ZDB-FISH-3', name: 'never asked for' },
  ],
  construct: [
    {
      primaryId: 'ZFIN:ZDB-TGCONSTRCT-1',
      name: 'Tg(TETRE:EGFP-kras)',
      constructComponents: [
        { componentRelation: 'is_regulated_by', componentSymbol: 'fabp10a', componentID: 'ZFIN:ZDB-GENE-fabp10a' },
        { componentRelation: 'expresses', componentSymbol: 'EGFP' },
        { componentRelation: 'expresses', componentSymbol: 'kras', componentID: 'ZFIN:ZDB-GENE-kras' },
      ],
    },
    {
      primaryId: 'ZFIN:ZDB-TGCONSTRCT-2',
      name: 'Tg(-2.8fabp10a:EGFP)',
      constructComponents: [
        { componentRelation: 'is_regulated_by', componentSymbol: 'fabp10a', componentID: 'ZFIN:ZDB-GENE-fabp10a' },
        { componentRelation: 'expresses', componentSymbol: 'EGFP' },
      ],
    },
  ],
  allele: [
    {
      primaryId: 'ZFIN:ZDB-ALT-1',
      symbol: 'lama1<sup>a</sup>',
      alleleObjectRelations: [{ objectRelation: { associationType: 'allele_of', gene: 'ZFIN:ZDB-GENE-1' } }],
    },
    // Carried by a fish rather than scored directly, and still resolved.
    {
      primaryId: 'ZFIN:ZDB-ALT-2',
      symbol: 'lamc1<sup>b</sup>',
      alleleObjectRelations: [{ objectRelation: { associationType: 'allele_of', gene: 'ZFIN:ZDB-GENE-2' } }],
    },
    // A transgenic insertion with no gene relation of its own.
    { primaryId: 'ZFIN:ZDB-ALT-3', symbol: 'Tg(x)', alleleObjectRelations: [] },
    // Same identifier shape as the mutations above, and not a mutation: the
    // member says it carries the gene rather than damaging it.
    {
      primaryId: 'ZFIN:ZDB-ALT-4',
      symbol: 'gz32Tg',
      alleleObjectRelations: [{ objectRelation: { associationType: 'contains', gene: 'ZFIN:ZDB-GENE-3' } }],
    },
    // Both relations at once; the lesion is the stronger claim and wins.
    {
      primaryId: 'ZFIN:ZDB-ALT-5',
      symbol: 'both',
      alleleObjectRelations: [
        { objectRelation: { associationType: 'contains', gene: 'ZFIN:ZDB-GENE-4' } },
        { objectRelation: { associationType: 'allele_of', gene: 'ZFIN:ZDB-GENE-5' } },
      ],
    },
    {
      primaryId: 'ZFIN:ZDB-ALT-6',
      symbol: 'kTg',
      alleleObjectRelations: [{ objectRelation: { associationType: 'contains', construct: 'ZFIN:ZDB-TGCONSTRCT-1' } }],
    },
    {
      primaryId: 'ZFIN:ZDB-ALT-7',
      symbol: 'as3Tg',
      alleleObjectRelations: [{ objectRelation: { associationType: 'contains', construct: 'ZFIN:ZDB-TGCONSTRCT-2' } }],
    },
    { primaryId: 'ZFIN:ZDB-ALT-9', symbol: 'never asked for' },
  ],
};

const read = [];
async function* records(url) {
  read.push(url);
  yield* FILES[url];
}

const isGene = (id) => id.startsWith('ZFIN:ZDB-GENE-');

describe('resolveAnnotationObjects', () => {
  const run = (ids, options = {}) =>
    resolveAnnotationObjects(new Set(ids), { isGene, records, alleleUrl: 'allele', agmUrl: 'agm', ...options });

  it('keeps a gene as its own answer', async () => {
    const { genes, models, reagents } = await run(['ZFIN:ZDB-GENE-1']);
    assert.deepEqual([...genes], ['ZFIN:ZDB-GENE-1']);
    assert.equal(models.size, 0);
    assert.equal(reagents.size, 0);
  });

  it('resolves an allele to its gene', async () => {
    const { reagents } = await run(['ZFIN:ZDB-ALT-1']);
    const reagent = reagents.get('ZFIN:ZDB-ALT-1');
    assert.equal(reagent.symbol, 'lama1<sup>a</sup>');
    assert.equal(reagent.kind, 'mutation');
    assert.equal(reagent.gene, 'ZFIN:ZDB-GENE-1');
    // A lesion names its gene outright, so no construct is looked for.
    assert.equal(reagent.construct, undefined);
  });

  it('calls a reagent that carries a gene a transgene, not an allele', async () => {
    const { reagents } = await run(['ZFIN:ZDB-ALT-4']);
    const reagent = reagents.get('ZFIN:ZDB-ALT-4');
    assert.equal(reagent.symbol, 'gz32Tg');
    assert.equal(reagent.kind, 'transgene');
    assert.equal(reagent.gene, 'ZFIN:ZDB-GENE-3');
  });

  it('prefers the lesion when a reagent is both', async () => {
    const { reagents } = await run(['ZFIN:ZDB-ALT-5']);
    assert.equal(reagents.get('ZFIN:ZDB-ALT-5').kind, 'mutation');
    assert.equal(reagents.get('ZFIN:ZDB-ALT-5').gene, 'ZFIN:ZDB-GENE-5');
  });

  it('resolves a model to the alleles it carries, and those to their genes', async () => {
    const { models, reagents } = await run(['ZFIN:ZDB-FISH-1']);
    assert.deepEqual(models.get('ZFIN:ZDB-FISH-1').alleles, ['ZFIN:ZDB-ALT-1', 'ZFIN:ZDB-ALT-2']);
    // Neither allele was scored directly; both are resolved because the fish
    // named them.
    assert.equal(reagents.get('ZFIN:ZDB-ALT-2').gene, 'ZFIN:ZDB-GENE-2');
  });

  it('reports a model with no components rather than dropping it', async () => {
    const { models } = await run(['ZFIN:ZDB-FISH-2']);
    assert.deepEqual(models.get('ZFIN:ZDB-FISH-2'), { name: 'AB', alleles: [] });
  });

  it('keeps a reagent that resolves to no gene', async () => {
    const { reagents } = await run(['ZFIN:ZDB-ALT-3']);
    assert.equal(reagents.get('ZFIN:ZDB-ALT-3').symbol, 'Tg(x)');
    assert.equal(reagents.get('ZFIN:ZDB-ALT-3').kind, 'other');
    assert.equal(reagents.get('ZFIN:ZDB-ALT-3').gene, undefined);
  });

  it('reads nothing it was not asked for', async () => {
    const { models, reagents } = await run(['ZFIN:ZDB-ALT-1']);
    assert.equal(models.has('ZFIN:ZDB-FISH-3'), false);
    assert.equal(reagents.has('ZFIN:ZDB-ALT-9'), false);
  });

  it('takes the gene a construct expresses, not the promoter it is driven from', async () => {
    const { reagents } = await run(['ZFIN:ZDB-ALT-6'], { constructUrl: 'construct' });
    const reagent = reagents.get('ZFIN:ZDB-ALT-6');
    assert.equal(reagent.kind, 'transgene');
    assert.equal(reagent.gene, 'ZFIN:ZDB-GENE-kras');
    assert.equal(reagent.driver, 'fabp10a');
    assert.equal(reagent.constructName, 'Tg(TETRE:EGFP-kras)');
  });

  it('leaves a reporter without a gene and names only its driver', async () => {
    const { reagents } = await run(['ZFIN:ZDB-ALT-7'], { constructUrl: 'construct' });
    const reagent = reagents.get('ZFIN:ZDB-ALT-7');
    // EGFP is expressed but is not a gene of this species, so it has no id
    // and the reagent is evidence about no gene at all.
    assert.equal(reagent.gene, undefined);
    assert.equal(reagent.driver, 'fabp10a');
  });

  it('skips the AGM file when the member publishes none', async () => {
    read.length = 0;
    const { models } = await run(['ZFIN:ZDB-ALT-1'], { agmUrl: undefined });
    assert.equal(models.size, 0);
    assert.deepEqual(read, ['allele']);
  });
});
