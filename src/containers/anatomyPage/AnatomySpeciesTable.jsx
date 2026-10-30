import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import SpeciesName from '../../components/SpeciesName.jsx';
import NoData from '../../components/noData.jsx';
import LoadingSpinner from '../../components/loadingSpinner.jsx';

// The member terms a UBERON structure maps onto, one row per term. Rows arrive
// in Alliance species order from fetchUberonSpecies.
//
// Both the name and the identifier go to our own anatomy page for that term,
// not out to the curating member: this table is the way into the species pages,
// and each of those already carries its own "View at MGI/ZFIN/FlyBase" link.
const AnatomySpeciesTable = ({ rows, isLoading }) => {
  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!rows?.length) {
    return (
      <NoData>
        No Alliance member anatomy ontology maps a term onto this structure. Structures that only some species have —
        and the finer anatomy of any one species — are often mapped in one direction only.
      </NoData>
    );
  }

  return (
    <table className="table">
      <thead className="text-capitalize">
        <tr>
          <th>Species</th>
          <th>Term</th>
          <th>Identifier</th>
          <th>Curated by</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ ontology, term }) => (
          <tr key={term.curie}>
            <td>
              <SpeciesName>{ontology.species}</SpeciesName>
            </td>
            <td>
              <Link to={`/anatomy/${term.curie}`}>{term.name}</Link>
            </td>
            <td>
              <Link to={`/anatomy/${term.curie}`}>{term.curie}</Link>
            </td>
            <td>{ontology.mod || ontology.provider || ontology.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

AnatomySpeciesTable.propTypes = {
  rows: PropTypes.array,
  isLoading: PropTypes.bool,
};

export default AnatomySpeciesTable;
