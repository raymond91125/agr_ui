import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import ExternalLink from '../../components/ExternalLink.jsx';
import MemberText from './MemberText.jsx';

// Genes curated as markers FOR this structure.
//
// Not the same claim as the Expression section above, and the difference is
// the reason this is a section rather than a column there. Expression says the
// gene is transcribed here, among thousands of others. A marker says this gene
// identifies the structure — it is what you reach for to label the tissue, and
// a reader who wants elt-2 for intestine is not served by a ranked list of
// 2,297 expressed genes.
//
// WormBase's own name for WormBase's own concept, which is safe because the
// section only ever appears on a WBbt term. Elsewhere the word would mislead:
// at MGI and ZFIN a "marker" is any genomic feature, which is why their gene
// pages live under /marker/ and /action/marker/.
//
// The whole set is here, not a slice of it, so there is no threshold and no
// toggle — the most any term carries is nine. What the footnote has to carry
// instead is the one thing a complete table can still be wrong about: a marker
// that names no gene cannot be in a gene-keyed file at all, and WormBase has
// at least one, which is the only marker vulva has.
// PubMed rather than /reference/{curie}: the Alliance literature endpoint
// answers a PMID with 400 `No literature summary found`, so an internal link
// would be a dead page. This is the `PMID` default_url from
// src/resourceDescriptors.js, which is what the rest of the site resolves a
// PMID to. Derived here rather than stored, since it is one prefix repeated
// across every row of the fixture.
const pubmed = (publication) => `https://pubmed.ncbi.nlm.nih.gov/${publication.replace(/^PMID:/, '')}`;

const AnatomyMarkers = ({ term, sample, source, coverage }) => (
  <>
    <div className="text-muted mb-3">
      <b>
        {sample.totalMarkers} {sample.totalMarkers === 1 ? 'gene is' : 'genes are'}
      </b>{' '}
      curated as {sample.totalMarkers === 1 ? 'a marker' : 'markers'} for {term.name} — expression that identifies the
      structure, rather than expression that merely occurs in it.
    </div>

    <table className="table">
      <thead className="text-capitalize">
        <tr>
          <th>Gene</th>
          <th>Marker</th>
          <th>Reference</th>
        </tr>
      </thead>
      <tbody>
        {sample.markers.map((marker) => (
          <tr key={marker.id}>
            <td>
              <Link to={`/gene/${marker.curie}`}>
                <MemberText>{marker.symbol}</MemberText>
              </Link>
              {/* Printed only when it says something the term name does not.
                  It is the curator's own wording for what was labelled, and
                  on one term in the set it carries a `(partial)` that changes
                  the claim. */}
              {marker.statement && marker.statement !== term.name && (
                <span className="text-muted"> &mdash; {marker.statement}</span>
              )}
            </td>
            <td>
              <ExternalLink href={marker.url}>{marker.id}</ExternalLink>
            </td>
            <td>
              {marker.publication ? (
                <ExternalLink href={pubmed(marker.publication)}>{marker.publication}</ExternalLink>
              ) : (
                <span className="text-muted">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="small text-muted mb-3">
      Every marker the Alliance publishes for this term, not a sample — but not necessarily every marker{' '}
      {source.mod === 'WB' ? 'WormBase' : source.mod} has. A marker curated against no particular gene cannot appear in
      a file keyed by gene, and those exist: <span className="text-monospace">Marker87</span>, for vulval precursor
      daughters, is one, and it is the only marker vulva has.{' '}
      <ExternalLink href={`https://www.wormbase.org/db/get?name=${term.curie};class=Anatomy`}>
        Check this term at WormBase
      </ExternalLink>{' '}
      for those, and for the certainty and description this file does not carry.
    </div>

    <div className="small text-muted mb-3">
      Markers are curated for {coverage.terms.toLocaleString()} of the {coverage.ontologyTerms.toLocaleString()} terms
      in WormBase&apos;s anatomy ontology, so most anatomy pages have no such section. That is the state of the curation
      rather than a limit of this table. Rows are unmodified from the Alliance expression file{' '}
      <ExternalLink href={source.url}>
        {source.species} {source.release}
      </ExternalLink>
      .
    </div>
  </>
);

AnatomyMarkers.propTypes = {
  term: PropTypes.object.isRequired,
  sample: PropTypes.object.isRequired,
  source: PropTypes.object.isRequired,
  coverage: PropTypes.object.isRequired,
};

export default AnatomyMarkers;
