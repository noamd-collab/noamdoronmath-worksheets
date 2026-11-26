import { requireGoogleTeacher, type TeacherAccessOptions } from './teacherAccess';

/**
 * Checkout stays closed while the worksheet generator is still in testing.
 * Only this confirmed Google account may open the payment page and create a
 * Grow redirect. The address is compared to the Auth /user email, never to a
 * query parameter, form field, or client flag.
 */
export const PAYMENT_TEST_OWNER_EMAIL = 'amiramnoam@gmail.com';

export function isPaymentTestOwnerEmail(email: unknown): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === PAYMENT_TEST_OWNER_EMAIL;
}

export async function allowPaymentTesting(
  request: Request,
  options: TeacherAccessOptions = {}
): Promise<boolean> {
  const access = await requireGoogleTeacher(request, options);
  return access.ok && isPaymentTestOwnerEmail(access.email);
}
