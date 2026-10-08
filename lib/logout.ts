type SignOut = () => Promise<{ error?: unknown }>;

export async function logoutWorkspace(
  authenticated: boolean,
  signOut: SignOut,
  redirect: (path: string) => void,
) {
  if (authenticated) {
    const result = await signOut();
    if (result.error) throw new Error("Could not log out. Please try again.");
  }
  // A full navigation clears client-side inventory and authentication caches.
  redirect("/login");
}
