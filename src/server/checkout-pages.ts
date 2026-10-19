import "server-only";
import { stateName } from "@/config/states";
import { entitiesForCheckout } from "./checkout";

/** Data for the business picker on checkout pages. */
export async function businessPickerData(customerId: string, kind: "registered_agent" | "business_address", allowedStates: string[] | null) {
  const list = await entitiesForCheckout(customerId, kind);
  return list
    .filter((r) => !allowedStates || allowedStates.includes(r.entity.jurisdiction))
    .map((r) => ({ id: r.entity.id, legalName: r.entity.legalName, stateName: stateName(r.entity.jurisdiction), disabled: r.hasService }));
}
