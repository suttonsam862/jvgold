import {useFetcher, useNavigate} from 'react-router';
import React, {useRef, useEffect} from 'react';
import {useAside} from './Aside';

export const SEARCH_ENDPOINT = '/search';

/**
 * JV Gold styling for the drawer's search form.
 *
 * The input and the submit button are supplied by the caller as render-prop
 * children (see PageLayout's SearchAside), so the form styles them from the
 * outside: one oversized, chromeless field sitting on a hairline rule that
 * warms to gold on focus, and a quiet letterspaced submit label.
 */
const PREDICTIVE_SEARCH_FORM_CLASS = [
  'predictive-search-form',
  'flex items-center gap-4 border-b rule pb-3 transition-colors duration-300',
  'focus-within:border-gold',
  // the search field
  '[&_input]:min-w-0 [&_input]:flex-1 [&_input]:appearance-none',
  '[&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0 [&_input]:outline-none',
  '[&_input]:font-display [&_input]:text-[1.375rem] [&_input]:uppercase',
  '[&_input]:tracking-[0.02em] [&_input]:leading-none [&_input]:text-onyx',
  '[&_input::placeholder]:text-steel',
  '[&_input::-webkit-search-cancel-button]:appearance-none',
  // the submit control
  '[&_button]:shrink-0 [&_button]:cursor-pointer [&_button]:border-0 [&_button]:bg-transparent [&_button]:p-0',
  '[&_button]:font-display [&_button]:text-[0.6875rem] [&_button]:font-medium',
  '[&_button]:uppercase [&_button]:tracking-[0.22em] [&_button]:text-gold',
  '[&_button]:transition-opacity [&_button]:duration-300',
  '[&_button:hover]:opacity-70',
  '[&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-4 [&_button:focus-visible]:outline-gold',
].join(' ');

/**
 *  Search form component that sends search requests to the `/search` route
 * @param {SearchFormPredictiveProps}
 */
export function SearchFormPredictive({
  children,
  className = PREDICTIVE_SEARCH_FORM_CLASS,
  ...props
}) {
  const fetcher = useFetcher({key: 'search'});
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const aside = useAside();

  /** Reset the input value and blur the input */
  function resetInput(event) {
    event.preventDefault();
    event.stopPropagation();
    if (inputRef?.current?.value) {
      inputRef.current.blur();
    }
  }

  /** Navigate to the search page with the current input value */
  function goToSearch() {
    const term = inputRef?.current?.value;
    void navigate(SEARCH_ENDPOINT + (term ? `?q=${term}` : ''));
    aside.close();
  }

  /** Fetch search results based on the input value */
  function fetchResults(event) {
    void fetcher.submit(
      {q: event.target.value || '', limit: 5, predictive: true},
      {method: 'GET', action: SEARCH_ENDPOINT},
    );
  }

  // ensure the passed input has a type of search, because SearchResults
  // will select the element based on the input
  useEffect(() => {
    inputRef?.current?.setAttribute('type', 'search');
  }, []);

  if (typeof children !== 'function') {
    return null;
  }

  return (
    <fetcher.Form {...props} className={className} onSubmit={resetInput}>
      {children({inputRef, fetcher, fetchResults, goToSearch})}
    </fetcher.Form>
  );
}

/**
 * @typedef {(args: {
 *   fetchResults: (event: React.ChangeEvent<HTMLInputElement>) => void;
 *   goToSearch: () => void;
 *   inputRef: React.MutableRefObject<HTMLInputElement | null>;
 *   fetcher: Fetcher<PredictiveSearchReturn>;
 * }) => React.ReactNode} SearchFormPredictiveChildren
 */
/**
 * @typedef {Omit<FormProps, 'children'> & {
 *   children: SearchFormPredictiveChildren | null;
 * }} SearchFormPredictiveProps
 */

/** @typedef {import('react-router').FormProps} FormProps */
/** @template T @typedef {import('react-router').Fetcher<T>} Fetcher */
/** @typedef {import('~/lib/search').PredictiveSearchReturn} PredictiveSearchReturn */
