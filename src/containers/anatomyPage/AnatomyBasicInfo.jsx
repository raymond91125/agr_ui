import React from 'react';
import PropTypes from 'prop-types';

import { AttributeList, AttributeLabel, AttributeValue } from '../../components/attribute';
import CrossReferenceList from '../../components/crossReferenceList.jsx';
import SynonymList from '../../components/synonymList.jsx';
import ExternalLink from '../../components/ExternalLink.jsx';
import { SPECIES_ANATOMY_ONTOLOGIES } from '../ontologyBrowser/ontologies.js';

const SPECIES_PREFIXES = new Set(SPECIES_ANATOMY_ONTOLOGIES.map((o) => o.curiePrefix.toUpperCase()));

// CrossReferenceList renders through DataSourceLink, which expects
// { name, displayName, crossRefCompleteUrl }. OLS gives us a curie and
// sometimes a resolver URL; entries without one still render as plain text.
const toCrossReferences = (xrefs) =>
  (xrefs || []).map(({ curie, url }) => ({
    name: curie,
    displayName: curie,
    crossRefCompleteUrl: url,
  }));

// A species page deliberately carries no "view this structure across species"
// link. The UBERON mapping is recorded on the UBERON term, not on the member
// term: sampling 50 terms per ontology, XAO declares a UBERON xref on 43 of
// them and WBbt, ZFA and EMAPA on none. OLS cannot search xrefs in reverse
// (?queryFields=annotations finds nothing), so from a WBbt term there is no
// client-side way to find the UBERON term that maps onto it, and a row here
// would read "not mapped" for nearly every worm, fish and mouse structure when
// UBERON in fact maps them all. Reaching UBERON from a species page needs the
// mapping held on our side — the same table /api/anatomy/{id} would serve.
// Parent and child terms are not listed here. They were, as two untyped lists,
// which merged `is a` with `part of` — the one distinction an anatomy ontology
// exists to draw. They are in Relationships now, under the relation that was
// actually asserted.
const AnatomyBasicInfo = ({ ontology, term }) => {
  // On the cross-species page the member mappings are the UBERON Mapping
  // table, so listing them again here would say the same thing twice. The
  // legacy anatomy ontologies UBERON absorbed (CARO, TAO, MA, AAO, BTO) have no
  // page of ours and stay in cross-references.
  const xrefs = ontology.crossSpecies
    ? (term.xrefs || []).filter(({ curie }) => !SPECIES_PREFIXES.has(curie.split(':')[0].toUpperCase()))
    : term.xrefs;

  return (
    <AttributeList>
      <AttributeLabel>Definition</AttributeLabel>
      <AttributeValue placeholder="None">{term.definition}</AttributeValue>

      <AttributeLabel>Species</AttributeLabel>
      <AttributeValue placeholder="Not species-specific">
        {ontology.species && <i>{ontology.species}</i>}
      </AttributeValue>

      <AttributeLabel>Ontology</AttributeLabel>
      <AttributeValue>
        {ontology.label}
        {ontology.termUrl && (
          <>
            {' '}
            <ExternalLink href={ontology.termUrl(term.curie)}>
              {ontology.mod ? `View at ${ontology.mod}` : 'View source term'}
            </ExternalLink>
          </>
        )}
      </AttributeValue>

      <AttributeLabel>Synonyms</AttributeLabel>
      <AttributeValue placeholder="None">
        {term.synonyms?.length > 0 && <SynonymList synonyms={term.synonyms} />}
      </AttributeValue>

      <AttributeLabel>Cross References</AttributeLabel>
      <AttributeValue placeholder="None">
        {xrefs?.length > 0 && <CrossReferenceList crossReferences={toCrossReferences(xrefs)} />}
      </AttributeValue>
    </AttributeList>
  );
};

AnatomyBasicInfo.propTypes = {
  ontology: PropTypes.object.isRequired,
  term: PropTypes.object.isRequired,
};

export default AnatomyBasicInfo;
