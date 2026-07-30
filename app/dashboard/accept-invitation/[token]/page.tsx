import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { getInvitationByToken } from "@/lib/auth";
import AcceptInvitationForm from "./AcceptInvitationForm";

export const dynamic = "force-dynamic";

type AcceptInvitationPageProps = {
  params: Promise<{ token: string }>;
};

export default async function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <BrandMark priority className="h-12 w-12" />
          <span className="font-display text-xl text-racing">M-Machine dashboard</span>
        </Link>

        <div className="rounded-2xl border border-racing/10 bg-white p-8">
          <h1 className="mb-2 font-display text-2xl text-racing">Accept invitation</h1>
          {invitation && invitation.status === "pending" ? (
            <>
              <p className="mb-6 text-sm text-ink-muted">
                Create your dashboard account for {invitation.email}. This invitation expires on{" "}
                {formatDate(invitation.expiresAt)}.
              </p>
              <AcceptInvitationForm token={token} email={invitation.email} />
            </>
          ) : (
            <div>
              <p className="mb-6 text-sm text-ink-muted">
                This invitation is invalid, expired or has already been used.
              </p>
              <Link href="/dashboard/login" className="btn-primary w-full justify-center">
                Go to sign in
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
