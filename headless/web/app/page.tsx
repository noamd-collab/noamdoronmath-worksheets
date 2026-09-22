import { redirect } from 'next/navigation';

/** Prototype home redirects to the Phase 1 grade-7 catalog slice. */
export default function Home() {
  redirect('/worksheets?grade=7');
}
