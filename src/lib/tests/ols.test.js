import assert from 'assert';

import { releaseDate, curieToIri, iriToCurie } from '../ols';

describe('ols', () => {
  describe('#releaseDate', () => {
    it('takes version when it is a date, as FBbt and ZFA publish it', () => {
      assert.equal(
        releaseDate({ version: '2026-10-01', versionIri: 'http://x/releases/2020-01-01/f.owl' }),
        '2026-10-01'
      );
    });

    it('falls back to the version IRI, which is all WBbt, EMAPA, XAO and UBERON give', () => {
      const config = { version: null, versionIri: 'http://purl.obolibrary.org/obo/xao/releases/2024-09-03/xao.owl' };
      assert.equal(releaseDate(config), '2024-09-03');
    });

    it('ignores a version that is not a date rather than printing it as one', () => {
      const config = { version: '2.1', versionIri: 'http://purl.obolibrary.org/obo/zfa/releases/2026-07-16/zfa.owl' };
      assert.equal(releaseDate(config), '2026-07-16');
    });

    it('returns nothing when the release is not stated anywhere', () => {
      assert.equal(releaseDate({ version: null, versionIri: 'http://purl.obolibrary.org/obo/x.owl' }), undefined);
      assert.equal(releaseDate(undefined), undefined);
    });
  });

  describe('#iriToCurie', () => {
    it('round-trips an OBO purl', () => {
      assert.equal(iriToCurie(curieToIri('WBbt:0005772')), 'WBbt:0005772');
    });

    it('leaves an IRI that is not an OBO purl as its last segment', () => {
      // Graph nodes are OBO purls in all six vocabularies here, but an upper
      // ontology class can surface among them and has no curie to give.
      assert.equal(iriToCurie('http://www.w3.org/2002/07/owl#Thing'), 'owl#Thing');
    });
  });
});
