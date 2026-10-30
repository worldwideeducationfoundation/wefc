import "server-only";
import { type FieldDef, SLUG_PATTERN } from "@/lib/admin-fields";
import { parseRichDoc, youtubeId } from "@/lib/richtext";

/**
 * Turns a submitted form into a row, following the field definitions.
 *
 * Everything from the browser is treated as untrusted: values are trimmed,
 * length-checked and converted to their column's type here, select values
 * must be one of the offered options, and only fields that are defined are
 * read at all — a crafted request cannot set a column the form does not have.
 */
export type ParsedForm = {
  data: Record<string, unknown>;
  relations: Record<string, number[]>;
  errors: Record<string, string>;
  /** What was typed, to put back into the form when there are errors. */
  values: Record<string, unknown>;
};

const MAX_DEFAULT = 255;

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseFields(
  fields: FieldDef[],
  form: FormData,
  allowed: { selectOptions?: Record<string, string[]> } = {},
): ParsedForm {
  const out: ParsedForm = { data: {}, relations: {}, errors: {}, values: {} };

  for (const f of fields) {
    const raw = form.get(f.name);
    const str = typeof raw === "string" ? raw : "";
    const trimmed = str.trim();
    out.values[f.name] = str;
    const fail = (msg: string) => {
      out.errors[f.name] ??= msg;
    };

    switch (f.type) {
      case "text":
      case "textarea":
      case "lines": {
        const max = f.maxLength ?? (f.type === "text" ? MAX_DEFAULT : 10000);
        const value =
          f.type === "lines"
            ? trimmed
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean)
                .join("\n")
            : f.type === "textarea"
              ? trimmed.replace(/\r\n/g, "\n")
              : trimmed;
        if (f.required && !value) fail(`${f.label} is required.`);
        else if ([...value].length > max) fail(`${f.label} must be at most ${max} characters.`);
        out.data[f.name] = value || null;
        break;
      }
      case "url": {
        if (f.required && !trimmed) fail(`${f.label} is required.`);
        else if (trimmed && !isHttpUrl(trimmed)) fail(`${f.label} must be a full web address starting with https://`);
        else if (trimmed.length > (f.maxLength ?? 500)) fail(`${f.label} is too long.`);
        out.data[f.name] = trimmed || null;
        break;
      }
      case "slug": {
        const value = trimmed.toLowerCase();
        if (!value) fail(`${f.label} is required.`);
        else if (!SLUG_PATTERN.test(value)) fail(`${f.label} may use only lowercase letters, numbers and single dashes.`);
        else if (value.length > (f.maxLength ?? 160)) fail(`${f.label} is too long.`);
        out.data[f.name] = value;
        break;
      }
      case "number": {
        const n = trimmed === "" ? null : Number(trimmed);
        if (n !== null && !Number.isFinite(n)) fail(`${f.label} must be a number.`);
        if (f.required && n === null) fail(`${f.label} is required.`);
        out.data[f.name] = n;
        break;
      }
      case "date": {
        if (trimmed && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) fail(`${f.label} must be a date.`);
        if (f.required && !trimmed) fail(`${f.label} is required.`);
        out.data[f.name] = trimmed || null;
        break;
      }
      case "datetime": {
        // The browser sends local time with its offset in a sibling field, so
        // the stored UTC time is the moment the editor meant.
        const offset = Number(form.get(`${f.name}__tz`) ?? 0);
        const d = trimmed ? new Date(`${trimmed}:00Z`) : null;
        if (d && Number.isNaN(d.getTime())) fail(`${f.label} must be a date and time.`);
        else if (f.required && !d) fail(`${f.label} is required.`);
        out.data[f.name] = d ? new Date(d.getTime() + (Number.isFinite(offset) ? offset : 0) * 60_000) : null;
        break;
      }
      case "toggle":
        out.data[f.name] = raw === "on" || raw === "1" ? 1 : 0;
        break;
      case "richtext": {
        let doc = parseRichDoc(null);
        if (trimmed) {
          try {
            doc = parseRichDoc(JSON.parse(trimmed));
          } catch {
            fail(`${f.label} could not be read. Please try again.`);
          }
        }
        out.data[f.name] = JSON.stringify(doc);
        break;
      }
      case "media": {
        const id = Number(trimmed);
        const value = Number.isInteger(id) && id > 0 ? id : null;
        if (f.required && !value) fail(`Choose ${f.label.toLowerCase()}.`);
        out.data[f.name] = value;
        break;
      }
      case "youtube": {
        const id = trimmed ? youtubeId(trimmed) : null;
        if (f.required && !trimmed) fail(`${f.label} is required.`);
        else if (trimmed && !id) fail("That does not look like a YouTube link. Copy the address from the video's page.");
        out.data[f.name] = id;
        break;
      }
      case "select": {
        const options = f.options?.map((o) => o.value) ?? allowed.selectOptions?.[f.name];
        if (!trimmed) {
          if (f.required) fail(`Choose ${f.label.toLowerCase()}.`);
          out.data[f.name] = null;
        } else if (options && !options.includes(trimmed)) {
          fail(`Choose a valid ${f.label.toLowerCase()}.`);
        } else {
          out.data[f.name] = /^\d+$/.test(trimmed) && !f.options ? Number(trimmed) : trimmed;
        }
        break;
      }
      case "relation": {
        const options = new Set(allowed.selectOptions?.[f.name] ?? []);
        const ids = form
          .getAll(f.name)
          .map(String)
          .filter((v) => options.has(v))
          .map(Number);
        out.relations[f.name] = [...new Set(ids)];
        out.values[f.name] = ids.map(String);
        break;
      }
      case "placements": {
        const picks = form
          .getAll(f.name)
          .map(String)
          .filter((v) => /^(home|ticker|program:[a-z0-9-]+)$/.test(v));
        out.values[f.name] = picks;
        if (f.required && picks.length === 0) fail("Choose at least one place to show this.");
        out.data[f.name] = [...new Set(picks)].join(",");
        break;
      }
    }
  }

  return out;
}
