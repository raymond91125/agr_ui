import toExternalResources, { toVocabularyXrefs } from './externalResources.js';

// Inputs are shaped as src/lib/ols.js passes them through, and the values are
// real ones taken from OLS: FBbt:00007389 carries two DoOR and two
// FlyBrain_NDB references beside its VFB one, and FBbt:00003007 is the term
// whose xref is a bare CSIRO URL.
describe('toExternalResources', () => {
  it('builds the Virtual Fly Brain report URL from the underscored id', () => {
    expect(toExternalResources([{ database: 'VFB', id: 'FBbt_00001060' }])).toEqual([
      {
        key: 'VFB',
        label: 'Virtual Fly Brain',
        rank: 0,
        links: [
          {
            key: 'VFB:FBbt_00001060',
            name: 'FBbt_00001060',
            href: 'https://www.virtualflybrain.org/reports/FBbt_00001060',
          },
        ],
      },
    ]);
  });

  it("uses OLS's own resolver for FlyBrain NDB", () => {
    const url = 'https://flybrain-ndb.virtualflybrain.org/fmi/xsl/browserecord.xsl@-lay=NDB&Accession+number=10240';
    expect(toExternalResources([{ database: 'FlyBrain_NDB', id: '10240', url }])).toEqual([
      {
        key: 'FLYBRAIN_NDB',
        label: 'FlyBrain NDB',
        rank: 1,
        links: [{ key: 'FLYBRAIN_NDB:10240', name: '10240', href: url }],
      },
    ]);
  });

  it('names a bare-URL reference by its host, without the www', () => {
    const url = 'https://www.ento.csiro.au/biology/drosophila/melanogaster.html?head';
    expect(toExternalResources([{ id: url, url }])).toEqual([
      {
        key: 'url:ento.csiro.au',
        label: 'ento.csiro.au',
        rank: 2,
        links: [{ key: `url:ento.csiro.au:${url}`, name: url, href: url }],
      },
    ]);
  });

  // The allowlist is the whole point: these are real references FlyBase keeps
  // and does not resolve, to hosts that no longer answer.
  it('drops a resource that is not on the allowlist', () => {
    expect(toExternalResources([{ database: 'DoOR', id: 'Or85b' }])).toEqual([]);
    expect(toExternalResources([{ database: 'larvalbrain_neuropil', id: '392' }])).toEqual([]);
  });

  it('drops an allowlisted resource that has no URL from either side', () => {
    expect(toExternalResources([{ database: 'FlyBrain_NDB', id: '10240' }])).toEqual([]);
  });

  it('drops a bare reference whose id is not a URL', () => {
    expect(toExternalResources([{ id: 'something' }])).toEqual([]);
  });

  it('orders the resource the member leads with first, then by label', () => {
    const ndb = 'https://flybrain-ndb.virtualflybrain.org/x';
    const csiro = 'https://www.ento.csiro.au/y';
    const got = toExternalResources([
      { id: csiro, url: csiro },
      { database: 'FlyBrain_NDB', id: '10425', url: ndb },
      { database: 'VFB', id: 'FBbt_00007389' },
      { database: 'DoOR', id: 'Or98b' },
    ]);
    expect(got.map((r) => r.label)).toEqual(['Virtual Fly Brain', 'FlyBrain NDB', 'ento.csiro.au']);
    expect(toExternalResources(undefined)).toEqual([]);
  });
});

// Several links into one resource. The values are AVM's, WBbt:0003832, as
// bin/build_anatomy_wbbt_resources.js writes them.
describe('grouping', () => {
  const avm = [
    {
      database: 'WormAtlas',
      id: 'neurons/Individual Neurons/AVMframeset.html',
      name: 'AVM',
      url: 'https://wormatlas.org/neurons/Individual%20Neurons/AVMframeset.html',
    },
    {
      database: 'WormAtlas',
      id: 'neurons/Individual Neurons/Neuronframeset.html',
      name: 'individual neurons',
      url: 'https://wormatlas.org/neurons/Individual%20Neurons/Neuronframeset.html',
    },
    { database: 'Neuralnet', id: 'c=AVM&m=0', name: 'individual cells', url: 'http://wormweb.org/neuralnet#c=AVM&m=0' },
    { database: 'Neuralnet', id: 'c=AVM&m=1', name: 'groups of cells', url: 'http://wormweb.org/neuralnet#c=AVM&m=1' },
    { database: 'NemaNode', id: 'AVM', url: 'https://nemanode.org/?in=AVM' },
    { database: 'WormWiring', id: 'N2U', cell: 'AVM', url: 'https://wormwiring.org/apps/neuronMaps/?db=N2U&cell=AVM' },
    { database: 'WormWiring', id: 'JSH', cell: 'AVM', url: 'https://wormwiring.org/apps/neuronMaps/?db=JSH&cell=AVM' },
    { database: 'ZhenLab3D', id: 'AVM', url: 'https://zhen-tools.com/#/3d-viewer?neurons=AVM' },
  ];

  it('gives each resource one entry, WormAtlas first and the rest by label', () => {
    expect(toExternalResources(avm).map((r) => r.label)).toEqual([
      'WormAtlas',
      'NemaNode',
      'Neuralnet',
      'WormWiring',
      'Zhen Lab 3D Neuron Viewer',
    ]);
  });

  it('keeps every link, named by what distinguishes it, in a stable order', () => {
    const groups = Object.fromEntries(toExternalResources(avm).map((r) => [r.label, r.links.map((l) => l.name)]));
    expect(groups).toEqual({
      WormAtlas: ['AVM', 'individual neurons'],
      Neuralnet: ['groups of cells', 'individual cells'],
      WormWiring: ['JSH', 'N2U'],
      NemaNode: ['AVM'],
      'Zhen Lab 3D Neuron Viewer': ['AVM'],
    });
  });

  it('falls back to the identifier when the member gives no name', () => {
    const ndb = 'https://flybrain-ndb.virtualflybrain.org/';
    const got = toExternalResources([
      { database: 'FlyBrain_NDB', id: '10425', url: `${ndb}b` },
      { database: 'FlyBrain_NDB', id: '10424', url: `${ndb}a` },
    ]);
    expect(got[0].links.map((l) => l.name)).toEqual(['10424', '10425']);
  });

  it('shows one link once, however many times the member records it', () => {
    const url = 'https://wormatlas.org/hermaphrodite/intestine/Intframeset.html';
    const entry = { database: 'WormAtlas', id: 'hermaphrodite/intestine/Intframeset.html', name: 'intestine', url };
    expect(toExternalResources([entry, { ...entry }])[0].links).toHaveLength(1);
  });
});

// UBERON's half of the same slot. Values are real: UBERON:0000955 brain
// carries all of these, and `Eye#Simple_eyes` is one of the 139 Wikipedia
// references that point at a section rather than a whole article.
describe('toVocabularyXrefs', () => {
  it('keeps a mapping into another controlled vocabulary, with its resolver', () => {
    const url = 'http://purl.org/sig/ont/fma/50801';
    expect(toVocabularyXrefs([{ database: 'FMA', id: '50801', url }])).toEqual([{ curie: 'FMA:50801', url }]);
  });

  it('keeps a mapping that OLS cannot resolve, so it can render as text', () => {
    expect(toVocabularyXrefs([{ database: 'galen', id: 'Brain' }])).toEqual([{ curie: 'galen:Brain', url: undefined }]);
  });

  it('leaves Wikipedia to the resources row, in all three of its forms', () => {
    const refs = [
      { database: 'Wikipedia', id: 'Brain' },
      { database: 'WikipediaCategory', id: 'Brain' },
      { database: 'WikipediaVersioned', id: 'Brain' },
    ];
    expect(toVocabularyXrefs(refs)).toEqual([]);
    expect(toExternalResources(refs)[0].links.map((l) => l.href)).toEqual(['https://en.wikipedia.org/wiki/Brain']);
  });

  it('builds a Wikipedia URL that keeps a section anchor', () => {
    expect(toExternalResources([{ database: 'Wikipedia', id: 'Eye#Simple_eyes' }])[0].links[0].href).toBe(
      'https://en.wikipedia.org/wiki/Eye#Simple_eyes'
    );
  });

  it('drops upper ontologies, OBO metadata and retired mappings', () => {
    const refs = [
      { database: 'BFO', id: '0000040' },
      { database: 'UBPROP', id: '0000001' },
      { database: 'RETIRED_EHDAA2', id: '0002012' },
      { database: 'ZFA_RETIRED', id: '0000008' },
    ];
    expect(toVocabularyXrefs(refs)).toEqual([]);
  });

  it('leaves the WormBase resources out of the cross-reference row', () => {
    const refs = [
      { database: 'WormAtlas', id: 'hermaphrodite/intestine/Intframeset.html' },
      { database: 'NemaNode', id: 'AVM' },
    ];
    expect(toVocabularyXrefs(refs)).toEqual([]);
  });

  it('tolerates nothing at all, and a bare URL belongs to the other row', () => {
    expect(toVocabularyXrefs(undefined)).toEqual([]);
    expect(toVocabularyXrefs([{ id: 'https://example.org/x', url: 'https://example.org/x' }])).toEqual([]);
  });
});
