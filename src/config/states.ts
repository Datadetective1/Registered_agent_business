export type UsState = { code: string; name: string; slug: string };

export const US_STATES: UsState[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([code, name]) => ({ code, name, slug: name.toLowerCase().replace(/\s+/g, "-") }));

const byCode = new Map(US_STATES.map((s) => [s.code, s]));
const bySlug = new Map(US_STATES.map((s) => [s.slug, s]));

export function stateByCode(code: string | null | undefined): UsState | undefined {
  return code ? byCode.get(code.toUpperCase()) : undefined;
}

export function stateBySlug(slug: string): UsState | undefined {
  return bySlug.get(slug.toLowerCase());
}

export function stateName(code: string | null | undefined): string {
  return stateByCode(code)?.name ?? code ?? "";
}

export const STATE_CODES = US_STATES.map((s) => s.code) as [string, ...string[]];

/** Public URL of a state's registered agent landing page (see rewrites in next.config.ts). */
export function statePagePath(slug: string): string {
  return `/${slug}-registered-agent`;
}
