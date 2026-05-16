import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { listFeaturedEntries, type FeaturedEntry } from "@/lib/featured";
import FeaturedClient from "./FeaturedClient";

export const dynamic = "force-dynamic";

export default async function FeaturedDashboardPage() {
  if (!(await isLoggedIn())) redirect("/dashboard/login");

  let entries: FeaturedEntry[] = [];
  try {
    entries = await listFeaturedEntries();
  } catch {
    entries = [];
  }

  return <FeaturedClient initialEntries={entries} />;
}
