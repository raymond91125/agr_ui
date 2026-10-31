import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import SpeciesName from '../../components/SpeciesName.jsx';
import CommaSeparatedList from '../../components/commaSeparatedList.jsx';
import ExternalLink from '../../components/ExternalLink.jsx';

// Genes with expression annotated to this structure.
//
// The notice is not boilerplate and should not be trimmed away. These rows
// are real Alliance annotations, which makes them more misleading than mock
// data would be, not less: a reader has no way to tell from the table that it
// covers ten terms out of ninety thousand, or that the gene list is the top
// slice rather than all 941. Both facts are stated before the table.
const AnatomyExpression = ({ term, sample, sources, genesPerTerm }) => {
  const species = [...new Set(sample.genes.map((gene) => gene.species))];
  const files = sample.sources.map((mod) => sources[mod]).filter(Boolean);
  const truncated = sample.totalGenes > sample.genes.length;

  return (
    <>
      <p className="text-muted">
        <b>{sample.totalGenes.toLocaleString()} genes</b> have expression annotated to {term.name}, across{' '}
        {sample.totalAnnotations.toLocaleString()} annotations
        {truncated && <> — the {genesPerTerm} most annotated are shown</>}.
      </p>

      <table className="table">
        <thead className="text-capitalize">
          <tr>
            <th>Gene</th>
            {species.length > 1 && <th>Species</th>}
            <th>Annotations</th>
            <th>Stages</th>
          </tr>
        </thead>
        <tbody>
          {sample.genes.map((gene) => (
            <tr key={gene.curie}>
              <td>
                <Link to={`/gene/${gene.curie}`}>{gene.symbol}</Link>
              </td>
              {species.length > 1 && (
                <td>
                  <SpeciesName>{gene.species}</SpeciesName>
                </td>
              )}
              <td>{gene.annotations.toLocaleString()}</td>
              {/* Each gene's own stages, not the term's: a gene annotated only
                  at one stage should not borrow the range of the structure. */}
              <td className="text-muted">{gene.stages.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sample.assays?.length > 0 && (
        <p className="text-muted">
          Assays: <CommaSeparatedList>{sample.assays}</CommaSeparatedList>
        </p>
      )}

      <p className="small text-muted">
        Sample data. The Alliance holds these annotations but cannot yet be asked for them by anatomy term, so this
        table is built ahead of time for a handful of terms and most anatomy pages have no table at all. Rows are
        unmodified from the Alliance expression {files.length > 1 ? 'files' : 'file'}{' '}
        <CommaSeparatedList>
          {files.map((file) => (
            <ExternalLink key={file.url} href={file.url}>
              {file.species} {file.release}
            </ExternalLink>
          ))}
        </CommaSeparatedList>
        .
      </p>
    </>
  );
};

AnatomyExpression.propTypes = {
  term: PropTypes.object.isRequired,
  sample: PropTypes.object.isRequired,
  sources: PropTypes.object.isRequired,
  genesPerTerm: PropTypes.number,
};

export default AnatomyExpression;
