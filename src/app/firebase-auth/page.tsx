import { notFound, redirect } from 'next/navigation';

export default function FirebaseAuthPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  redirect('/signin');
}
