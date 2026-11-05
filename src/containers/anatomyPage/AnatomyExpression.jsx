import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import SpeciesName from '../../components/SpeciesName.jsx';
import CommaSeparatedList from '../../components/commaSeparatedList.jsx';
import ExternalLink from '../../components/ExternalLink.jsx';
import SampleTable from './SampleTable.jsx';

// Genes with expression annotated to this structure.
//
// The notice is not boilerplate and should not be trimmed away. These rows
// are real Alliance annotations, which makes them more misleading than mock
// data would be, not less: a reader has no way to tell from the table that it
// covers ten terms out of ninety thousand, or that the gene list is the top
// slice rather than all 941. Both facts are stated before the table.
const AnatomyExpression = ({ term, sample, sources, ontology }) => {
  const species = [...new Set(sample.genes.map((gene) => gene.species))];
  const files = sample.sources.map((mod) => sources[mod]).filter(Boolean);
  const truncated = sample.totalGenes > sample.genes.length;

  return (
    <>
      <p className="text-muted">
        <b>{sample.totalGenes.toLocaleString()} genes</b> have expression annotated to {term.name}, across{' '}
        {sample.totalAnnotations.toLocaleString()} annotations
        {truncated && <> — more than any one table should hold</>}.
      </p>

      <SampleTable total={sample.totalGenes} shown={sample.genes.length} noun="genes" ontology={ontology} term={term}>
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
      </SampleTable>

      {sample.assays?.length > 0 && (
        <div className="text-muted mb-3">
          Assays: <CommaSeparatedList>{sample.assays}</CommaSeparatedList>
        </div>
      )}

      <div className="small text-muted mb-3">
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
      </div>
    </>
  );
};

AnatomyExpression.propTypes = {
  term: PropTypes.object.isRequired,
  sample: PropTypes.object.isRequired,
  sources: PropTypes.object.isRequired,
  ontology: PropTypes.object,
};

export default AnatomyExpression;
