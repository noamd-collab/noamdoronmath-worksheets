/**
 * Production Wix Forms contact adapter (Headless).
 * Evidence from production Studio site (NOT Headless project df6b8141-…):
 *   metaSiteId: 36dd9544-acf9-4e85-a01a-798f3c1efbb9
 *   htmlAppId / siteId: 0ca81118-7ca8-40a7-8f97-8d06d901a556
 *   formId: b8f7e551-c9bd-44a1-8371-45c115344b8f
 *   appDefinitionId (Wix Forms): 225dd912-7dea-4738-8688-4b8c6955ffc2
 * Field targets: form_field_3ba2 / 799d / 6673 / 7c94
 *
 * Live CreateSubmission requires:
 *   - env WIX_FORMS_API_KEY starting with IST. (site-scoped API key)
 *   - env WIX_FORMS_LIVE_SUBMIT=1 (explicit Noam approval gate)
 * Never log the API key or message bodies.
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
  createSubmissionUrl: 'https://www.wixapis.com/form-submission-service/v4/submissions',
} as const;

export type ContactFormInput = {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  /** Honeypot — must be empty. */
  company?: string;
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
  if (input.company && String(input.company).trim()) return 'SPAM_REJECTED';
  if (!input.firstName?.trim() || !input.lastName?.trim() || !input.email?.trim() || !input.message?.trim()) {
    return 'MISSING_FIELDS';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return 'INVALID_EMAIL';
  if (input.message.trim().length > 5000) return 'MESSAGE_TOO_LONG';
  return null;
}

export type ContactSubmitMode = 'dry-run' | 'live' | 'live-blocked';

function formsApiKey(): string {
  try {
    return String((process.env as Record<string, string | undefined>).WIX_FORMS_API_KEY || '').trim();
  } catch {
    return '';
  }
}

function liveSubmitFlagEnabled(): boolean {
  try {
    const v = String((process.env as Record<string, string | undefined>).WIX_FORMS_LIVE_SUBMIT || '')
      .trim()
      .toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  } catch {
    return false;
  }
}

export function formsCredentialStatus(): {
  apiKeyPresent: boolean;
  apiKeyLooksValid: boolean;
  liveFlag: boolean;
  readyForLive: boolean;
  needsNoam: string | null;
} {
  const key = formsApiKey();
  const apiKeyPresent = key.length > 0;
  const apiKeyLooksValid = key.startsWith('IST.');
  const liveFlag = liveSubmitFlagEnabled();
  let needsNoam: string | null = null;
  if (!apiKeyLooksValid) {
    needsNoam =
      'Create a new Wix API key scoped to production metaSite 36dd9544-… with Wix Forms permissions (key must start with IST.). Store as WIX_FORMS_API_KEY via `wix env set`. Current value is not a valid site API key (401 MetaSite context / no IST. prefix).';
  } else if (!liveFlag) {
    needsNoam =
      'Credential looks valid (IST.). Set WIX_FORMS_LIVE_SUBMIT=1 only after Noam approves a real test send.';
  }
  return {
    apiKeyPresent,
    apiKeyLooksValid,
    liveFlag,
    readyForLive: apiKeyLooksValid && liveFlag,
    needsNoam,
  };
}

/**
 * Submit contact form.
 * Default: dry-run (no network).
 * Live: only when IST. key + WIX_FORMS_LIVE_SUBMIT=1. Never log secrets/bodies.
 */
export async function submitContactForm(
  input: ContactFormInput,
  opts: { mode?: ContactSubmitMode } = {}
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

  const cred = formsCredentialStatus();
  const wantLive = opts.mode === 'live' || (opts.mode == null && cred.readyForLive);

  if (!wantLive) {
    return { ok: true, mode: 'dry-run', payloadPreview: preview };
  }

  if (!cred.apiKeyLooksValid) {
    return {
      ok: false,
      mode: 'live-blocked',
      error: 'FORMS_API_KEY_INVALID',
      payloadPreview: preview,
    };
  }
  if (!cred.liveFlag) {
    return {
      ok: false,
      mode: 'live-blocked',
      error: 'LIVE_SUBMIT_NOT_AUTHORIZED',
      payloadPreview: preview,
    };
  }

  const key = formsApiKey();
  try {
    const res = await fetch(PRODUCTION_CONTACT_FORM.createSubmissionUrl, {
      method: 'POST',
      headers: {
        Authorization: key,
        'Content-Type': 'application/json',
        'wix-site-id': PRODUCTION_CONTACT_FORM.metaSiteId,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return {
        ok: false,
        mode: 'live',
        error: `WIX_SUBMIT_HTTP_${res.status}`,
        payloadPreview: preview,
      };
    }
    return { ok: true, mode: 'live', payloadPreview: preview };
  } catch {
    return {
      ok: false,
      mode: 'live',
      error: 'WIX_SUBMIT_NETWORK',
      payloadPreview: preview,
    };
  }
}

export function formsLiveSubmitBlocker(): {
  blocked: boolean;
  reason: string;
  exactAction: string;
  credential: ReturnType<typeof formsCredentialStatus>;
  siteIds: { productionMetaSiteId: string; productionSiteId: string; headlessProjectId: string };
} {
  const credential = formsCredentialStatus();
  return {
    blocked: !credential.readyForLive,
    reason: credential.readyForLive
      ? 'Live submit gate open (IST. key + WIX_FORMS_LIVE_SUBMIT). Still requires Noam approval before intentional test send.'
      : 'Live CreateSubmission gated. Preview/default path is dry-run.',
    exactAction:
      credential.needsNoam ||
      'Ready for Noam-approved test send: POST /api/contact-form with real fields (honeypot empty).',
    credential: {
      apiKeyPresent: credential.apiKeyPresent,
      apiKeyLooksValid: credential.apiKeyLooksValid,
      liveFlag: credential.liveFlag,
      readyForLive: credential.readyForLive,
      needsNoam: credential.needsNoam,
    },
    siteIds: {
      productionMetaSiteId: PRODUCTION_CONTACT_FORM.metaSiteId,
      productionSiteId: PRODUCTION_CONTACT_FORM.siteId,
      headlessProjectId: 'df6b8141-b7d5-4d8b-8ba5-e382f5ebfd46',
    },
  };
}
