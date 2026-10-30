/**
 * Field definitions for the admin's content forms.
 *
 * Plain data (no functions) so the same definition can drive the form in the
 * browser and the validation on the server. See src/server/admin/resources.ts
 * for the content types built from these.
 */
export type OptionSource = "programs" | "team_groups" | "gallery_categories" | "authors" | "categories" | "posts";

type Common = {
  name: string;
  label: string;
  help?: string;
  required?: boolean;
  /** Shown beside another field on wide screens. */
  half?: boolean;
};

export type FieldDef = Common &
  (
    | { type: "text"; maxLength?: number; placeholder?: string }
    | { type: "textarea"; maxLength?: number; rows?: number }
    | { type: "lines"; maxLength?: number; rows?: number }
    | { type: "url"; maxLength?: number; placeholder?: string }
    | { type: "slug"; from: string; prefix: string; maxLength?: number }
    | { type: "number" }
    | { type: "date" }
    | { type: "datetime" }
    | { type: "toggle" }
    | { type: "richtext" }
    | { type: "media" }
    | { type: "youtube" }
    | { type: "select"; options?: { value: string; label: string }[]; optionsFrom?: OptionSource; allowEmpty?: string }
    | { type: "relation"; optionsFrom: OptionSource; join: { table: string; ownKey: string; otherKey: string } }
    | { type: "placements" }
  );

export type FieldType = FieldDef["type"];

/** A form's options lists, loaded on the server and passed to the form. */
export type FieldOptions = Partial<Record<OptionSource, { value: string; label: string }[]>>;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Bright Beginnings: Year 2" -> "bright-beginnings-year-2" */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
