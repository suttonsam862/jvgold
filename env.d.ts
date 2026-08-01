/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

// Demo/preview credentials for the two preview gates — /private (staff) and
// /portal (parent/athlete). Not real customer auth — see app/lib/demoAuth.ts.
declare global {
  interface Env {
    DEMO_LOGIN_EMAIL?: string;
    DEMO_LOGIN_PASSWORD?: string;
    DEMO_CUSTOMER_EMAIL?: string;
    DEMO_CUSTOMER_PASSWORD?: string;
  }
}
