/**
 * Production Wix Forms contact adapter (Headless).
 * Evidence from production Studio site (NOT Headless project df6b8141-…):
 *   metaSiteId: 36dd9544-acf9-4e85-a01a-798f3c1efbb9  ← use with CLI `--site` + wix-site-id
 *   htmlAppId / siteId: 0ca81118-7ca8-40a7-8f97-8d06d901a556  (token --site fails for this id)
 *   formId: b8f7e551-c9bd-44a1-8371-45c115344b8f
 *   appDefinitionId (Wix Forms): 225dd912-7dea-4738-8688-4b8c6955ffc2
 * Field targets (DOM + M35 GET form-schema-service/v4/forms agree):
 *   form_field_3ba2, form_field_799d, form_field_6673, form_field_7c94
 *
 * Auth (verified M35 read-only):
 *   - Account token (no --site) + wix-site-id → 401 "MetaSite context is missing"
 *   - Site-scoped `npx @wix/cli@latest token --site <metaSiteId>` + Bearer + wix-site-id
 *     → 200 list; target form present. Do NOT treat account-token 401 as “need new API key”.
 *   - Short-lived CLI tokens must NEVER be embedded as deployed runtime credentials.
 *   - Live CreateSubmission not authorized this milestone (dry-run default; no submit probe).
 */

export const PRODUCTION_CONTACT_FORM = {
  formId: 'b8f7e551-c9bd-44a1-8371-45c115344b8f',
  componentId: 'comp-mrxgdvcl',
  metaSiteId: '36dd9544-acf9-4e85-a01a-798f3c1efbb9',
  siteId: '0ca81118-7ca8-40a7-8f97-8d06d901a556',
  formsAppDefinitionId: '225dd912-7dea-4738-8688-4b8c6955ffc2',
  namespace: 'wix.form_app.form',
  fields: {
    firstName: { target: 'form_field_3ba2', type: 'CONTACTS_FIRST_NAME' },
    lastName: { target: 'form_field_799d', type: 'CONTACTS_LAST_NAME' },
    email: { target: 'form_field_6673', type: 'CONTACTS_EMAIL' },
    message: { target: 'form_field_7c94', type: 'TEXT_AREA' },
  },
} as const;

export type ContactFormInput = {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
};

export function buildWixSubmissionPayload(input: ContactFormInput) {
  const f = PRODUCTION_CONTACT_FORM.fields;
  return {
    submission: {
      formId: PRODUCTION_CONTACT_FORM.formId,
      submissions: {
        [f.firstName.target]: input.firstName,
        [f.lastName.target]: input.lastName,
        [f.email.target]: input.email,
        [f.message.target]: input.message,
      },
    },
  };
}

export function validateContactInput(input: Partial<ContactFormInput>): string | null {
  if (!input.firstName?.trim() || !input.lastName?.trim() || !input.email?.trim() || !input.message?.trim()) {
    return 'MISSING_FIELDS';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return 'INVALID_EMAIL';
  return null;
}

export type ContactSubmitMode = 'dry-run' | 'live-blocked';

/**
 * Submit contact form. Preview/default: dry-run only (no network to Wix).
 * Live path is intentionally blocked in this milestone even if env present —
 * no real message submission authorized.
 */
export async function submitContactForm(
  input: ContactFormInput,
  opts: { mode?: ContactSubmitMode; apiKeyPresent?: boolean } = {}
): Promise<{
  ok: boolean;
  mode: ContactSubmitMode;
  error?: string;
  payloadPreview?: { formId: string; targets: string[]; messageLength: number };
}> {
  const err = validateContactInput(input);
  if (err) return { ok: false, mode: opts.mode || 'dry-run', error: err };

  const payload = buildWixSubmissionPayload({
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    message: input.message.trim(),
  });

  const preview = {
    formId: payload.submission.formId,
    targets: Object.keys(payload.submission.submissions),
    messageLength: input.message.trim().length,
  };

  const mode: ContactSubmitMode = opts.mode || 'dry-run';
  if (mode !== 'dry-run') {
    return {
      ok: false,
      mode: 'live-blocked',
      error: 'LIVE_SUBMIT_NOT_AUTHORIZED',
      payloadPreview: preview,
    };
  }

  // Dry-run: do not call Wix; do not include field values in logs.
  return { ok: true, mode: 'dry-run', payloadPreview: preview };
}

export function formsLiveSubmitBlocker(): {
  blocked: true;
  reason: string;
  exactAction: string;
  readOnlyVerified: {
    endpoint: string;
    siteScopedStatus: number;
    accountTokenStatus: number;
    targetFormPresent: boolean;
  };
  siteIds: { productionMetaSiteId: string; productionSiteId: string; headlessProjectId: string };
} {
  return {
    blocked: true,
    reason:
      'Live CreateSubmission is not authorized in this milestone. Preview/default path is dry-run only. Production form lives on Studio metaSite 36dd9544-… (verified via site-scoped CLI read); Headless project df6b8141-… has zero forms in the same namespace.',
    exactAction:
      'For a later authorized live-submit milestone: provision a durable server-only runtime credential for production metaSite 36dd9544-… (site API key or OAuth app secret in Wix/Headless env — never a short-lived CLI token, never browser/config/chat). Wire CreateSubmission server-side only to formId b8f7e551-…. Until then keep dry-run.',
    readOnlyVerified: {
      endpoint: 'GET /form-schema-service/v4/forms?namespace=wix.form_app.form',
      siteScopedStatus: 200,
      accountTokenStatus: 401,
      targetFormPresent: true,
    },
    siteIds: {
      productionMetaSiteId: PRODUCTION_CONTACT_FORM.metaSiteId,
      productionSiteId: PRODUCTION_CONTACT_FORM.siteId,
      headlessProjectId: 'df6b8141-b7d5-4d8b-8ba5-e382f5ebfd46',
    },
  };
}
