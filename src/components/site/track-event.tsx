"use client";

import { useEffect } from "react";

/**
 * Fires a cookieless funnel event once when mounted. No identifiers are sent:
 * only the event name, path, referrer host and UTM parameters.
 */
export function TrackEvent({ name }: { name: string }) {
  useEffect(() => {
    sendFunnelEvent(name);
  }, [name]);
  return null;
}

/**
 * Records a "landing_page" event for the first page of a browsing session.
 * sessionStorage is used only as a local "already counted" flag; nothing about it
 * is sent to the server.
 */
export function LandingTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("lp")) return;
      sessionStorage.setItem("lp", "1");
    } catch {
      return;
    }
    const body = JSON.stringify({
      name: "landing_page",
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      search: window.location.search || undefined,
    });
    try {
      navigator.sendBeacon?.("/api/analytics/event", new Blob([body], { type: "application/json" }));
    } catch {
      // ignore
    }
  }, []);
  return null;
}

/** Send a single allow-listed funnel event (same payload as TrackEvent). */
export function sendFunnelEvent(name: string) {
  try {
    const body = JSON.stringify({
      name,
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      search: window.location.search || undefined,
    });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/analytics/event", new Blob([body], { type: "application/json" }));
    else void fetch("/api/analytics/event", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    // analytics must never break the page
  }
}
