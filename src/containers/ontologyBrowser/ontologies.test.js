import { ONTOLOGIES, wormbaseAnatomyUrl } from './ontologies.js';

const byId = (id) => ONTOLOGIES.find((ontology) => ontology.id === id);

// WormBase loads a term page one widget at a time, so where a link lands
// matters more than it does elsewhere: without a widget the reader arrives at
// a page whose relevant part is closed. The indices were read off the live
// page and are asserted here so a change to them is a failing test rather
// than a link that quietly opens the wrong thing.
describe('wormbaseAnatomyUrl', () => {
  const base = 'https://www.wormbase.org/species/all/anatomy_term/WBbt:0005772';

  it('opens the widget that answers the section', () => {
    expect(wormbaseAnatomyUrl('WBbt:0005772', 'overview')).toBe(`${base}#0--10`);
    expect(wormbaseAnatomyUrl('WBbt:0005772', 'associations')).toBe(`${base}#1--10`);
    expect(wormbaseAnatomyUrl('WBbt:0005772', 'markers')).toBe(`${base}#2--10`);
    expect(wormbaseAnatomyUrl('WBbt:0005772', 'links')).toBe(`${base}#3--10`);
    expect(wormbaseAnatomyUrl('WBbt:0005772', 'ontology')).toBe(`${base}#4--10`);
    expect(wormbaseAnatomyUrl('WBbt:0005772', 'references')).toBe(`${base}#5--10`);
  });

  // Index 6 is Tree Display, which renders the ACEDB object behind the page.
  // It is not in the map on purpose, so asking for it lands on the overview
  // like any other name we do not serve.
  it('does not offer the ACEDB object tree', () => {
    expect(wormbaseAnatomyUrl('WBbt:0005772', 'tree')).toBe(`${base}#0--10`);
  });

  it('falls back to the overview rather than building a broken address', () => {
    expect(wormbaseAnatomyUrl('WBbt:0005772')).toBe(`${base}#0--10`);
    expect(wormbaseAnatomyUrl('WBbt:0005772', 'not-a-widget')).toBe(`${base}#0--10`);
  });
});

describe('termUrl', () => {
  it('sends a WBbt term to the widget the caller names', () => {
    const wbbt = byId('wbbt');
    expect(wbbt.termUrl('WBbt:0003832', 'markers')).toBe(
      'https://www.wormbase.org/species/all/anatomy_term/WBbt:0003832#2--10'
    );
  });

  // Every other member serves the whole term page at once, so a widget means
  // nothing there and must not leak into the address.
  it('ignores a widget for the members that serve a whole page', () => {
    expect(byId('zfa').termUrl('ZFA:0000135', 'markers')).toBe('https://zfin.org/ZFA:0000135');
    expect(byId('fbbt').termUrl('FBbt:00004729', 'associations')).toBe(
      'https://flybase.org/cgi-bin/cvreport.html?id=FBbt:00004729'
    );
    expect(byId('emapa').termUrl('EMAPA:16894', 'references')).toBe(
      'https://www.informatics.jax.org/vocab/gxd/anatomy/EMAPA:16894'
    );
  });
});
