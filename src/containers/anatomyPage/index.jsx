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
import { fetchOlsOntology } from '../../lib/ols';
import AnatomyBasicInfo from './AnatomyBasicInfo.jsx';
import AnatomySpeciesTable from './AnatomySpeciesTable.jsx';
import AnatomyStageRange from './AnatomyStageRange.jsx';
import AnatomyRelations from './AnatomyRelations.jsx';
import AnatomyProvenance from './AnatomyProvenance.jsx';
import fetchAnatomyTerm from './fetchAnatomyTerm.js';
import fetchAcrossSpecies from './fetchAcrossSpecies.js';

const SUMMARY = 'Summary';
const EXPRESSION = 'Genes Expressed Here';
const UBERON_MAPPING = 'UBERON Mapping';
const STAGES = 'Developmental Window';
const RELATIONS = 'Relationships';
const PROVENANCE = 'Provenance';
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

  // The mapping lives on the UBERON term, so this waits on the term fetch
  // rather than running beside it — a species page needs the term's own xrefs
  // before it can tell whether it has to consult the inverted table at all.
  // It is also the only part of the page that fans out to one request per
  // mapped species.
  // Keyed on the ontology rather than the term, because it is the same answer
  // for all ~30,000 FBbt terms. Walking between terms of one vocabulary fetches
  // it once; the long staleTime is because a release moves monthly at most.
  const { data: vocabulary } = useQuery({
    queryKey: ['ols-ontology', ontology?.olsId],
    queryFn: () => fetchOlsOntology(ontology.olsId),
    enabled: Boolean(ontology?.olsId),
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });

  const { isLoading: speciesLoading, data: species } = useQuery({
    queryKey: ['anatomy-species', curie],
    queryFn: () => fetchAcrossSpecies(ontology, data.term),
    enabled: Boolean(data?.term),
    staleTime: 5 * 60_000,
  });

  if (!isAnatomy || isError) {
    return <NotFound />;
  }

  if (isLoading || !data) {
    return null; // the main page loading bar is sufficient
  }

  const { term, relations, stages } = data;
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
          ...(relations ? [{ name: RELATIONS }] : []),
          { name: UBERON_MAPPING },
          ...(ontology.crossSpecies ? [] : [{ name: EXPRESSION }]),
          { name: PROVENANCE },
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
          <AnatomyBasicInfo ontology={ontology} term={term} />
        </Subsection>

        {/* Hidden outright when the vocabulary has no stage axis: WBbt and FBbt
            put staging on the annotation rather than the term, and UBERON is
            stage-neutral. An empty block would imply the range is merely
            missing. */}
        {stages && (
          <Subsection title={STAGES}>
            <AnatomyStageRange stages={stages} ontology={ontology} />
          </Subsection>
        )}

        {/* The one section every member vocabulary can fill: WBbt and FBbt have
            no stage axis, but both assert relations the hierarchy cannot carry.
            Null only for a term the ontology says nothing else about, which in
            practice means a root. */}
        {relations && (
          <Subsection title={RELATIONS}>
            <AnatomyRelations relations={relations} term={term} />
          </Subsection>
        )}

        {/* On every anatomy page, not just UBERON's. The question — which
            animals have this structure, and what does each member call it — is
            the same from either end; only the direction of the lookup differs,
            and fetchAcrossSpecies hides that.

            Named for the mechanism rather than for the table's columns. The
            whole section exists because UBERON mapped these terms onto one
            another, and a reader cannot judge a row without knowing that.
            `Mapping` and not `group`: WBbt, ZFA, XAO and EMAPA `intestine`
            are four assertions about four animals, not four members of one
            thing. */}
        <Subsection title={UBERON_MAPPING}>
          <AnatomySpeciesTable rows={species?.rows} through={species?.through} isLoading={speciesLoading} />
        </Subsection>

        {/* Every Alliance expression annotation already carries its native
            member anatomy term, but the API can only be queried gene-first —
            /api/expression takes a required list of gene IDs — so there is no
            way to ask which genes are expressed in a term. Say so plainly
            instead of hiding the section: a reader who came here for expression
            should learn where it is, not think none exists. Not on the UBERON
            page, where expression would be a question about no species in
            particular. */}
        {!ontology.crossSpecies && (
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

        {/* Last, because it is about the vocabulary rather than the structure —
            and the only section a reader can act on. The Alliance does not
            curate anatomy; the six vocabularies do, and each has a tracker. */}
        <Subsection title={PROVENANCE}>
          <AnatomyProvenance ontology={ontology} term={term} vocabulary={vocabulary} />
        </Subsection>
      </PageData>
    </DataPage>
  );
};

export default AnatomyPage;
