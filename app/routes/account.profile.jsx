import {CUSTOMER_UPDATE_MUTATION} from '~/graphql/customer-account/CustomerUpdateMutation';
import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from 'react-router';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Profile'}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  await context.customerAccount.handleAuthStatus();

  return {};
}

/**
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  const {customerAccount} = context;

  if (request.method !== 'PUT') {
    return data({error: 'Method not allowed'}, {status: 405});
  }

  const form = await request.formData();

  try {
    const customer = {};
    const validInputKeys = ['firstName', 'lastName'];
    for (const [key, value] of form.entries()) {
      if (!validInputKeys.includes(key)) {
        continue;
      }
      if (typeof value === 'string' && value.length) {
        customer[key] = value;
      }
    }

    // update customer and possibly password
    const {data, errors} = await customerAccount.mutate(
      CUSTOMER_UPDATE_MUTATION,
      {
        variables: {
          customer,
          language: customerAccount.i18n.language,
        },
      },
    );

    if (errors?.length) {
      throw new Error(errors[0].message);
    }

    if (!data?.customerUpdate?.customer) {
      throw new Error('Customer profile update failed.');
    }

    return {
      error: null,
      customer: data?.customerUpdate?.customer,
    };
  } catch (error) {
    return data(
      {error: error.message, customer: null},
      {
        status: 400,
      },
    );
  }
}

export default function AccountProfile() {
  const account = useOutletContext();
  const {state} = useNavigation();
  /** @type {ActionReturnData} */
  const action = useActionData();
  const customer = action?.customer ?? account?.customer;

  return (
    <div className="account-profile">
      <header data-reveal>
        <h2 className="display acct-section-title">Profile</h2>
        <p className="acct-lede">
          The name we use on your orders and correspondence.
        </p>
      </header>

      <Form
        method="PUT"
        className="acct-form"
        style={{marginTop: '3rem'}}
        data-reveal
      >
        <fieldset className="acct-fieldset acct-fieldset-2">
          <div className="acct-field">
            <label className="acct-label" htmlFor="firstName">
              First name
            </label>
            <input
              className="acct-input"
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              placeholder="First name"
              defaultValue={customer.firstName ?? ''}
              minLength={2}
            />
          </div>
          <div className="acct-field">
            <label className="acct-label" htmlFor="lastName">
              Last name
            </label>
            <input
              className="acct-input"
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              placeholder="Last name"
              defaultValue={customer.lastName ?? ''}
              minLength={2}
            />
          </div>
        </fieldset>

        {action?.error ? (
          <p className="acct-error" style={{marginTop: '2rem'}} role="alert">
            {action.error}
          </p>
        ) : null}

        <div className="acct-actions">
          <button
            className="acct-btn acct-btn-primary"
            type="submit"
            disabled={state !== 'idle'}
          >
            {state !== 'idle' ? 'Saving' : 'Save changes'}
          </button>
        </div>
      </Form>
    </div>
  );
}

/**
 * @typedef {{
 *   error: string | null;
 *   customer: CustomerFragment | null;
 * }} ActionResponse
 */

/** @typedef {import('customer-accountapi.generated').CustomerFragment} CustomerFragment */
/** @typedef {import('@shopify/hydrogen/customer-account-api-types').CustomerUpdateInput} CustomerUpdateInput */
/** @typedef {import('./+types/account.profile').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
/** @typedef {ReturnType<typeof useActionData<typeof action>>} ActionReturnData */
