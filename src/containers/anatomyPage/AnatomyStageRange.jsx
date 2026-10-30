import React from 'react';
import PropTypes from 'prop-types';

import { AttributeList, AttributeLabel, AttributeValue } from '../../components/attribute';
import AnatomyTermLink from './AnatomyTermLink.jsx';

const Stage = ({ stage }) => (
  <>
    <AnatomyTermLink curie={stage.curie} name={stage.name} /> <span className="text-muted">{stage.curie}</span>
    {/* The relation is shown because the members do not assert the same thing:
        EMAPA names an exact stage, ZFA only a bound. Collapsing both to
        "appears at" would make ZFA look more precise than it is. */}
    <div className="small text-muted">{stage.relation}</div>
  </>
);

Stage.propTypes = {
  stage: PropTypes.object.isRequired,
};

// The window during which a structure is present, on the member's own staging
// series. ZFS, Theiler and Nieuwkoop-Faber do not convert into one another, so
// the series is named rather than normalized to a shared axis.
const AnatomyStageRange = ({ stages, ontology }) => (
  <AttributeList>
    <AttributeLabel>Appears at</AttributeLabel>
    <AttributeValue>
      <Stage stage={stages.start} />
    </AttributeValue>

    <AttributeLabel>Evident until</AttributeLabel>
    <AttributeValue>
      <Stage stage={stages.end} />
    </AttributeValue>

    <AttributeLabel>Staging series</AttributeLabel>
    <AttributeValue>
      {ontology.stageSeries}
      {ontology.mod ? `, curated by ${ontology.mod}` : ''}
      {ontology.provider && !ontology.mod ? `, curated by ${ontology.provider}` : ''}
    </AttributeValue>
  </AttributeList>
);

AnatomyStageRange.propTypes = {
  stages: PropTypes.shape({
    start: PropTypes.object.isRequired,
    end: PropTypes.object.isRequired,
  }).isRequired,
  ontology: PropTypes.object.isRequired,
};

export default AnatomyStageRange;
