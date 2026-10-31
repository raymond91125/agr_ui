import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { getOntologyForCurie } from '../ontologyBrowser/ontologies.js';

// The far end of a relation is an ontology term like any other, and often one
// this site already serves — XAO:1000024 is NF stage 14, an XAO term with an
// anatomy page of its own. Link the terms we can render; name the rest rather
// than linking them to a 404. That covers the stage series ZFS and TS, and the
// upper and cross-domain ontologies UBERON reaches into: GO, CL, NCBITaxon.
const AnatomyTermLink = ({ curie, name }) =>
  getOntologyForCurie(curie)?.group === 'Anatomy' ? <Link to={`/anatomy/${curie}`}>{name}</Link> : <>{name}</>;

AnatomyTermLink.propTypes = {
  curie: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
};

export default AnatomyTermLink;
