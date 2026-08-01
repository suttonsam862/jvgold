import * as React from 'react';
import {Pagination} from '@shopify/hydrogen';

/**
 * Shared pagination chrome: a single restrained outlined control above and
 * below the resource list. Hydrogen renders the anchors, so they are reached
 * with a descendant variant rather than a class on the element itself.
 */
const navClass =
  'flex justify-center empty:hidden ' +
  '[&_a]:inline-flex [&_a]:items-center [&_a]:gap-3 [&_a]:border [&_a]:border-onyx/20 ' +
  '[&_a]:px-8 [&_a]:py-4 [&_a]:font-display [&_a]:text-[0.7rem] [&_a]:font-bold ' +
  '[&_a]:uppercase [&_a]:tracking-[0.18em] [&_a]:text-onyx [&_a]:no-underline ' +
  '[&_a]:transition-colors [&_a]:duration-500 ' +
  '[&_a:hover]:border-onyx [&_a:hover]:bg-onyx [&_a:hover]:text-stone';

/**
 * <PaginatedResourceSection> encapsulates the previous and next pagination behaviors throughout your application.
 * @param {Class<Pagination<NodesType>>['connection']>}
 */
export function PaginatedResourceSection({
  connection,
  children,
  ariaLabel,
  resourcesClassName,
}) {
  return (
    <Pagination connection={connection}>
      {({nodes, isLoading, PreviousLink, NextLink}) => {
        const resourcesMarkup = nodes.map((node, index) =>
          children({node, index}),
        );

        return (
          <div>
            <div className={`${navClass} pb-12`}>
              <PreviousLink>
                {isLoading ? (
                  'Loading'
                ) : (
                  <span>
                    <span aria-hidden="true">&#8593;</span>&nbsp;&nbsp;Earlier
                  </span>
                )}
              </PreviousLink>
            </div>
            {resourcesClassName ? (
              <div
                aria-label={ariaLabel}
                className={resourcesClassName}
                role={ariaLabel ? 'region' : undefined}
              >
                {resourcesMarkup}
              </div>
            ) : (
              resourcesMarkup
            )}
            <div className={`${navClass} pt-16`}>
              <NextLink>
                {isLoading ? (
                  'Loading'
                ) : (
                  <span>
                    See more&nbsp;&nbsp;<span aria-hidden="true">&#8595;</span>
                  </span>
                )}
              </NextLink>
            </div>
          </div>
        );
      }}
    </Pagination>
  );
}
