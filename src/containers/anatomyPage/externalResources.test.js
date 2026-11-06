import toExternalResources from './externalResources.js';

// Inputs are shaped as src/lib/ols.js passes them through, and the values are
// real ones taken from OLS: FBbt:00007389 carries two DoOR and two
// FlyBrain_NDB references beside its VFB one, and FBbt:00003007 is the term
// whose xref is a bare CSIRO URL.
describe('toExternalResources', () => {
  it('builds the Virtual Fly Brain report URL from the underscored id', () => {
    expect(toExternalResources([{ database: 'VFB', id: 'FBbt_00001060' }])).toEqual([
      {
        key: 'VFB:FBbt_00001060',
        label: 'Virtual Fly Brain',
        href: 'https://www.virtualflybrain.org/reports/FBbt_00001060',
        rank: 0,
      },
    ]);
  });

  it("uses OLS's own resolver for FlyBrain NDB, and names the accession", () => {
    const url = 'https://flybrain-ndb.virtualflybrain.org/fmi/xsl/browserecord.xsl@-lay=NDB&Accession+number=10240';
    expect(toExternalResources([{ database: 'FlyBrain_NDB', id: '10240', url }])).toEqual([
      { key: 'FlyBrain_NDB:10240', label: 'FlyBrain NDB 10240', href: url, rank: 1 },
    ]);
  });

  it('names a bare-URL reference by its host, without the www', () => {
    const url = 'https://www.ento.csiro.au/biology/drosophila/melanogaster.html?head';
    expect(toExternalResources([{ id: url, url }])).toEqual([
      { key: `url:${url}`, label: 'ento.csiro.au', href: url, rank: 2 },
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

  it('orders by resource, then by label, and tolerates nothing at all', () => {
    const ndb = 'https://flybrain-ndb.virtualflybrain.org/x';
    const csiro = 'https://www.ento.csiro.au/y';
    const got = toExternalResources([
      { id: csiro, url: csiro },
      { database: 'FlyBrain_NDB', id: '10425', url: ndb },
      { database: 'FlyBrain_NDB', id: '10424', url: ndb },
      { database: 'VFB', id: 'FBbt_00007389' },
      { database: 'DoOR', id: 'Or98b' },
    ]);
    expect(got.map((r) => r.label)).toEqual([
      'Virtual Fly Brain',
      'FlyBrain NDB 10424',
      'FlyBrain NDB 10425',
      'ento.csiro.au',
    ]);
    expect(toExternalResources(undefined)).toEqual([]);
  });
});
