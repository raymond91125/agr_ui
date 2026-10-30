import React from 'react';
import PropTypes from 'prop-types';

import { AttributeList, AttributeLabel, AttributeValue } from '../../components/attribute';
import { CollapsibleList } from '../../components/collapsibleList';
import AnatomyTermLink from './AnatomyTermLink.jsx';

// A relation name is an OBO property label and is shown as asserted. The
// attribute list capitalizes by default, which would turn `has soma location`
// into Has Soma Location and read as a heading rather than a statement.
const RELATION_LABEL = { textTransform: 'none' };

const TermList = ({ terms }) => (
  <CollapsibleList collapsedSize={5}>
    {terms.map((term) => (
      <AnatomyTermLink key={`${term.relation}-${term.curie}`} curie={term.curie} name={term.name} />
    ))}
  </CollapsibleList>
);

TermList.propTypes = {
  terms: PropTypes.array.isRequired,
};

const RelationGroups = ({ groups }) => (
  <AttributeList>
    {groups.map(({ relation, terms }) => (
      <React.Fragment key={relation}>
        <AttributeLabel style={RELATION_LABEL}>{relation}</AttributeLabel>
        <AttributeValue>
          <TermList terms={terms} />
        </AttributeValue>
      </React.Fragment>
    ))}
  </AttributeList>
);

RelationGroups.propTypes = {
  groups: PropTypes.array.isRequired,
};

// Both directions are shown because an ontology states a relation once, on one
// of the two terms, and which one it picks is a curation convention rather than
// a fact about the animal. FBbt writes `has soma location` on the neuron, so a
// structure full of neurons would otherwise look unconnected to every one of
// them. The ellipsis marks where this term sits in each row's sentence, and the
// second block spells that out with a row it is actually showing — the reading
// order reverses there, which is easy to miss.
const AnatomyRelations = ({ relations, term }) => {
  const [{ relation, terms }] = relations.in.length ? relations.in : [{}];

  return (
    <>
      {relations.out.length > 0 && (
        <>
          <div className="text-muted mb-2">
            <i>{term.name}</i> &hellip;
          </div>
          <RelationGroups groups={relations.out} />
        </>
      )}

      {relations.in.length > 0 && (
        <>
          <div className={`text-muted mb-2 ${relations.out.length ? 'mt-4' : ''}`}>
            &hellip; <i>{term.name}</i>
            <div className="small">
              Read these rows right to left: <i>{terms[0].name}</i> {relation} <i>{term.name}</i>.
            </div>
          </div>
          <RelationGroups groups={relations.in} />
        </>
      )}
    </>
  );
};

AnatomyRelations.propTypes = {
  relations: PropTypes.shape({
    out: PropTypes.array.isRequired,
    in: PropTypes.array.isRequired,
  }).isRequired,
  term: PropTypes.object.isRequired,
};

export default AnatomyRelations;
