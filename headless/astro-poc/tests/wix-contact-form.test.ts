/**
 * Contact form adapter unit tests — dry-run only; no live Wix submit.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PRODUCTION_CONTACT_FORM,
  buildWixSubmissionPayload,
  submitContactForm,
  formsLiveSubmitBlocker,
  formsCredentialStatus,
  validateContactInput,
} from '../src/lib/wixContactForm.ts';

describe('M35 Wix contact form adapter', () => {
  it('maps production field targets (verified DOM) and builds submission payload', () => {
    assert.equal(PRODUCTION_CONTACT_FORM.formId, 'b8f7e551-c9bd-44a1-8371-45c115344b8f');
    assert.equal(PRODUCTION_CONTACT_FORM.siteId, '0ca81118-7ca8-40a7-8f97-8d06d901a556');
    assert.notEqual(
      PRODUCTION_CONTACT_FORM.metaSiteId,
      'df6b8141-b7d5-4d8b-8ba5-e382f5ebfd46'
    );
    const payload = buildWixSubmissionPayload({
      firstName: 'א',
      lastName: 'ב',
      email: 'a@b.co',
      message: 'שלום',
    });
    assert.equal(payload.submission.formId, PRODUCTION_CONTACT_FORM.formId);
    assert.equal(payload.submission.submissions.form_field_3ba2, 'א');
    assert.equal(payload.submission.submissions.form_field_799d, 'ב');
    assert.equal(payload.submission.submissions.form_field_6673, 'a@b.co');
    assert.equal(payload.submission.submissions.form_field_7c94, 'שלום');
  });

  it('dry-run succeeds without calling Wix; live gated; honeypot rejected', async () => {
    assert.equal(validateContactInput({ firstName: '', lastName: 'x', email: 'a@b.co', message: 'm' }), 'MISSING_FIELDS');
    assert.equal(
      validateContactInput({
        firstName: 'א',
        lastName: 'ב',
        email: 'a@b.co',
        message: 'בדיקה',
        company: 'bot',
      }),
      'SPAM_REJECTED'
    );
    const dry = await submitContactForm(
      { firstName: 'א', lastName: 'ב', email: 'a@b.co', message: 'בדיקה' },
      { mode: 'dry-run' }
    );
    assert.equal(dry.ok, true);
    assert.equal(dry.mode, 'dry-run');
    assert.ok(dry.payloadPreview?.targets.includes('form_field_3ba2'));
    const live = await submitContactForm(
      { firstName: 'א', lastName: 'ב', email: 'a@b.co', message: 'בדיקה' },
      { mode: 'live' }
    );
    assert.equal(live.ok, false);
    assert.ok(
      live.error === 'LIVE_SUBMIT_NOT_AUTHORIZED' || live.error === 'FORMS_API_KEY_INVALID',
      live.error
    );
    assert.equal(live.mode, 'live-blocked');
    const blocker = formsLiveSubmitBlocker();
    assert.equal(blocker.blocked, true);
    assert.equal(blocker.credential.readyForLive, false);
    assert.ok(blocker.credential.needsNoam);
    assert.match(blocker.credential.needsNoam!, /IST\.|WIX_FORMS_LIVE_SUBMIT|Forms/i);
    const cred = formsCredentialStatus();
    assert.equal(cred.readyForLive, false);
  });
});
