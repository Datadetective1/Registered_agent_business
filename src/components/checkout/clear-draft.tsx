"use client";

import { useEffect } from "react";
import { clearCheckoutDraft } from "./wizard";

/** Forget this tab's saved checkout answers once the order is paid. */
export function ClearCheckoutDraft() {
  useEffect(() => clearCheckoutDraft(), []);
  return null;
}
