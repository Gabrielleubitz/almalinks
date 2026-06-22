/**
 * HubSpot's tracking script (js.hs-scripts.com) auto-collects native HTML forms and
 * heuristically maps fields to CRM properties — often putting names into "Company name".
 * Forms are grouped by CSS class (e.g. ".space-y-6"), which corrupts contact data.
 *
 * @see https://knowledge.hubspot.com/forms/non-hubspot-forms-faq
 */

/** Spread onto any in-app `<form>` so HubSpot skips non-HubSpot form collection. */
export const hubspotDoNotCollectFormProps = {
  'data-hs-do-not-collect': 'true',
} as const;

export function markHubspotDoNotCollectOnForms(root: ParentNode = document) {
  root.querySelectorAll('form').forEach((form) => {
    if (!form.hasAttribute('data-hs-do-not-collect')) {
      form.setAttribute('data-hs-do-not-collect', 'true');
    }
  });
}
