import "server-only";
import type { SiteSettings } from "@/lib/types";
import { cached } from "./cache";
import { query } from "./db";

/**
 * Site-wide settings, edited in Admin -> Settings.
 *
 * Each has a default — the value the site was launched with — so a fresh
 * database shows a complete site and a cleared field falls back rather than
 * leaving a hole in the footer.
 */
export const SETTING_FIELDS = [
  { key: "name", label: "Organisation name", group: "Identity", default: "Worldwide Education Fund Canada" },
  {
    key: "short_name",
    label: "Short name",
    group: "Identity",
    default: "Worldwide Education Fund Canada",
    help: "Used in page titles, e.g. “Our Team | Worldwide Education Fund Canada”.",
  },
  { key: "tagline", label: "Tagline", group: "Identity", default: "Education in Chitral & Central Asia", help: "Ends the home page's title in search results." },
  {
    key: "description",
    label: "Site description",
    group: "Identity",
    type: "textarea",
    default:
      "Worldwide Education Fund Canada is a registered Canadian charity running early childhood learning centers, teacher training and scholarships in Chitral, Pakistan and Central Asia.",
    help: "Shown to search engines and when the site is shared on social media.",
  },
  { key: "charity_number", label: "Charity registration number", group: "Identity", default: "709257208", help: "Shown in the footer, on Contact, Mission and Donate." },
  { key: "phone", label: "Phone", group: "Contact", default: "+1 (214) 502-8388" },
  { key: "email", label: "Email", group: "Contact", type: "email", default: "info@wefcanada.org" },
  { key: "address_line1", label: "Street address", group: "Contact", default: "4423 White Mud Road" },
  { key: "address_line2", label: "City", group: "Contact", default: "Edmonton" },
  { key: "address_region", label: "Province", group: "Contact", default: "Alberta" },
  { key: "address_postcode", label: "Postal code", group: "Contact", default: "T6H 5W7" },
  { key: "address_country", label: "Country", group: "Contact", default: "Canada" },
  {
    key: "contact_topics",
    label: "Contact form topics",
    group: "Contact",
    type: "textarea",
    default: "General enquiry\nSupporting a program\nVolunteering\nPartnership\nDonation question\nMedia & press",
    help: "The choices in the contact form's “Topic” list, one per line.",
  },
  {
    key: "donate_url",
    label: "Donate link",
    group: "Giving",
    type: "url",
    default: "https://donorbox.org/bright-beginnings-early-childhood-learning-centers-eclcs",
    help: "Where every “Donate” button goes.",
  },
  {
    key: "donorbox_campaign",
    label: "Donorbox campaign",
    group: "Giving",
    default: "bright-beginnings-early-childhood-learning-centers-eclcs",
    help: "The campaign's name in its Donorbox address. Drives the donation form, progress bar and supporter wall.",
  },
  { key: "social_x", label: "X (Twitter)", group: "Social media", type: "url", default: "https://x.com/WEFglobaledu" },
  { key: "social_facebook", label: "Facebook", group: "Social media", type: "url", default: "https://www.facebook.com/WorldwideEducationFoundationWEF" },
  { key: "social_instagram", label: "Instagram", group: "Social media", type: "url", default: "https://www.instagram.com/worldwideeducationfoundation/" },
  { key: "social_linkedin", label: "LinkedIn", group: "Social media", type: "url", default: "https://linkedin.com/company/worldwide-education-foundation" },
  { key: "social_youtube", label: "YouTube", group: "Social media", type: "url", default: "https://www.youtube.com/@wefdallasorg" },
  { key: "social_trustpilot", label: "Trustpilot", group: "Social media", type: "url", default: "https://www.trustpilot.com/review/wefdallas.org" },
] as const satisfies readonly {
  key: string;
  label: string;
  group: string;
  type?: "text" | "textarea" | "email" | "url";
  default: string;
  help?: string;
}[];

export type SettingKey = (typeof SETTING_FIELDS)[number]["key"];

export function settingDefaults(): Record<SettingKey, string> {
  return Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, f.default])) as Record<SettingKey, string>;
}

/** Raw values with defaults applied. */
export function getSettingValues(): Promise<Record<SettingKey, string>> {
  return cached("settings", async () => {
    const values = settingDefaults();
    const rows = await query<{ setting_key: string; value: string | null }>(
      "SELECT setting_key, value FROM settings",
    );
    for (const row of rows) {
      if (row.setting_key in values && row.value !== null && row.value.trim() !== "") {
        values[row.setting_key as SettingKey] = row.value;
      }
    }
    return values;
  });
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return toSiteSettings(await getSettingValues());
}

/** The settings as launched, for when the database cannot be read (the build, an outage). */
export function defaultSiteSettings(): SiteSettings {
  return toSiteSettings(settingDefaults());
}

function toSiteSettings(v: Record<SettingKey, string>): SiteSettings {
  const socials = (
    [
      ["x", "X (Twitter)", v.social_x],
      ["facebook", "Facebook", v.social_facebook],
      ["instagram", "Instagram", v.social_instagram],
      ["linkedin", "LinkedIn", v.social_linkedin],
      ["youtube", "YouTube", v.social_youtube],
      ["trustpilot", "Trustpilot Reviews", v.social_trustpilot],
    ] as const
  )
    .filter(([, , href]) => href)
    .map(([key, label, href]) => ({ key, label, href }));

  return {
    name: v.name,
    shortName: v.short_name,
    tagline: v.tagline,
    description: v.description,
    charityNumber: v.charity_number,
    phone: v.phone,
    phoneHref: v.phone.replace(/[^\d+]/g, ""),
    email: v.email,
    address: {
      line1: v.address_line1,
      line2: v.address_line2,
      region: v.address_region,
      postcode: v.address_postcode,
      country: v.address_country,
    },
    addressLine: [v.address_line1, v.address_line2, v.address_region, v.address_postcode].filter(Boolean).join(", "),
    contactTopics: v.contact_topics.split(/\r?\n/).map((t) => t.trim()).filter(Boolean),
    donateUrl: v.donate_url,
    donorboxCampaign: v.donorbox_campaign,
    socials,
    trustpilot: v.social_trustpilot,
  };
}
