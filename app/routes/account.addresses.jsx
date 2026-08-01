import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from 'react-router';
import {
  UPDATE_ADDRESS_MUTATION,
  DELETE_ADDRESS_MUTATION,
  CREATE_ADDRESS_MUTATION,
} from '~/graphql/customer-account/CustomerAddressMutations';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Addresses'}];
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

  try {
    const form = await request.formData();

    const addressId = form.has('addressId')
      ? String(form.get('addressId'))
      : null;
    if (!addressId) {
      throw new Error('You must provide an address id.');
    }

    // this will ensure redirecting to login never happen for mutatation
    const isLoggedIn = await customerAccount.isLoggedIn();
    if (!isLoggedIn) {
      return data(
        {error: {[addressId]: 'Unauthorized'}},
        {
          status: 401,
        },
      );
    }

    const defaultAddress = form.has('defaultAddress')
      ? String(form.get('defaultAddress')) === 'on'
      : false;
    const address = {};
    const keys = [
      'address1',
      'address2',
      'city',
      'company',
      'territoryCode',
      'firstName',
      'lastName',
      'phoneNumber',
      'zoneCode',
      'zip',
    ];

    for (const key of keys) {
      const value = form.get(key);
      if (typeof value === 'string') {
        address[key] = value;
      }
    }

    switch (request.method) {
      case 'POST': {
        // handle new address creation
        try {
          const {data, errors} = await customerAccount.mutate(
            CREATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                defaultAddress,
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressCreate?.userErrors?.length) {
            throw new Error(data?.customerAddressCreate?.userErrors[0].message);
          }

          if (!data?.customerAddressCreate?.customerAddress) {
            throw new Error('Customer address create failed.');
          }

          return {
            error: null,
            createdAddress: data?.customerAddressCreate?.customerAddress,
            defaultAddress,
          };
        } catch (error) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      case 'PUT': {
        // handle address updates
        try {
          const {data, errors} = await customerAccount.mutate(
            UPDATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                addressId: decodeURIComponent(addressId),
                defaultAddress,
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressUpdate?.userErrors?.length) {
            throw new Error(data?.customerAddressUpdate?.userErrors[0].message);
          }

          if (!data?.customerAddressUpdate?.customerAddress) {
            throw new Error('Customer address update failed.');
          }

          return {
            error: null,
            updatedAddress: address,
            defaultAddress,
          };
        } catch (error) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      case 'DELETE': {
        // handles address deletion
        try {
          const {data, errors} = await customerAccount.mutate(
            DELETE_ADDRESS_MUTATION,
            {
              variables: {
                addressId: decodeURIComponent(addressId),
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressDelete?.userErrors?.length) {
            throw new Error(data?.customerAddressDelete?.userErrors[0].message);
          }

          if (!data?.customerAddressDelete?.deletedAddressId) {
            throw new Error('Customer address delete failed.');
          }

          return {error: null, deletedAddress: addressId};
        } catch (error) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      default: {
        return data(
          {error: {[addressId]: 'Method not allowed'}},
          {
            status: 405,
          },
        );
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      return data(
        {error: error.message},
        {
          status: 400,
        },
      );
    }
    return data(
      {error},
      {
        status: 400,
      },
    );
  }
}

export default function Addresses() {
  const {customer} = useOutletContext();
  const {defaultAddress, addresses} = customer;

  return (
    <div className="account-addresses">
      <header data-reveal>
        <h2 className="display acct-section-title">Addresses</h2>
        <p className="acct-lede">
          Where your orders are sent. Set one as default to speed up checkout.
        </p>
      </header>

      <section style={{marginTop: '3.5rem'}} data-reveal>
        <span className="tag acct-panel-label">New address</span>
        <NewAddressForm key={addresses.nodes.length} />
      </section>

      <section style={{marginTop: '5rem'}} data-reveal>
        <span className="tag acct-panel-label">Saved addresses</span>
        {!addresses.nodes.length ? (
          <div className="acct-empty">
            <p className="acct-lede">You have no addresses saved.</p>
          </div>
        ) : (
          <ExistingAddresses
            addresses={addresses}
            defaultAddress={defaultAddress}
          />
        )}
      </section>
    </div>
  );
}

function NewAddressForm() {
  const newAddress = {
    address1: '',
    address2: '',
    city: '',
    company: '',
    territoryCode: '',
    firstName: '',
    id: 'new',
    lastName: '',
    phoneNumber: '',
    zoneCode: '',
    zip: '',
  };

  return (
    <AddressForm
      addressId={'NEW_ADDRESS_ID'}
      address={newAddress}
      defaultAddress={null}
    >
      {({stateForMethod}) => (
        <div className="acct-actions">
          <button
            className="acct-btn acct-btn-primary"
            disabled={stateForMethod('POST') !== 'idle'}
            formMethod="POST"
            type="submit"
          >
            {stateForMethod('POST') !== 'idle' ? 'Creating' : 'Create address'}
          </button>
        </div>
      )}
    </AddressForm>
  );
}

/**
 * @param {Pick<CustomerFragment, 'addresses' | 'defaultAddress'>}
 */
function ExistingAddresses({addresses, defaultAddress}) {
  return (
    <div className="acct-address-list">
      {addresses.nodes.map((address) => (
        <div className="acct-address" key={address.id}>
          <div className="acct-address-head">
            <p className="acct-line-title">
              {[address.firstName, address.lastName]
                .filter(Boolean)
                .join(' ') || address.address1}
            </p>
            {defaultAddress?.id === address.id && (
              <span className="acct-badge">Default</span>
            )}
          </div>
          <AddressForm
            addressId={address.id}
            address={address}
            defaultAddress={defaultAddress}
          >
            {({stateForMethod}) => (
              <div className="acct-actions">
                <button
                  className="acct-btn acct-btn-primary"
                  disabled={stateForMethod('PUT') !== 'idle'}
                  formMethod="PUT"
                  type="submit"
                >
                  {stateForMethod('PUT') !== 'idle' ? 'Saving' : 'Save'}
                </button>
                <button
                  className="acct-btn acct-btn-quiet"
                  disabled={stateForMethod('DELETE') !== 'idle'}
                  formMethod="DELETE"
                  type="submit"
                >
                  {stateForMethod('DELETE') !== 'idle' ? 'Deleting' : 'Delete'}
                </button>
              </div>
            )}
          </AddressForm>
        </div>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   addressId: AddressFragment['id'];
 *   address: CustomerAddressInput;
 *   defaultAddress: CustomerFragment['defaultAddress'];
 *   children: (props: {
 *     stateForMethod: (method: 'PUT' | 'POST' | 'DELETE') => Fetcher['state'];
 *   }) => React.ReactNode;
 * }}
 */
export function AddressForm({addressId, address, defaultAddress, children}) {
  const {state, formMethod} = useNavigation();
  /** @type {ActionReturnData} */
  const action = useActionData();
  const error = action?.error?.[addressId];
  const isDefaultAddress = defaultAddress?.id === addressId;
  const uid = (name) => `${addressId}-${name}`;
  const fields = [
    ['firstName', 'First name', {autoComplete: 'given-name', required: true}],
    ['lastName', 'Last name', {autoComplete: 'family-name', required: true}],
    ['company', 'Company', {autoComplete: 'organization'}],
    [
      'address1',
      'Address line 1',
      {autoComplete: 'address-line1', required: true, wide: true},
    ],
    [
      'address2',
      'Address line 2',
      {autoComplete: 'address-line2', wide: true},
    ],
    ['city', 'City', {autoComplete: 'address-level2', required: true}],
    [
      'zoneCode',
      'State / Province',
      {autoComplete: 'address-level1', required: true},
    ],
    ['zip', 'Zip / Postal code', {autoComplete: 'postal-code', required: true}],
    [
      'territoryCode',
      'Country code',
      {autoComplete: 'country', required: true, maxLength: 2},
    ],
    [
      'phoneNumber',
      'Phone',
      {autoComplete: 'tel', type: 'tel', pattern: '^\\+?[1-9]\\d{3,14}$'},
    ],
  ];

  return (
    <Form id={addressId} className="acct-form">
      <fieldset className="acct-fieldset acct-fieldset-2">
        <input type="hidden" name="addressId" defaultValue={addressId} />
        {fields.map(([name, label, opts]) => (
          <div
            className={`acct-field${opts.wide ? ' acct-field-wide' : ''}`}
            key={name}
          >
            <label className="acct-label" htmlFor={uid(name)}>
              {label}
              {opts.required ? ' *' : ''}
            </label>
            <input
              className="acct-input"
              id={uid(name)}
              name={name}
              type={opts.type ?? 'text'}
              autoComplete={opts.autoComplete}
              defaultValue={address?.[name] ?? ''}
              required={opts.required}
              maxLength={opts.maxLength}
              pattern={opts.pattern}
            />
          </div>
        ))}

        <div className="acct-field acct-field-wide">
          <div className="acct-check">
            <input
              defaultChecked={isDefaultAddress}
              id={uid('defaultAddress')}
              name="defaultAddress"
              type="checkbox"
            />
            <label htmlFor={uid('defaultAddress')}>
              Set as default address
            </label>
          </div>
        </div>
      </fieldset>

      {error ? (
        <p className="acct-error" style={{marginTop: '2rem'}} role="alert">
          {error}
        </p>
      ) : null}

      {children({
        stateForMethod: (method) => (formMethod === method ? state : 'idle'),
      })}
    </Form>
  );
}

/**
 * @typedef {{
 *   addressId?: string | null;
 *   createdAddress?: AddressFragment;
 *   defaultAddress?: string | null;
 *   deletedAddress?: string | null;
 *   error: Record<AddressFragment['id'], string> | null;
 *   updatedAddress?: AddressFragment;
 * }} ActionResponse
 */

/** @typedef {import('@shopify/hydrogen/customer-account-api-types').CustomerAddressInput} CustomerAddressInput */
/** @typedef {import('customer-accountapi.generated').AddressFragment} AddressFragment */
/** @typedef {import('customer-accountapi.generated').CustomerFragment} CustomerFragment */
/** @template T @typedef {import('react-router').Fetcher<T>} Fetcher */
/** @typedef {import('./+types/account.addresses').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
/** @typedef {ReturnType<typeof useActionData<typeof action>>} ActionReturnData */
