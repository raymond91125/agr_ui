import React from 'react';
import PropTypes from 'prop-types';

// A string as the member wrote it, including the two tags members put inside
// one: ZFIN writes a gene symbol in a phenotype statement as `<i>acaca</i>`,
// and FlyBase writes an allele symbol as `Pink1<sup>B9</sup>`.
//
// The repo renders member markup elsewhere with dangerouslySetInnerHTML. This
// does not, because the same components will render whatever /api/anatomy/{id}
// returns once that exists, and by then the strings will not have been through
// review the way a committed fixture has. Anything that is not one of the two
// tags stays visible as text, which is the failure a reader can report.
const TAG = /<(i|sup)>(.*?)<\/\1>/g;

const ELEMENT = { i: 'i', sup: 'sup' };

const MemberText = ({ children }) => {
  const text = children || '';
  const parts = [];
  let index = 0;
  for (const match of text.matchAll(TAG)) {
    parts.push(text.slice(index, match.index), React.createElement(ELEMENT[match[1]], { key: match.index }, match[2]));
    index = match.index + match[0].length;
  }
  parts.push(text.slice(index));
  return <>{parts}</>;
};

MemberText.propTypes = {
  children: PropTypes.string,
};

export default MemberText;
