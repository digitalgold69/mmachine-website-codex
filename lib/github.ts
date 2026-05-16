// Minimal GitHub-as-CMS commit helpers.
//
// The owner's edits in the dashboard get persisted by committing to the repo
// via the GitHub Contents API. After the commit lands on `main`, Vercel auto-
// deploys, and within ~30-60s the live site reflects her changes.
//
// Env vars (set in Vercel project settings):
//   GITHUB_TOKEN         a fine-grained PAT with "Contents: Read & write" on the repo
//   GITHUB_REPO          owner/repo, e.g. "guy/mmachine-website"
//   GITHUB_BRANCH        usually "main"; falls back to "main" if unset

const API = "https://api.github.com";

function repo(): string {
  const r = process.env.GITHUB_REPO;
  if (!r || !r.includes("/")) {
    throw new Error(
      'GITHUB_REPO env var is missing or malformed. Expected "owner/repo".'
    );
  }
  return r;
}

function branch(): string {
  return process.env.GITHUB_BRANCH || "main";
}

function token(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) {
    throw new Error(
      "GITHUB_TOKEN env var is missing. Generate a fine-grained PAT in GitHub " +
      "→ Settings → Developer settings → Personal access tokens, with " +
      "'Contents: Read & write' on this repo."
    );
  }
  return t;
}

function headers() {
  return {
    Authorization: `Bearer ${token()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

type FileMeta = { sha: string; content: string };

function helpfulGitHubError(action: string, path: string, status: number, body: string): Error {
  if (status === 404) {
    return new Error(
      `${action} failed because GitHub could not access ${repo()} on branch ${branch()}. ` +
        "In Vercel, check GITHUB_REPO is digitalgold69/mmachine-website-codex, " +
        "GITHUB_BRANCH is main, and GITHUB_TOKEN has Contents: Read and write for that repo."
    );
  }
  return new Error(`${action} ${path} failed: ${status} ${body}`);
}

export async function assertRepoAccess(): Promise<void> {
  const url = `${API}/repos/${repo()}/branches/${encodeURIComponent(branch())}`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    throw helpfulGitHubError("GitHub repo access check", branch(), res.status, await res.text());
  }
}

/** Read a file's current content + SHA from the repo. Returns null if not found. */
export async function readFile(path: string): Promise<FileMeta | null> {
  const url = `${API}/repos/${repo()}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${branch()}`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw helpfulGitHubError("GitHub readFile", path, res.status, await res.text());
  const j = await res.json();
  return { sha: j.sha, content: typeof j.content === "string" ? j.content : "" };
}

/** Create or update a text file. `content` is plain UTF-8 — we base64-encode for the API. */
export async function writeTextFile(opts: {
  path: string;
  content: string;
  message: string;
}): Promise<void> {
  const existing = await readFile(opts.path);
  const body: Record<string, string> = {
    message: opts.message,
    content: Buffer.from(opts.content, "utf-8").toString("base64"),
    branch: branch(),
  };
  if (existing) body.sha = existing.sha;

  const url = `${API}/repos/${repo()}/contents/${encodeURIComponent(opts.path).replace(/%2F/g, "/")}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw helpfulGitHubError("GitHub writeTextFile", opts.path, res.status, await res.text());
  }
}

/** Create or update a binary file (images). `bytes` is a Uint8Array. */
export async function writeBinaryFile(opts: {
  path: string;
  bytes: Uint8Array;
  message: string;
}): Promise<void> {
  const existing = await readFile(opts.path);
  const body: Record<string, string> = {
    message: opts.message,
    content: Buffer.from(opts.bytes).toString("base64"),
    branch: branch(),
  };
  if (existing) body.sha = existing.sha;

  const url = `${API}/repos/${repo()}/contents/${encodeURIComponent(opts.path).replace(/%2F/g, "/")}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw helpfulGitHubError("GitHub writeBinaryFile", opts.path, res.status, await res.text());
  }
}

/** Read a JSON file from the repo. Returns null if not found. */
export async function readJsonFile<T>(path: string): Promise<T | null> {
  const meta = await readFile(path);
  if (!meta) return null;
  const text = Buffer.from(meta.content, "base64").toString("utf-8");
  return JSON.parse(text) as T;
}
