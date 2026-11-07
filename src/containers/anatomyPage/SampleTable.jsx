import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

import ExternalLink from '../../components/ExternalLink.jsx';

// A count first, then either the whole table or a way out to the member.
//
// Taken from how the members themselves handle scale. FlyBase renders
// `11,313 alleles` as a count that links into its own search rather than a
// table, because no table could hold it; ZFIN shows twelve figure thumbnails
// inline, because twelve fits. The rule that falls out is the same one either
// way: a table is worth rendering when it is the whole answer, and a count is
// worth more than a table when it is not.
//
// So under the threshold the rows appear outright and the section needs no
// caveat, because what is shown is what there is. Over it the count leads, the
// member's own page is offered as the place with all of them, and the rows are
// behind a toggle and labelled as the slice they are. The slice is kept rather
// than dropped because it carries the one thing a count cannot: which entries
// are the well studied ones, and that is how the vulval induction pathway and
// tbxta surfaced as checks on this data in the first place.
export const SAMPLE_THRESHOLD = 25;

// `ranked` is how the slice was chosen, and it has to be said rather than
// assumed: the gene tables keep the most annotated, and the reference table
// keeps the most cited, which is the same cut made from the other end.
// `widget` names the part of the member's own page that answers this
// section. Only WormBase uses it — its term page loads each widget
// separately, so a link without one lands on a page with the relevant part
// still shut. Every other member serves a whole page and ignores it.
const SampleTable = ({ total, shown, noun, ranked = 'annotated', ontology, term, widget, children }) => {
  const complete = total <= SAMPLE_THRESHOLD;
  const [open, setOpen] = useState(complete);

  if (complete) {
    return children;
  }

  return (
    <>
      <p className="text-muted">
        <button className="btn btn-link btn-sm p-0 align-baseline" onClick={() => setOpen((prev) => !prev)}>
          <FontAwesomeIcon icon={open ? faCaretUp : faCaretDown} />{' '}
          {open ? 'Hide' : `Show the ${shown} most ${ranked} ${noun}`}
        </button>
        {ontology?.mod && (
          <>
            {' · '}
            {/* Named as the member's page, not as "all N of them there".
                The count belongs to our data; what the member lists under
                this term is its own business and often a different shape —
                WormBase has an Associations widget, not a list of mutations.
                Promising the full set would be a claim about a page we do
                not control. */}
            <ExternalLink href={ontology.termUrl(term.curie, widget)}>View this term at {ontology.mod}</ExternalLink>
          </>
        )}
      </p>
      {open && children}
    </>
  );
};

SampleTable.propTypes = {
  total: PropTypes.number.isRequired,
  shown: PropTypes.number.isRequired,
  noun: PropTypes.string.isRequired,
  ranked: PropTypes.string,
  ontology: PropTypes.object,
  term: PropTypes.object.isRequired,
  widget: PropTypes.string,
  children: PropTypes.node,
};

export default SampleTable;
