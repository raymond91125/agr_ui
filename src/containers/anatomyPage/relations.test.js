import assert from 'assert';

import groupRelations from './relations.js';
import stageRange from './stageRange.js';

const WBBT = { curiePrefix: 'WBbt', stageSeries: undefined };

const edge = (direction, relation, curie, name, property = 'x') => ({
  direction,
  relation,
  curie,
  name,
  property,
});

// WBbt:0001340 as OLS serves it, which is the case the import filter exists
// for: every lineage nucleus declares an upper-ontology parent and a GO parent
// alongside its real one.
const NUCLEUS_EDGES = [
  edge('out', 'is a', 'BFO:0000002', 'continuant', 'rdf-schema#subClassOf'),
  edge('out', 'is a', 'GO:0005634', 'nucleus', 'rdf-schema#subClassOf'),
  edge('out', 'is a', 'WBbt:0006803', 'Nucleus', 'rdf-schema#subClassOf'),
  edge('out', 'child nucleus of', 'WBbt:0001338', 'ABplaapap nucleus'),
  edge('out', 'part of', 'WBbt:0006586', 'ABplaapapp', 'BFO_0000050'),
  edge('in', 'child nucleus of', 'WBbt:0001341', 'ABplaapappp nucleus'),
];

describe('groupRelations', () => {
  const { out, in: incoming } = groupRelations(NUCLEUS_EDGES, WBBT);

  it('drops imported parents from the hierarchy', () => {
    const isA = out.find((group) => group.relation === 'is a');
    assert.deepEqual(
      isA.terms.map((term) => term.curie),
      ['WBbt:0006803']
    );
  });

  it('keeps a relation that is not the hierarchy whatever it points at', () => {
    // UBERON asserts `site_of` into GO and `in taxon` into NCBITaxon. Filtering
    // those would hide the statement rather than tidy the list.
    const uberon = { curiePrefix: 'UBERON' };
    const edges = [edge('out', 'site_of', 'GO:0005978', 'glycogen biosynthetic process')];
    assert.equal(groupRelations(edges, uberon).out[0].relation, 'site_of');
  });

  it('sorts the hierarchy ahead of everything else', () => {
    assert.deepEqual(
      out.map((group) => group.relation),
      ['is a', 'part of', 'child nucleus of']
    );
  });

  it('separates the two directions', () => {
    assert.deepEqual(
      incoming.map((group) => group.relation),
      ['child nucleus of']
    );
  });

  it('leaves out the stage range, which has a section of its own', () => {
    const zfa = { curiePrefix: 'ZFA' };
    const edges = [
      edge('out', 'existence starts during or after', 'ZFS:0000022', 'gastrula:bud', 'RO_0002496'),
      edge('out', 'existence ends during or before', 'ZFS:0000044', 'adult', 'RO_0002497'),
    ];
    assert.equal(groupRelations(edges, zfa), null);
  });
});

describe('stageRange', () => {
  const start = edge('out', 'existence starts with', 'TS:17', 'TS17', 'RO_0002489');
  const end = edge('out', 'existence ends with', 'TS:28', 'TS28', 'RO_0002493');

  it('reads both ends off the graph', () => {
    const range = stageRange([edge('out', 'part of', 'EMAPA:16470', 'central nervous system'), start, end]);
    assert.equal(range.start.name, 'TS17');
    assert.equal(range.end.name, 'TS28');
  });

  it('returns nothing when only one end is asserted', () => {
    // Half a range is not a window, and rendering it would read as a claim
    // that the structure persists to the end of development.
    assert.equal(stageRange([start]), null);
  });

  it('ignores a stage relation that another term asserts', () => {
    assert.equal(stageRange([{ ...start, direction: 'in' }, end]), null);
  });
});
