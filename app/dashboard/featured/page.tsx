// Server component — auth-checks, fetches the latest featured work from
// GitHub, then renders the interactive editor (FeaturedClient).

import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { readJsonFile } from "@/lib/github";
import FeaturedClient from "./FeaturedClient";

type Entry = {
  id: string;
  title: string;
  description: string;
  tag: string;
  year: number;
  category: string;
  fullStory: string;
  image: string;
};

export const dynamic = "force-dynamic"; // never cache; we want fresh data on every visit

export default async function FeaturedDashboardPage() {
  if (!(await isLoggedIn())) redirect("/dashboard/login");

  // Read the live JSON from the repo so the editor reflects the current state
  // even if the local lib/featured-data.ts is stale (e.g. just before a deploy).
  let entries: Entry[] = [];
  try {
    const data = await readJsonFile<Entry[]>("data-source/featured-work.json");
    if (Array.isArray(data)) entries = data;
  } catch {
    // First-time setup: file doesn't exist yet, or env vars not set.
    entries = [];
  }

  return <FeaturedClient initialEntries={entries} />;
}
