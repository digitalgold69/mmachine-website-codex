export const ANALYTICS_ID = "G-SXX6XDKX7N";
export const CONSENT_KEY = "mmachine_analytics_consent_v1";
const CONSENT_LIFETIME = 180 * 24 * 60 * 60 * 1000;
type Choice = "accepted" | "rejected";
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  mmachineAnalyticsStarted?: boolean;
  mmachineAnalyticsLastPage?: string;
};

export function readAnalyticsConsent(): Choice | null {
  try {
    const saved = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
    if (saved && (saved.choice === "accepted" || saved.choice === "rejected") &&
        typeof saved.at === "number" && saved.at <= Date.now() && Date.now() - saved.at < CONSENT_LIFETIME) {
      return saved.choice;
    }
  } catch { /* A blocked storage API must never prevent use of the website. */ }
  return null;
}

export function saveAnalyticsConsent(choice: Choice) {
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, at: Date.now() })); } catch {}
}

export function analyticsAllowed(hostname: string, pathname: string) {
  return hostname === "m-machine.co.uk" && !/^\/(dashboard|api|admin|account|login)(\/|$)/.test(pathname);
}

export function referringOrigin(referrer: string) {
  try {
    const url = new URL(referrer);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : "";
  } catch { return ""; }
}

export function stopAnalytics() {
  const target = window as AnalyticsWindow;
  Object.assign(target, { [`ga-disable-${ANALYTICS_ID}`]: true });
  target.mmachineAnalyticsLastPage = undefined;
}

export function clearAnalyticsCookies() {
  for (const part of document.cookie.split(";")) {
    const name = part.trim().split("=")[0];
    if (name !== "_ga" && !name.startsWith("_ga_")) continue;
    for (const domain of ["", "; Domain=m-machine.co.uk", "; Domain=.m-machine.co.uk"]) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax; Secure`;
    }
  }
}

export function trackPage(pathname: string, consent: boolean) {
  if (!consent || !analyticsAllowed(window.location.hostname, pathname)) return;
  const target = window as AnalyticsWindow;
  Object.assign(target, { [`ga-disable-${ANALYTICS_ID}`]: false });
  if (!target.mmachineAnalyticsStarted) {
    target.dataLayer = target.dataLayer || [];
    target.gtag = function () { target.dataLayer!.push(arguments); };
    target.gtag("consent", "default", {
      analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    });
    target.gtag("consent", "update", { analytics_storage: "granted" });
    target.gtag("js", new Date());
    target.gtag("config", ANALYTICS_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: 60 * 60 * 24 * 180,
      page_location: `https://m-machine.co.uk${pathname}`,
      page_referrer: referringOrigin(document.referrer),
    });
    const script = document.createElement("script");
    script.id = "mmachine-google-analytics";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_ID}`;
    script.referrerPolicy = "no-referrer";
    document.head.appendChild(script);
    target.mmachineAnalyticsStarted = true;
  }
  if (target.mmachineAnalyticsLastPage === pathname) return;
  target.gtag?.("event", "page_view", {
    send_to: ANALYTICS_ID,
    page_location: `https://m-machine.co.uk${pathname}`,
    page_title: pathname === "/search" ? "Search | M-Machine" : document.title,
    page_referrer: target.mmachineAnalyticsLastPage ? `https://m-machine.co.uk${target.mmachineAnalyticsLastPage}` : referringOrigin(document.referrer),
  });
  target.mmachineAnalyticsLastPage = pathname;
}
