import {
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from 'react-router';
import {useRef} from 'react';
import {
  Money,
  getPaginationVariables,
  flattenConnection,
} from '@shopify/hydrogen';
import {
  buildOrderSearchQuery,
  parseOrderFilters,
  ORDER_FILTER_FIELDS,
} from '~/lib/orderFilters';
import {CUSTOMER_ORDERS_QUERY} from '~/graphql/customer-account/CustomerOrdersQuery';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Orders'}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({request, context}) {
  const {customerAccount} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 20,
  });

  const url = new URL(request.url);
  const filters = parseOrderFilters(url.searchParams);
  const query = buildOrderSearchQuery(filters);

  const {data, errors} = await customerAccount.query(CUSTOMER_ORDERS_QUERY, {
    variables: {
      ...paginationVariables,
      query,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw Error('Customer orders not found');
  }

  return {customer: data.customer, filters};
}

export default function Orders() {
  /** @type {LoaderReturnData} */
  const {customer, filters} = useLoaderData();
  const {orders} = customer;

  return (
    <div className="orders">
      <header data-reveal>
        <h2 className="display acct-section-title">Orders</h2>
        <p className="acct-lede">
          Every order you have placed, newest first.
        </p>
      </header>
      <OrderSearchForm currentFilters={filters} />
      <OrdersTable orders={orders} filters={filters} />
    </div>
  );
}

/**
 * @param {{
 *   orders: CustomerOrdersFragment['orders'];
 *   filters: OrderFilterParams;
 * }}
 */
function OrdersTable({orders, filters}) {
  const hasFilters = !!(filters.name || filters.confirmationNumber);

  return (
    <div className="acccount-orders" aria-live="polite">
      {orders?.nodes.length ? (
        <>
          <div className="acct-table-head" aria-hidden="true">
            <span className="acct-th">Order</span>
            <span className="acct-th">Placed</span>
            <span className="acct-th">Status</span>
            <span className="acct-th acct-th-right">Total</span>
            <span className="acct-th acct-th-right">&nbsp;</span>
          </div>
          <PaginatedResourceSection connection={orders}>
            {({node: order}) => <OrderItem key={order.id} order={order} />}
          </PaginatedResourceSection>
        </>
      ) : (
        <EmptyOrders hasFilters={hasFilters} />
      )}
    </div>
  );
}

/**
 * @param {{hasFilters?: boolean}}
 */
function EmptyOrders({hasFilters = false}) {
  return (
    <div className="acct-empty" data-reveal>
      {hasFilters ? (
        <>
          <p className="acct-lede">No orders match that search.</p>
          <div className="acct-actions">
            <Link className="acct-btn" to="/account/orders">
              Clear filters
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="acct-lede">
            No orders yet. When you place one, it will live here.
          </p>
          <div className="acct-actions">
            <Link className="acct-btn acct-btn-primary" to="/collections">
              Start shopping
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * @param {{
 *   currentFilters: OrderFilterParams;
 * }}
 */
function OrderSearchForm({currentFilters}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isSearching =
    navigation.state !== 'idle' &&
    navigation.location?.pathname?.includes('orders');
  const formRef = useRef(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    const name = formData.get(ORDER_FILTER_FIELDS.NAME)?.toString().trim();
    const confirmationNumber = formData
      .get(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER)
      ?.toString()
      .trim();

    if (name) params.set(ORDER_FILTER_FIELDS.NAME, name);
    if (confirmationNumber)
      params.set(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER, confirmationNumber);

    setSearchParams(params);
  };

  const hasFilters = currentFilters.name || currentFilters.confirmationNumber;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="order-search-form acct-search"
      aria-label="Search orders"
      style={{marginTop: '3rem'}}
      data-reveal
    >
      <div className="acct-search-row">
        <div className="acct-field">
          <label className="acct-label" htmlFor="order-search-name">
            Order number
          </label>
          <input
            id="order-search-name"
            type="search"
            name={ORDER_FILTER_FIELDS.NAME}
            placeholder="1001"
            defaultValue={currentFilters.name || ''}
            className="acct-input"
          />
        </div>
        <div className="acct-field">
          <label className="acct-label" htmlFor="order-search-confirmation">
            Confirmation number
          </label>
          <input
            id="order-search-confirmation"
            type="search"
            name={ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER}
            placeholder="ABC123"
            defaultValue={currentFilters.confirmationNumber || ''}
            className="acct-input"
          />
        </div>
        <div className="acct-actions" style={{marginTop: 0}}>
          <button className="acct-btn" type="submit" disabled={isSearching}>
            {isSearching ? 'Searching' : 'Search'}
          </button>
          {hasFilters && (
            <button
              className="acct-btn acct-btn-quiet"
              type="button"
              disabled={isSearching}
              onClick={() => {
                setSearchParams(new URLSearchParams());
                formRef.current?.reset();
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

/**
 * @param {{order: OrderItemFragment}}
 */
function OrderItem({order}) {
  const fulfillmentStatus = flattenConnection(order.fulfillments)[0]?.status;
  return (
    <Link
      className="acct-row"
      to={`/account/orders/${btoa(order.id)}`}
      aria-label={`View order ${order.number}`}
      data-reveal
    >
      <span className="acct-row-num">#{order.number}</span>
      <span className="acct-row-meta">
        {new Date(order.processedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
        {order.confirmationNumber ? ` · ${order.confirmationNumber}` : ''}
      </span>
      <span>
        <span className="acct-status">
          {fulfillmentStatus || order.financialStatus}
        </span>
      </span>
      <span className="acct-row-total acct-td-right">
        <Money data={order.totalPrice} />
      </span>
      <span className="acct-row-cta acct-td-right">View</span>
    </Link>
  );
}

/**
 * @typedef {{
 *   customer: CustomerOrdersFragment;
 *   filters: OrderFilterParams;
 * }} OrdersLoaderData
 */

/** @typedef {import('./+types/account.orders._index').Route} Route */
/** @typedef {import('~/lib/orderFilters').OrderFilterParams} OrderFilterParams */
/** @typedef {import('customer-accountapi.generated').CustomerOrdersFragment} CustomerOrdersFragment */
/** @typedef {import('customer-accountapi.generated').OrderItemFragment} OrderItemFragment */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
