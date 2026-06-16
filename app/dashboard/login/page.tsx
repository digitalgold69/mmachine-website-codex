import Link from "next/link";
import { redirect } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { isLoggedIn } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isLoggedIn()) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <BrandMark priority className="h-12 w-12" />
          <span className="font-display text-xl text-racing">M-Machine owner dashboard</span>
        </Link>

        <div className="rounded-2xl border border-racing/10 bg-white p-8">
          <h1 className="mb-2 font-display text-2xl text-racing">Sign in</h1>
          <p className="mb-6 text-sm text-ink-muted">
            Enter the owner password to manage orders and website content.
          </p>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
