import {
  data as remixData,
  Form,
  NavLink,
  Outlet,
  useLoaderData,
} from 'react-router';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import accountStyles from '~/styles/account.css?url';

export function links() {
  return [{rel: 'stylesheet', href: accountStyles}];
}

export function shouldRevalidate() {
  return true;
}

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const {customerAccount} = context;
  const {data, errors} = await customerAccount.query(CUSTOMER_DETAILS_QUERY, {
    variables: {
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw new Error('Customer not found');
  }

  return remixData(
    {customer: data.customer},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

export default function AccountLayout() {
  /** @type {LoaderReturnData} */
  const {customer} = useLoaderData();

  const firstName = customer?.firstName;

  return (
    <div className="acct">
      <header className="acct-shell acct-masthead">
        <span className="tag acct-eyebrow" data-reveal>
          Your account
        </span>
        <h1 className="display acct-title" data-reveal style={{'--reveal-delay': '120ms'}}>
          {firstName ? (
            <>
              Welcome
              <br />
              <em>{firstName}</em>
            </>
          ) : (
            <>
              Account
              <br />
              <em>Details</em>
            </>
          )}
        </h1>
      </header>

      <div className="acct-shell">
        <AccountMenu />
      </div>

      <div className="acct-shell acct-body">
        <Outlet context={{customer}} />
      </div>
    </div>
  );
}

function AccountMenu() {
  const linkClass = ({isPending}) =>
    isPending ? 'acct-nav-link is-pending' : 'acct-nav-link';

  return (
    <nav className="acct-nav" aria-label="Account">
      <NavLink to="/account/orders" className={linkClass}>
        Orders
      </NavLink>
      <NavLink to="/account/profile" className={linkClass}>
        Profile
      </NavLink>
      <NavLink to="/account/addresses" className={linkClass}>
        Addresses
      </NavLink>
      <Logout />
    </nav>
  );
}

function Logout() {
  return (
    <Form
      className="acct-signout-form"
      method="POST"
      action="/account/logout"
    >
      <button className="acct-signout" type="submit">
        Sign out
      </button>
    </Form>
  );
}

/** @typedef {import('./+types/account').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
