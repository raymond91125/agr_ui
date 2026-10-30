import React from 'react';
import PropTypes from 'prop-types';

import { AttributeList, AttributeLabel, AttributeValue } from '../../components/attribute';
import ExternalLink from '../../components/ExternalLink.jsx';

// ZFIN writes hours post-fertilisation to two decimals only where the early
// stages need them — Gastrula:Bud is 10.0 to 10.33 h, Adult is 2160 to 17520.
const formatHours = (hours) => (Number.isInteger(hours) ? String(hours) : hours.toFixed(2));

const Stage = ({ stage }) => (
  <>
    {stage.name}{' '}
    <span className="text-muted">
      ({formatHours(stage.start)}–{formatHours(stage.end)} h)
    </span>
  </>
);

Stage.propTypes = {
  stage: PropTypes.object.isRequired,
};

// The window during which a structure is present, on the member's own staging
// series. Every member that curates this uses a different series — ZFS here,
// Theiler stages at MGI, Nieuwkoop–Faber at Xenbase — and they do not convert
// into one another, so the series is named rather than normalized away.
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
      Zebrafish developmental stages (ZFS), curated by {ontology.mod}.{' '}
      <ExternalLink href="https://zfin.org/zf_info/zfbook/stages/index.html">Stage series at ZFIN</ExternalLink>
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
