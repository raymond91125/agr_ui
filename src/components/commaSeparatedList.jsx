import React, { useId } from 'react';
import PropTypes from 'prop-types';

import style from './style.module.scss';

// Renders a real <ul>, so it cannot go inside a <p>: the browser closes the
// paragraph before the list, React hydrates against a tree that does not match
// what it rendered, and the console fills with nesting warnings. Callers
// wanting a muted line of prose around one should use
// `<div className="text-muted mb-3">` instead, which is the same height —
// Bootstrap's $spacer and $paragraph-margin-bottom are both 1rem.
const CommaSeparatedList = ({ children, listItemClassName }) => {
  const id = useId();
  return (
    <ul className={style.commaSeparatedList}>
      {React.Children.map(children, (child, index) => (
        <li key={`${id}-${index}`} className={listItemClassName}>
          {child}
        </li>
      ))}
    </ul>
  );
};

CommaSeparatedList.propTypes = {
  children: PropTypes.node,
  listItemClassName: PropTypes.string,
};

export default CommaSeparatedList;
