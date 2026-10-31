import React from 'react';
import PropTypes from 'prop-types';

import { AttributeList, AttributeLabel, AttributeValue } from '../../components/attribute';
import ExternalLink from '../../components/ExternalLink.jsx';
import CommaSeparatedList from '../../components/commaSeparatedList.jsx';

// Where the term came from and who to tell when it is wrong.
//
// Anatomy curation does not happen at the Alliance — it happens in six
// repositories, each with its own issue tracker, and none of the member pages
// surveyed links to one from the term. That makes this the only section on the
// page a reader can act on, which is why the tracker is here rather than
// folded into the summary's "View at ZFIN" link.
//
// The release date is also the section's reason to exist: XAO last shipped in
// September 2024 while FBbt, EMAPA and UBERON ship monthly. A reader comparing
// two species has no way to know that unless the page says so.

// Not CrossReferenceList, which renders every entry through ExternalLink: a
// null href there still draws the external-link arrow, promising a link that
// does nothing. Most citations here have no resolver — FBC:GG is a curator's
// initials and WBPaper is not in the Alliance resource descriptors — so they
// are named as identifiers instead.
const Source = ({ curie, url }) => (url ? <ExternalLink href={url}>{curie}</ExternalLink> : <>{curie}</>);

Source.propTypes = {
  curie: PropTypes.string.isRequired,
  url: PropTypes.string,
};

const AnatomyProvenance = ({ ontology, term, vocabulary }) => (
  <AttributeList>
    <AttributeLabel>Vocabulary</AttributeLabel>
    <AttributeValue>
      {vocabulary?.title || ontology.label}
      {vocabulary?.description && <div className="text-muted">{vocabulary.description}</div>}
    </AttributeValue>

    <AttributeLabel>Curated by</AttributeLabel>
    <AttributeValue placeholder="Not stated">{ontology.mod || ontology.provider}</AttributeValue>

    <AttributeLabel>Release</AttributeLabel>
    <AttributeValue placeholder="Not stated">
      {vocabulary?.release}
      {vocabulary?.termCount != null && (
        <span className="text-muted"> · {vocabulary.termCount.toLocaleString()} terms</span>
      )}
    </AttributeValue>

    {/* The definition's own citation, which the cross-reference list drops on
        purpose — a paper and a curator's initials are not other names for this
        structure. Absent for EMAPA, which curates no definitions at all. */}
    <AttributeLabel>Definition source</AttributeLabel>
    <AttributeValue placeholder="None">
      {term.definitionSources?.length > 0 && (
        <CommaSeparatedList>
          {term.definitionSources.map((source) => (
            <Source key={source.curie} curie={source.curie} url={source.url} />
          ))}
        </CommaSeparatedList>
      )}
    </AttributeValue>

    <AttributeLabel>Subsets</AttributeLabel>
    <AttributeValue placeholder="None">
      {term.subsets?.length > 0 && <CommaSeparatedList>{term.subsets}</CommaSeparatedList>}
    </AttributeValue>

    <AttributeLabel>Corrections</AttributeLabel>
    <AttributeValue placeholder="No tracker published">
      {vocabulary?.tracker && (
        <>
          <ExternalLink href={vocabulary.tracker}>Issue tracker</ExternalLink>
          <div className="small text-muted">
            Anatomy terms are curated in the vocabulary, not at the Alliance. A wrong definition, a missing synonym or a
            bad parent is fixed there.
          </div>
        </>
      )}
    </AttributeValue>
  </AttributeList>
);

AnatomyProvenance.propTypes = {
  ontology: PropTypes.object.isRequired,
  term: PropTypes.object.isRequired,
  vocabulary: PropTypes.object,
};

export default AnatomyProvenance;
