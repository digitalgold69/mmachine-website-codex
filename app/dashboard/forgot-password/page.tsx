import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <BrandMark priority className="h-12 w-12" />
          <span className="font-display text-xl text-racing">M-Machine dashboard</span>
        </Link>

        <div className="rounded-2xl border border-racing/10 bg-white p-8">
          <h1 className="mb-2 font-display text-2xl text-racing">Reset password</h1>
          <p className="mb-6 text-sm text-ink-muted">
            Enter your dashboard email and we will send a secure reset link if the account exists.
          </p>
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
