import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Check if the auth cookie exists in the request
function checkAuth() {
  const cookieStore = cookies();
  const authCookie = cookieStore.get('auth-session');
  
  if (!authCookie) {
    redirect('/signin');
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Check auth using cookies API (server-side only)
  const cookieStore = cookies();
  const authCookie = cookieStore.get('auth-session');
  
  if (!authCookie) {
    redirect('/signin');
  }
  
  return (
    <>
      {/* No actual content in this layout - just the auth check */}
      {/* The children will include a client component with the actual dashboard UI */}
      {children}
    </>
  );
}
