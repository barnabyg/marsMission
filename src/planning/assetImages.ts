/** Where in `public` each kind of Asset's picture is, made from its model by `scripts/generate-asset-art.mjs`. */
export const assetImageFolder = "art/assets";

/** The kind whose picture the Crewed Mission card shows: the lander the Crew come down in. */
export const crewImageKind = "crew";

/** The picture of an Asset of this kind, or of the Crewed Mission. */
export function assetImageUrl(kind: string): string {
  return `${import.meta.env.BASE_URL}${assetImageFolder}/${kind}.png`;
}
