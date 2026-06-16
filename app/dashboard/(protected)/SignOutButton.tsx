"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/dashboard/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="text-cream/80 hover:text-gold disabled:opacity-60"
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
