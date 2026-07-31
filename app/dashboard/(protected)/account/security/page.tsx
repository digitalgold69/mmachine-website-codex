import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SecurityClient from "./SecurityClient";

export const dynamic = "force-dynamic";

type SecurityPageProps = {
  searchParams?: Promise<{ required?: string | string[] }>;
};

export default async function SecurityPage({ searchParams }: SecurityPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/dashboard/login");
  const params = searchParams ? await searchParams : {};
  const requiredParam = Array.isArray(params.required) ? params.required[0] : params.required;
  const requiredReason =
    requiredParam === "1" || user.mustChangePassword
      ? "password"
      : requiredParam === "2fa"
        ? "2fa"
        : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-racing mb-1">Account security</h1>
        <p className="text-sm text-ink-muted">
          Manage your dashboard password, two-factor authentication and recovery codes.
        </p>
      </div>

      <SecurityClient
        initialUser={{
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          totpEnabled: user.totpEnabled,
        }}
        requiredReason={requiredReason}
      />
    </div>
  );
}
