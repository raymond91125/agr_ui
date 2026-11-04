import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import CommaSeparatedList from '../../components/commaSeparatedList.jsx';
import ExternalLink from '../../components/ExternalLink.jsx';
import MemberText from './MemberText.jsx';

// Alleles, variations and transgenes whose phenotype reaches this structure.
//
// These are the objects the phenotype annotations were made against. The
// Phenotypes section resolves each one back to a gene and shows the gene; this
// one stops a step earlier and shows the thing itself, because a reader who
// wants to work on a structure wants something they can order, not a gene
// identifier.
//
// Two counts are kept apart on purpose. An annotation made against the reagent
// is a curator's statement about that reagent. An annotation made against a
// genotype that happens to carry it is weaker — a fish with three mutations
// says less about any one of them — and the column says which is which rather
// than adding them into one number.
const AnatomyReagents = ({ term, sample, sources, reagentsPerTerm }) => {
  const files = sample.sources.map((mod) => sources[mod]).filter(Boolean);
  const truncated = sample.totalReagents > sample.reagents.length;
  const throughModels = sample.reagents.some((reagent) => reagent.throughModels > 0);

  return (
    <>
      <p className="text-muted">
        <b>{sample.totalReagents.toLocaleString()} alleles, variations and transgenes</b> have a phenotype annotated to{' '}
        {term.name}
        {truncated && <> — the {reagentsPerTerm} most annotated are shown</>}.
        {sample.toGene > 0 && (
          <>
            {' '}
            A further {sample.toGene.toLocaleString()} annotations name a gene directly, with no reagent, and appear
            under Phenotypes instead.
          </>
        )}
      </p>

      {sample.route === 'definition' && (
        <p className="text-muted">
          Reached through the {sample.via}, which defines each phenotype term as a quality of a named structure. These
          reagents are annotated to those terms, not to {term.name} itself.
        </p>
      )}

      <table className="table">
        <thead className="text-capitalize">
          <tr>
            <th>Reagent</th>
            <th>Type</th>
            <th>Gene</th>
            <th>Annotations</th>
            {throughModels && <th>Through a genotype</th>}
          </tr>
        </thead>
        <tbody>
          {sample.reagents.map((reagent) => (
            <tr key={reagent.curie}>
              <td>
                <Link to={`/allele/${reagent.curie}`}>
                  <MemberText>{reagent.symbol}</MemberText>
                </Link>
              </td>
              <td className="text-muted">{reagent.kind}</td>
              <td>
                {reagent.gene ? (
                  <Link to={`/gene/${reagent.gene.curie}`}>
                    <MemberText>{reagent.gene.symbol}</MemberText>
                  </Link>
                ) : (
                  // A transgenic insertion the member records against no gene.
                  // Blank rather than the reagent's own identifier repeated:
                  // the cell is empty because the relation is absent, which is
                  // a fact about the reagent worth leaving visible.
                  <span className="text-muted">—</span>
                )}
              </td>
              <td>{reagent.annotations.toLocaleString()}</td>
              {throughModels && <td className="text-muted">{reagent.throughModels.toLocaleString()}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {sample.models > 0 && (
        <p className="text-muted">
          {sample.models.toLocaleString()} genotypes carry these reagents.{' '}
          {sample.modelsEmpty > 0 && (
            <>
              A further {sample.modelsEmpty.toLocaleString()} are a genetic background and a set of conditions with no
              allele of their own, so nothing in them can be shown here.
            </>
          )}
        </p>
      )}

      <p className="small text-muted">
        Sample data, and only part of the answer. These are the reagents the Alliance publishes beside its phenotype
        annotations; antibodies, probes and constructs are curated by the members but are not in any Alliance download,
        so a member's own term page will show more. Rows are unmodified from the Alliance phenotype and allele{' '}
        {files.length > 1 ? 'files' : 'file'}{' '}
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

AnatomyReagents.propTypes = {
  term: PropTypes.object.isRequired,
  sample: PropTypes.object.isRequired,
  sources: PropTypes.object.isRequired,
  reagentsPerTerm: PropTypes.number,
};

export default AnatomyReagents;
