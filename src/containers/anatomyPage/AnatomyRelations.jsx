import React from 'react';
import PropTypes from 'prop-types';

import { AttributeList, AttributeLabel, AttributeValue } from '../../components/attribute';
import { CollapsibleList } from '../../components/collapsibleList';
import AnatomyTermLink from './AnatomyTermLink.jsx';

// A relation name is an OBO property label and is shown as asserted. The
// attribute list capitalizes its labels, which would turn `has soma location`
// into Has Soma Location and read as a heading rather than as a statement.
const AS_WRITTEN = { textTransform: 'none' };

// Term names land in the label column in the incoming block, where <dt> would
// otherwise embolden them and capitalize `ABplaapappa nucleus` mid-word.
const TERM_LABEL = { ...AS_WRITTEN, fontWeight: 'normal' };

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

// Subject, then relation, then object — in both blocks. For the relations this
// term asserts the subject is the term itself, named once in the heading above,
// so the rows start with the relation. For the relations asserted *about* it
// the subject is the other term, so the columns swap and the row starts with
// the terms instead. Either way a row reads left to right into the heading's
// ellipsis; the alternative was one block that read backwards.
const RelationGroups = ({ groups, subjectIsTerm }) => (
  <AttributeList>
    {groups.map(({ relation, terms }) =>
      subjectIsTerm ? (
        <React.Fragment key={relation}>
          <AttributeLabel style={AS_WRITTEN}>{relation}</AttributeLabel>
          <AttributeValue>
            <TermList terms={terms} />
          </AttributeValue>
        </React.Fragment>
      ) : (
        <React.Fragment key={relation}>
          {/* mb-3 because the two columns of a row differ wildly in height
              here — a relation is one line, its term list can be five — and
              without it one group's terms run straight into the next one's. */}
          <AttributeLabel style={TERM_LABEL} bsClassName="col-md-4 mb-3">
            <TermList terms={terms} />
          </AttributeLabel>
          <AttributeValue bsClassName="col-md-8 mb-3">
            <b>{relation}</b>
          </AttributeValue>
        </React.Fragment>
      )
    )}
  </AttributeList>
);

RelationGroups.propTypes = {
  groups: PropTypes.array.isRequired,
  subjectIsTerm: PropTypes.bool,
};

// Both directions are shown because an ontology states a relation once, on one
// of the two terms, and which one it picks is a curation convention rather than
// a fact about the animal. FBbt writes `has soma location` on the neuron, so a
// structure full of neurons would otherwise look unconnected to every one of
// them. The ellipsis in each heading marks where this term sits in the sentence
// its rows complete.
const AnatomyRelations = ({ relations, term }) => (
  <>
    {relations.out.length > 0 && (
      <>
        <div className="text-muted mb-2">
          <i>{term.name}</i> &hellip;
        </div>
        <RelationGroups groups={relations.out} subjectIsTerm />
      </>
    )}

    {relations.in.length > 0 && (
      <>
        <div className={`text-muted mb-2 ${relations.out.length ? 'mt-4' : ''}`}>
          &hellip; <i>{term.name}</i>
        </div>
        <RelationGroups groups={relations.in} />
      </>
    )}
  </>
);

AnatomyRelations.propTypes = {
  relations: PropTypes.shape({
    out: PropTypes.array.isRequired,
    in: PropTypes.array.isRequired,
  }).isRequired,
  term: PropTypes.object.isRequired,
};

export default AnatomyRelations;
