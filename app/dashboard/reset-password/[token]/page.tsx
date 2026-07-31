import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { getPasswordResetByToken } from "@/lib/auth";
import ResetPasswordForm from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

type ResetPasswordPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = await params;
  const reset = await getPasswordResetByToken(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <BrandMark priority className="h-12 w-12" />
          <span className="font-display text-xl text-racing">M-Machine dashboard</span>
        </Link>

        <div className="rounded-2xl border border-racing/10 bg-white p-8">
          <h1 className="mb-2 font-display text-2xl text-racing">Choose a new password</h1>
          {reset ? (
            <>
              <p className="mb-6 text-sm text-ink-muted">
                This reset link is valid until {formatDate(reset.expiresAt)}.
              </p>
              <ResetPasswordForm token={token} email={reset.email} />
            </>
          ) : (
            <div>
              <p className="mb-6 text-sm text-ink-muted">
                This reset link is invalid or has expired. Request a new one to continue.
              </p>
              <Link href="/dashboard/forgot-password" className="btn-primary w-full justify-center">
                Request new link
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}
