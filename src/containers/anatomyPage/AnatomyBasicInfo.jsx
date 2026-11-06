import React from 'react';
import PropTypes from 'prop-types';

import { AttributeList, AttributeLabel, AttributeValue } from '../../components/attribute';
import CrossReferenceList from '../../components/crossReferenceList.jsx';
import SynonymList from '../../components/synonymList.jsx';
import ExternalLink from '../../components/ExternalLink.jsx';
import CommaSeparatedList from '../../components/commaSeparatedList.jsx';
import { SPECIES_ANATOMY_ONTOLOGIES } from '../ontologyBrowser/ontologies.js';
import toExternalResources, { toVocabularyXrefs } from './externalResources.js';

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
const AnatomyBasicInfo = ({ ontology, term, resources: modResources }) => {
  // On the cross-species page the member mappings are the UBERON Mapping
  // table, so listing them again here would say the same thing twice. The
  // legacy anatomy ontologies UBERON absorbed (CARO, TAO, MA, AAO, BTO) have no
  // page of ours and stay in cross-references.
  // On the cross-species page the leftover references join this row rather
  // than being dropped. UBERON maps a structure into 115 other vocabularies
  // — FMA, SNOMED, UMLS, NCIT, MeSH, the Allen brain atlases — and every one
  // of those is this row's claim, the same structure under another
  // identifier. They are not added on a member page: there the same slot
  // also holds papers and curators, which is what the strict allowlist in
  // src/lib/ols.js is for.
  const xrefs = ontology.crossSpecies
    ? [
        ...(term.xrefs || []).filter(({ curie }) => !SPECIES_PREFIXES.has(curie.split(':')[0].toUpperCase())),
        ...toVocabularyXrefs(term.resources),
      ]
    : term.xrefs;

  // Not the same claim as a cross-reference, and so not the same row:
  // externalResources.js has what each of these is and why the list is an
  // allowlist. FBbt and UBERON carry theirs in the ontology, so they arrive
  // on the term; WormBase keeps its own in ACEDB, so they arrive separately
  // as `modResources` and are simply added to the same list.
  const resources = toExternalResources([...(term.resources || []), ...(modResources || [])]);

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

      {/* Omitted entirely rather than shown as `None`, which ZFA, EMAPA and
          XAO would read on every term. A blank row would assert that nobody
          has built anything about this structure, and we only know that
          nobody has published it where we can see. Saying nothing is the
          honest version of that. */}
      {resources.length > 0 && (
        <>
          <AttributeLabel>External Resources</AttributeLabel>
          <AttributeValue>
            <CommaSeparatedList>
              {resources.map((resource) =>
                resource.links.length === 1 ? (
                  <ExternalLink key={resource.key} href={resource.links[0].href}>
                    {resource.label}
                  </ExternalLink>
                ) : (
                  // Several links into one resource: name it once and let
                  // what distinguishes them follow, so a worm neuron reads
                  // `WormWiring (JSH, N2U, n930)` rather than three
                  // indistinguishable copies of the same word. A nested
                  // CommaSeparatedList is a <ul> inside an <li>, which is
                  // legal, inline, and gets the same separators.
                  <span key={resource.key}>
                    {resource.label} (
                    <CommaSeparatedList>
                      {resource.links.map((link) => (
                        <ExternalLink key={link.key} href={link.href}>
                          {link.name}
                        </ExternalLink>
                      ))}
                    </CommaSeparatedList>
                    )
                  </span>
                )
              )}
            </CommaSeparatedList>
          </AttributeValue>
        </>
      )}
    </AttributeList>
  );
};

AnatomyBasicInfo.propTypes = {
  ontology: PropTypes.object.isRequired,
  term: PropTypes.object.isRequired,
  // Resources the member keeps outside its ontology; WormBase only, so far.
  resources: PropTypes.array,
};

export default AnatomyBasicInfo;
