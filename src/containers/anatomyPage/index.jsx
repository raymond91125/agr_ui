import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import Subsection from '../../components/subsection.jsx';
import NotFound from '../../components/notFound.jsx';
import NoData from '../../components/noData.jsx';
import HeadMetaTags from '../../components/headMetaTags.jsx';
import ExternalLink from '../../components/ExternalLink.jsx';
import { DataPage, PageNav, PageData, PageHeader } from '../../components/dataPage';
import PageNavEntity from '../../components/dataPage/PageNavEntity.jsx';
import PageCategoryLabel from '../../components/dataPage/PageCategoryLabel.jsx';
import YourInputWelcome from '../../components/YourInputWelcome.jsx';
import usePageLoadingQuery from '../../hooks/usePageLoadingQuery';
import { ANATOMY_CATEGORY } from '../../constants';
import { getOntologyForCurie } from '../ontologyBrowser/ontologies.js';
import AnatomyBasicInfo from './AnatomyBasicInfo.jsx';
import AnatomySpeciesTable from './AnatomySpeciesTable.jsx';
import AnatomyStageRange from './AnatomyStageRange.jsx';
import fetchAnatomyTerm from './fetchAnatomyTerm.js';
import fetchUberonSpecies from './fetchUberonSpecies.js';
import fetchZfinStages from './fetchZfinStages.js';

const SUMMARY = 'Summary';
const EXPRESSION = 'Genes Expressed Here';
const SPECIES = 'Anatomy by Species';
const STAGES = 'Developmental Window';
const BROWSE_ONTOLOGY = 'Browse Ontology';

const AnatomyPage = () => {
  const { id: curie } = useParams();
  const ontology = getOntologyForCurie(curie);
  // This route serves anatomy vocabularies only. A curie from another ontology
  // the browser knows — a DOID, say — is as much a 404 here as an unknown one.
  const isAnatomy = ontology?.group === 'Anatomy';

  const { isLoading, isError, data } = usePageLoadingQuery(isAnatomy ? `anatomy:${ontology.id}:${curie}` : null, () =>
    fetchAnatomyTerm(ontology, curie)
  );

  // UBERON's cross-species mappings live on the term, so this waits on the term
  // fetch rather than running beside it. It is also the only part of the page
  // that fans out to one request per mapped species, so species pages — the
  // common case — never pay for it.
  const { isLoading: speciesLoading, data: speciesRows } = useQuery({
    queryKey: ['anatomy-species', curie],
    queryFn: () => fetchUberonSpecies(data.term),
    enabled: Boolean(ontology?.crossSpecies && data?.term),
    staleTime: 5 * 60_000,
  });

  // Only ZFA carries a stage source today. The query is skipped entirely for
  // every other vocabulary, so no other page pays for it, and a failed fetch
  // leaves `stages` undefined — which hides the section rather than showing an
  // error for data the Alliance does not serve yet.
  const { data: stages } = useQuery({
    queryKey: ['anatomy-stages', curie],
    queryFn: () => fetchZfinStages(curie),
    enabled: ontology?.stageSource === 'zfin',
    staleTime: 60 * 60_000,
    retry: false,
  });

  if (!isAnatomy || isError) {
    return <NotFound />;
  }

  if (isLoading || !data) {
    return null; // the main page loading bar is sufficient
  }

  const { term, parents, children } = data;
  const title = term.name || term.curie;

  const keywords = ['anatomy', term.curie, term.name, ontology.species, ontology.mod].filter(Boolean);
  if (term.synonyms?.length) {
    keywords.push(...term.synonyms);
  }

  const siteUrl = `https://www.alliancegenome.org/anatomy/${term.curie}`;

  const jsonLd = [
    {
      '@context': 'http://schema.org',
      '@type': 'Dataset',
      '@id': term.curie,
      name: term.name,
      description: term.definition,
      url: siteUrl,
      keywords: keywords.join(' '),
      includedInDataCatalog: 'https://www.alliancegenome.org',
      creator: {
        '@type': 'Organization',
        name: 'Alliance of Genome Resources',
      },
      version: '2.0',
      license: 'CC BY 4.0',
    },
    {
      '@context': 'http://schema.org',
      '@type': 'AnatomicalStructure',
      '@id': term.curie,
      identifier: term.curie,
      name: term.name,
      url: siteUrl,
      description: term.definition,
    },
  ];

  return (
    <DataPage>
      <HeadMetaTags jsonLd={jsonLd} title={title} />
      <PageNav
        sections={[
          { name: SUMMARY },
          ...(stages ? [{ name: STAGES }] : []),
          { name: ontology.crossSpecies ? SPECIES : EXPRESSION },
          { name: BROWSE_ONTOLOGY, to: `/ontology/${ontology.id}/${term.curie}` },
        ]}
      >
        <PageNavEntity entityName={title}>
          <ExternalLink href={ontology.termUrl(term.curie)}>{term.curie}</ExternalLink>
        </PageNavEntity>
      </PageNav>
      <PageData>
        <PageCategoryLabel category={ANATOMY_CATEGORY} displayName="Anatomy" />
        <PageHeader>{title}</PageHeader>
        <YourInputWelcome type="Anatomy" name={title} allianceId={term.curie} />

        <Subsection hideTitle title={SUMMARY}>
          <AnatomyBasicInfo ontology={ontology} term={term} parents={parents} children={children} />
        </Subsection>

        {/* Hidden outright when the vocabulary has no stage axis — WBbt and
            FBbt put staging on the annotation rather than the term — and when
            the member's data cannot be reached. An empty block would imply the
            range is merely missing. */}
        {stages && (
          <Subsection title={STAGES}>
            <AnatomyStageRange stages={stages} ontology={ontology} />
          </Subsection>
        )}

        {/* The UBERON page exists to answer the one question a species page
            cannot: which animals have this structure, and what does each member
            call it. Expression is a species question, so it stays on the
            species pages. */}
        {ontology.crossSpecies ? (
          <Subsection title={SPECIES}>
            <AnatomySpeciesTable rows={speciesRows} isLoading={speciesLoading} />
          </Subsection>
        ) : (
          /* Every Alliance expression annotation already carries its native
             member anatomy term, but the API can only be queried gene-first, so
             there is no way to ask which genes are expressed in a term. Say so
             plainly instead of hiding the section — a reader who came here for
             expression should learn where it is, not think none exists. */
          <Subsection title={EXPRESSION}>
            <NoData>
              Expression annotations cannot yet be searched by anatomy term at the Alliance.
              {ontology.mod && (
                <>
                  {' '}
                  <ExternalLink href={ontology.termUrl(term.curie)}>
                    View expression for this term at {ontology.mod}
                  </ExternalLink>
                  .
                </>
              )}
            </NoData>
          </Subsection>
        )}
      </PageData>
    </DataPage>
  );
};

export default AnatomyPage;
