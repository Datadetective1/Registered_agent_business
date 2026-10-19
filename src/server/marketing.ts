import "server-only";
import { SERVICE_CODES } from "@/config/catalog";
import { stateName } from "@/config/states";
import { formatMoney } from "@/lib/money";
import { getServiceByCode, getSettings, serviceAvailableStates } from "./settings";

/** Everything public pages need: brand + live prices from the catalog. */
export async function getMarketingContext() {
  const [s, ra, formation, address] = await Promise.all([
    getSettings(),
    getServiceByCode(SERVICE_CODES.registeredAgent),
    getServiceByCode(SERVICE_CODES.llcFormationTX),
    getServiceByCode(SERVICE_CODES.businessAddress),
  ]);
  const raPriceCents = ra?.priceCents ?? 0;
  const formationFeeCents = formation?.priceCents ?? 0;
  const stateFeeCents = formation?.governmentFeeCents ?? 0;
  const raStates = serviceAvailableStates(ra);
  return {
    s,
    brand: s.brand.name,
    ra,
    formation,
    address,
    raActive: Boolean(ra?.isActive),
    formationActive: Boolean(formation?.isActive),
    addressActive: Boolean(address?.isActive && address.priceCents > 0),
    raPrice: formatMoney(raPriceCents),
    raPriceCents,
    formationFee: formatMoney(formationFeeCents),
    formationFeeCents,
    stateFee: formatMoney(stateFeeCents),
    stateFeeCents,
    stateFeeLabel: formation?.governmentFeeLabel ?? "State filing fee",
    formationTotal: formatMoney(formationFeeCents + stateFeeCents),
    formationWithRaTotal: formatMoney(formationFeeCents + stateFeeCents + raPriceCents),
    raStates,
    raStatesLabel: raStates.map(stateName).join(", "),
  };
}

export type MarketingContext = Awaited<ReturnType<typeof getMarketingContext>>;
