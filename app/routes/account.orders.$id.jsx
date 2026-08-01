import {Link, redirect, useLoaderData} from 'react-router';
import {Money, Image} from '@shopify/hydrogen';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data}) => {
  return [{title: `Order ${data?.order?.name}`}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({params, context}) {
  const {customerAccount} = context;
  if (!params.id) {
    return redirect('/account/orders');
  }

  const orderId = atob(params.id);
  const {data, errors} = await customerAccount.query(CUSTOMER_ORDER_QUERY, {
    variables: {
      orderId,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.order) {
    throw new Error('Order not found');
  }

  const {order} = data;

  // Extract line items directly from nodes array
  const lineItems = order.lineItems.nodes;

  // Extract discount applications directly from nodes array
  const discountApplications = order.discountApplications.nodes;

  // Get fulfillment status from first fulfillment node
  const fulfillmentStatus = order.fulfillments.nodes[0]?.status ?? 'N/A';

  // Get first discount value with proper type checking
  const firstDiscount = discountApplications[0]?.value;

  // Type guard for MoneyV2 discount
  const discountValue =
    firstDiscount?.__typename === 'MoneyV2' ? firstDiscount : null;

  // Type guard for percentage discount
  const discountPercentage =
    firstDiscount?.__typename === 'PricingPercentageValue'
      ? firstDiscount.percentage
      : null;

  return {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  };
}

export default function OrderRoute() {
  /** @type {LoaderReturnData} */
  const {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  } = useLoaderData();
  return (
    <div className="account-order">
      <header data-reveal>
        <Link className="acct-link" to="/account/orders">
          ← All orders
        </Link>
        <h2 className="display acct-section-title" style={{marginTop: '2rem'}}>
          Order {order.name}
        </h2>
        <p className="acct-lede tabular">
          Placed{' '}
          {new Date(order.processedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
          {order.confirmationNumber
            ? ` · Confirmation ${order.confirmationNumber}`
            : ''}
        </p>
      </header>

      <div style={{marginTop: '3.5rem'}} data-reveal>
        <div className="acct-table-head" aria-hidden="true">
          <span className="acct-th">Item</span>
          <span className="acct-th acct-th-right">Price</span>
          <span className="acct-th acct-th-right">Qty</span>
          <span className="acct-th acct-th-right">Total</span>
        </div>
        <div className="acct-lines">
          {lineItems.map((lineItem, lineItemIndex) => (
            // eslint-disable-next-line react/no-array-index-key
            <OrderLineRow key={lineItemIndex} lineItem={lineItem} />
          ))}
        </div>

        <dl className="acct-totals">
          {(discountValue?.amount || discountPercentage) && (
            <div className="acct-total-row">
              <dt>Discounts</dt>
              <dd>
                {discountPercentage ? (
                  <span>-{discountPercentage}% off</span>
                ) : (
                  discountValue && <Money data={discountValue} />
                )}
              </dd>
            </div>
          )}
          <div className="acct-total-row">
            <dt>Subtotal</dt>
            <dd>
              <Money data={order.subtotal} />
            </dd>
          </div>
          <div className="acct-total-row">
            <dt>Tax</dt>
            <dd>
              <Money data={order.totalTax} />
            </dd>
          </div>
          <div className="acct-total-row acct-total-grand">
            <dt>Total</dt>
            <dd>
              <Money data={order.totalPrice} />
            </dd>
          </div>
        </dl>

        <div className="acct-panels" data-reveal>
          <div className="acct-panel">
            <span className="tag acct-panel-label">Shipping</span>
            {order?.shippingAddress ? (
              <address>
                {order.shippingAddress.name}
                {order.shippingAddress.formatted ? (
                  <>
                    <br />
                    {order.shippingAddress.formatted}
                  </>
                ) : null}
                {order.shippingAddress.formattedArea ? (
                  <>
                    <br />
                    {order.shippingAddress.formattedArea}
                  </>
                ) : null}
              </address>
            ) : (
              <p className="acct-lede">No shipping address on file.</p>
            )}
          </div>
          <div className="acct-panel">
            <span className="tag acct-panel-label">Status</span>
            <span className="acct-status">{fulfillmentStatus}</span>
          </div>
          <div className="acct-panel">
            <span className="tag acct-panel-label">Tracking</span>
            <a
              className="acct-link"
              target="_blank"
              href={order.statusPageUrl}
              rel="noreferrer"
            >
              View order status ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{lineItem: OrderLineItemFullFragment}}
 */
function OrderLineRow({lineItem}) {
  return (
    <div className="acct-line">
      <div className="acct-line-product">
        {lineItem?.image && (
          <div className="acct-line-img">
            <Image
              data={lineItem.image}
              width={96}
              height={96}
              alt={lineItem.title}
              className="img-mono"
            />
          </div>
        )}
        <div>
          <p className="acct-line-title">{lineItem.title}</p>
          {lineItem.variantTitle && (
            <p className="acct-line-variant">{lineItem.variantTitle}</p>
          )}
        </div>
      </div>
      <div className="acct-row-meta acct-td-right">
        <Money data={lineItem.price} />
      </div>
      <div className="acct-row-meta acct-td-right">×{lineItem.quantity}</div>
      <div className="acct-row-total acct-td-right">
        <Money data={lineItem.totalDiscount} />
      </div>
    </div>
  );
}

/** @typedef {import('./+types/account.orders.$id').Route} Route */
/** @typedef {import('customer-accountapi.generated').OrderLineItemFullFragment} OrderLineItemFullFragment */
/** @typedef {import('customer-accountapi.generated').OrderQuery} OrderQuery */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
