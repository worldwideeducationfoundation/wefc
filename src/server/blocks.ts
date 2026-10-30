import "server-only";
import { notFound } from "next/navigation";
import type { MediaRef } from "@/lib/types";
import { cached } from "./cache";
import { query } from "./db";
import { getMediaRefs } from "./media-refs";

/**
 * The built-in pages and every piece of their copy that is editable in
 * Admin -> Page Content.
 *
 * Each block carries its default — the wording the site launched with — so a
 * page is complete before anyone edits it, and "Reset to original" is just
 * deleting the stored value. Pages read their copy through `getPageCopy`,
 * never from string literals, so nothing visible on a built-in page needs a
 * developer to change.
 *
 * Block types:
 *   text        one line
 *   textarea    a few lines, shown as written
 *   paragraphs  long text; a blank line starts a new paragraph
 *   image       a picture from the media library (stored as its id)
 *   toggle      on/off ("1" / "0") — e.g. whether a home page section shows
 *   order       the order of a page's sections (comma-separated keys)
 */
export type BlockType = "text" | "textarea" | "paragraphs" | "image" | "toggle" | "order";

export type BlockDef = {
  label: string;
  type: BlockType;
  default: string;
  group?: string;
  help?: string;
  /** For `order`: the items and their names. */
  options?: { value: string; label: string }[];
};

export type CorePageDef = {
  label: string;
  /** The public address, for the "View page" link and to hide nav links when switched off. */
  path: string | null;
  /** False for groups of copy that are not a page of their own. */
  canDisable: boolean;
  description: string;
  seo?: { title: string; description: string };
  blocks: Record<string, BlockDef>;
};

const t = (label: string, def: string, extra: Partial<BlockDef> = {}): BlockDef => ({ label, type: "text", default: def, ...extra });
const ta = (label: string, def: string, extra: Partial<BlockDef> = {}): BlockDef => ({ label, type: "textarea", default: def, ...extra });
const paras = (label: string, def: string, extra: Partial<BlockDef> = {}): BlockDef => ({ label, type: "paragraphs", default: def, ...extra });
const img = (label: string, extra: Partial<BlockDef> = {}): BlockDef => ({ label, type: "image", default: "", ...extra });
const on = (label: string, extra: Partial<BlockDef> = {}): BlockDef => ({ label, type: "toggle", default: "1", ...extra });

const lines = (label: string, def: string, extra: Partial<BlockDef> = {}): BlockDef => ({
  label,
  type: "textarea",
  default: def,
  help: "One per line.",
  ...extra,
});

/*
 * Headings may mark words for the green italic accent with *asterisks*:
 * "Every child deserves a *bright beginning.*" — see <Emph>.
 */
const EMPH = "Put *asterisks* around the words shown in green italics.";

/** The home page's sections below the opening, in their default order. */
export const HOME_SECTIONS = [
  { value: "vmb", label: "Vision, mission and belief" },
  { value: "ticker", label: "Scrolling ticker" },
  { value: "strip", label: "Photo strip (program cards)" },
  { value: "tagline", label: "Tagline band" },
  { value: "brochure", label: "Featured project: brochure" },
  { value: "scholarship", label: "Featured project: scholarship program" },
  { value: "reach", label: "Canada to Chitral map" },
  { value: "programs", label: "Our Programs" },
  { value: "values", label: "Values" },
  { value: "stories", label: "Stories (testimonials)" },
  { value: "impact", label: "Impact counters" },
  { value: "donate", label: "Donation band" },
  { value: "centers", label: "Learning centers map" },
  { value: "newsletter", label: "Newsletter signup" },
] as const;
export type HomeSectionKey = (typeof HOME_SECTIONS)[number]["value"];

/** The closing band shared by the list pages, topic pages and articles. */
const ctaBand = (heading: string, text: string, group = "Closing band") => ({
  cta_heading: t("Heading", heading, { group }),
  cta_text: ta("Text", text, { group }),
  cta_primary_label: t("First button", "Support our work", { group, help: "Goes to the Donate link in Settings." }),
  cta_secondary_label: t("Second button", "Get in touch", { group }),
  cta_secondary_href: t("Second button link", "/contact", { group }),
});

const listHero = (eyebrow: string, title: string, intro: string) => ({
  hero_eyebrow: t("Small heading", eyebrow, { group: "Opening" }),
  hero_title: t("Heading", title, { group: "Opening", help: EMPH }),
  hero_text: ta("Introduction", intro, { group: "Opening" }),
});

export const CORE_PAGES = {
  organisation: {
    label: "Organisation (shared)",
    path: null,
    canDisable: false,
    description: "Vision, mission and belief, shown on both the Home and Mission pages.",
    blocks: {
      vision_heading: t("Vision heading", "Our Vision"),
      vision: ta(
        "Vision",
        "We envision a world where every child, regardless of background, has access to quality education that empowers them to break the cycle of poverty and build a brighter, more prosperous future for themselves and their communities.",
      ),
      mission_heading: t("Mission heading", "Our Mission"),
      mission: ta(
        "Mission",
        "We invest in the potential of children and youth across underserved communities in Central and South Asia through early development programs, English language learning, and scholarships that open doors to opportunity and empower them to uplift their lives and communities.",
      ),
      belief_heading: t("Belief heading", "Our Belief"),
      belief: ta(
        "Belief",
        "We believe talent is universal, but opportunity is not. Every child deserves the chance to learn, grow, and thrive, regardless of financial means, caste, religion, or gender, because education unlocks human potential and creates lasting change.",
      ),
    },
  },

  footer: {
    label: "Header and footer (every page)",
    path: null,
    canDisable: false,
    description: "The words in the header and footer. The links themselves are under Navigation; contact details and social links under Settings.",
    blocks: {
      donate_label: t("Header donate button", "Donate"),
      about: ta("Footer: about the charity", "A registered Canadian charity expanding access to quality education for underserved children and youth across Central and South Asia."),
      copyright: t("Footer: copyright line", "© {year} Worldwide Education Fund. All rights reserved.", { help: "{year} becomes the current year." }),
      contact_heading: t("Footer: contact column heading", "Contact"),
    },
  },

  home: {
    label: "Home",
    path: "/",
    canDisable: false,
    description:
      "The landing page. The slideshow, program cards, figures, testimonials and map points each have their own section in the menu.",
    seo: {
      title: "Worldwide Education Fund Canada | Education in Chitral & Central Asia",
      description:
        "Worldwide Education Fund Canada is a registered Canadian charity running early childhood learning centers, teacher training and scholarships in Chitral, Pakistan and Central Asia.",
    },
    blocks: {
      intro_eyebrow: t("Small heading", "Worldwide Education Fund Canada", { group: "Opening" }),
      intro_title: t("Headline", "Every child deserves a *bright beginning.*", { group: "Opening", help: EMPH }),
      intro_text: ta(
        "Introduction",
        "We break the cycle of generational poverty through early childhood education, teacher training, and scholarships, with roots in Chitral, Pakistan and a growing reach across Central and South Asia.",
        { group: "Opening" },
      ),
      intro_donate: t("Donate button", "Donate Now", { group: "Opening" }),
      intro_secondary: t("Second button", "Explore our programs", { group: "Opening" }),
      intro_secondary_href: t("Second button link", "#programs", { group: "Opening" }),
      section_order: {
        label: "Order of the sections",
        type: "order",
        default: HOME_SECTIONS.map((s) => s.value).join(","),
        group: "Layout",
        help: "Everything below the opening, top to bottom. Use the arrows to move a section.",
        options: HOME_SECTIONS.map((s) => ({ ...s })),
      },
      ...Object.fromEntries(HOME_SECTIONS.map((s) => [`show_${s.value}`, on(`Show: ${s.label}`, { group: "Layout" })])),
      ticker: lines("Ticker phrases", "100+ learning centers\n52,000 children in the ECD ecosystem\n66 university scholarships\nRegistered Canadian charity", {
        group: "Scrolling ticker",
      }),
      strip_eyebrow: t("Small heading", "Our work in pictures", { group: "Photo strip" }),
      strip_title: t("Heading", "From a first classroom to a professional diploma", {
        group: "Photo strip",
        help: "The photos are the Program Cards set to “Home — photo strip”.",
      }),
      tagline: t("Tagline", "Investing in Minds & Empowering Futures", { group: "Tagline band" }),
      brochure_eyebrow: t("Small heading", "Featured Project", { group: "Featured project: brochure" }),
      brochure_title: t("Heading", "Bright Beginnings: Early Childhood Learning Centers", { group: "Featured project: brochure" }),
      brochure_text: ta(
        "Text",
        "Read the full digital brochure below. It covers the Bright Beginnings model, the cost of opening a center, our Canadian charitable registration number, and the three ways you can give.",
        { group: "Featured project: brochure" },
      ),
      brochure_file: img("Brochure (PDF)", { group: "Featured project: brochure", help: "Upload the PDF to the Media Library and choose it here." }),
      brochure_frame_title: t("Brochure description (for screen readers)", "Worldwide Education Fund Canada — Early Childhood Learning Centers brochure", {
        group: "Featured project: brochure",
      }),
      brochure_note: t("Note under the brochure", "Scroll inside the brochure to read all pages.", { group: "Featured project: brochure" }),
      brochure_open: t("Open link", "Open or download the PDF →", { group: "Featured project: brochure" }),
      brochure_donate: t("Button", "Donate Now", { group: "Featured project: brochure" }),
      brochure_fine: t("Small print", "Every gift is issued a Canadian charitable tax receipt.", { group: "Featured project: brochure" }),
      scholarship_eyebrow: t("Small heading", "Featured Project", { group: "Featured project: scholarship" }),
      scholarship_title: t("Heading", "WEFC (Canada) Scholarship Program", { group: "Featured project: scholarship" }),
      scholarship_text: ta(
        "Text",
        "Our Canadian scholarship program is being finalized. Full details on eligibility, partner institutions and application timelines are coming soon — donations made today are already directed to scholarship students.",
        { group: "Featured project: scholarship" },
      ),
      scholarship_image: img("Graphic", { group: "Featured project: scholarship" }),
      reach_flag: t("Badge", "WEF Canada", { group: "Canada to Chitral map" }),
      reach_title: t("Heading", "Rooted in Canada, reaching the valleys of Chitral", { group: "Canada to Chitral map" }),
      reach_text: ta(
        "Text",
        "Worldwide Education Fund Canada raises awareness, mobilizes community support, and channels funds directly into early childhood centers, teacher training, and scholarships across Pakistan, Tajikistan, and Kyrgyzstan — where the need is greatest.",
        { group: "Canada to Chitral map" },
      ),
      programs_eyebrow: t("Small heading", "Our Programs", { group: "Our Programs" }),
      programs_title: t("Heading", "Pathways out of generational poverty", {
        group: "Our Programs",
        help: "The programs are the Program Cards set to “Home — Our Programs”.",
      }),
      programs_text: ta(
        "Text",
        "From a child's first classroom to a professional diploma, we build a continuous ladder of opportunity for children and youth in underserved communities.",
        { group: "Our Programs" },
      ),
      values_eyebrow: t("Small heading", "What guides us", { group: "Values" }),
      values_title: t("Heading", "Values we build every classroom on", { group: "Values" }),
      values_text: ta("Text", "Talent is universal, but opportunity is not. These convictions shape every center we open and every scholar we support.", {
        group: "Values",
      }),
      value_1_title: t("1 · Title", "Empowerment", { group: "Values" }),
      value_1_text: ta("1 · Text", "We equip local women and educators with credentials and tools, creating sustainable livelihoods and community leadership.", {
        group: "Values",
      }),
      value_2_title: t("2 · Title", "Integrity", { group: "Values" }),
      value_2_text: ta(
        "2 · Text",
        "Absolute transparency. Administrative costs are privately underwritten, so 100% of public fundraising goes to ground-level operations.",
        { group: "Values" },
      ),
      value_3_title: t("3 · Title", "Equity", { group: "Values" }),
      value_3_text: ta("3 · Text", "We dismantle barriers of gender, caste, and geography so every child can learn — regardless of where they start.", {
        group: "Values",
      }),
      value_4_title: t("4 · Title", "Collaboration", { group: "Values" }),
      value_4_text: ta("4 · Text", "We partner with governments, universities, and researchers to build enduring, scalable models of change.", {
        group: "Values",
      }),
      stories_eyebrow: t("Small heading", "Real stories, real change", { group: "Stories" }),
      stories_title: t("Heading", "The difference your support makes", { group: "Stories", help: "The quotes are edited under Testimonials." }),
      donate_eyebrow: t("Small heading", "Make a gift today", { group: "Donation band" }),
      donate_title: t("Heading", "$12 gives a child a decade of learning", { group: "Donation band" }),
      donate_text: ta(
        "Text",
        "A $3,600 CAD gift establishes a Bright Beginnings center that reaches 300 children over ten years — about $12 per child. Your gift funds early education, teacher training, and scholarships on the ground.",
        { group: "Donation band" },
      ),
      donate_badge_secure: t("Second badge", "Secure online giving", { group: "Donation band" }),
      donate_note: t("Line under the form", "Prefer to give by cheque? See", { group: "Donation band" }),
      donate_note_link: t("Its link", "Ways to Give", { group: "Donation band" }),
      centers_eyebrow: t("Small heading", "Transparency you can see", { group: "Learning centers map" }),
      centers_title: t("Heading", "See where your support goes", { group: "Learning centers map" }),
      centers_text: ta(
        "Text",
        "Every learning center we run across Chitral, Pakistan — on one map. Filter by funding partner to find the centers your gift made possible, and click any point to see the community it serves.",
        { group: "Learning centers map" },
      ),
      centers_link: t("Link under the map", "Explore the full centers map", { group: "Learning centers map" }),
      news_eyebrow: t("Small heading", "Stay connected", { group: "Newsletter signup" }),
      news_title: t("Heading", "Get the stories your support makes possible", { group: "Newsletter signup" }),
      news_text: ta(
        "Text",
        "A short email a few times a year — new learning centers opening, scholarship results, and updates from the communities we serve in Chitral. No noise, and you can unsubscribe any time.",
        { group: "Newsletter signup" },
      ),
      news_button: t("Button", "Subscribe", { group: "Newsletter signup" }),
      news_note: t("Small print", "We use your email only to send WEF updates. We never sell or share it.", { group: "Newsletter signup" }),
      news_success: t("Shown after signing up", "Thank you — you're on the list. Watch your inbox for the next update.", {
        group: "Newsletter signup",
      }),
    },
  },

  mission: {
    label: "Our Mission",
    path: "/mission",
    canDisable: true,
    description: "Vision, figures, the active projects and where the money goes.",
    seo: {
      title: "Our Mission",
      description:
        "Worldwide Education Fund Canada invests in children and youth across Central and South Asia through early childhood development, English language learning, teacher training, research and scholarships.",
    },
    blocks: {
      hero_eyebrow: t("Small heading", "Our Mission", { group: "Opening" }),
      hero_tag: t("Tagline", "nurturing minds · growing futures", { group: "Opening" }),
      hero_title: t("Heading", "Talent is universal. *Opportunity* is not.", { group: "Opening", help: EMPH }),
      hero_text: ta(
        "Introduction",
        "We invest in the potential of children and youth across underserved communities in Central and South Asia — opening doors through early childhood development, English language learning, teacher training, research, and scholarships, so every young learner can transform their life and uplift their community.",
        { group: "Opening" },
      ),
      glance_eyebrow: t("Small heading", "WEF at a glance", { group: "At a glance", help: "The figures are under Figures, “Mission — at a glance”." }),
      glance_title: t("Heading", "Nine active projects, one goal", { group: "At a glance" }),
      projects_eyebrow: t("Small heading", "Our active projects", { group: "Active projects" }),
      projects_title: t("Heading", "How we turn opportunity into outcomes", {
        group: "Active projects",
        help: "The projects are the Program Cards set to “Mission — active projects”.",
      }),
      projects_text: ta(
        "Text",
        "From Montessori learning centers to university scholarships, every WEF program is built around one belief — that the right support, in the right place, changes a child's whole trajectory.",
        { group: "Active projects" },
      ),
      money_badge: t("Badge", "Where your money goes", { group: "Where the money goes" }),
      money_title: t("Heading", "Every dollar reaches the field", { group: "Where the money goes" }),
      money_text: paras(
        "Text",
        "Worldwide Education Fund Canada is a registered Canadian charity. 100% of all dollars raised through your contributions go toward the implementation, operation, and maintenance of WEF's projects and programs.\n\nAll administrative expenses are paid by the Connie and Kamal Daya Gift Fund of the Dallas Foundation — so your gift is never diluted by overhead.",
        { group: "Where the money goes" },
      ),
      money_map: t("First button", "See your impact on the map", { group: "Where the money goes" }),
      money_donate: t("Second button", "Support our work", { group: "Where the money goes" }),
    },
  },

  team: {
    label: "Our Team",
    path: "/team",
    canDisable: true,
    description: "The people are edited under Team; the group headings under Team Groups.",
    seo: {
      title: "Our Team",
      description: "Meet the co-founders guiding Worldwide Education Fund Canada's work in Chitral, Pakistan and across Central and South Asia.",
    },
    blocks: {
      hero_eyebrow: t("Small heading", "Our Team", { group: "Opening" }),
      hero_title: t("Heading", "The people behind the *promise*", { group: "Opening", help: EMPH }),
      hero_text: ta(
        "Introduction",
        "WEF is guided by co-founders who believe opportunity should reach every child — bringing decades of experience in finance, education, and philanthropy to guide our work across Central and South Asia.",
        { group: "Opening" },
      ),
      bio_button: t("“Read bio” button", "Read bio", { group: "People" }),
      cta_heading: t("Heading", "Want to work alongside this team?", { group: "Closing band" }),
      cta_text: ta("Text", "Support their work, or get in touch about volunteering and partnerships.", { group: "Closing band" }),
      cta_primary_label: t("First button", "Support our work", { group: "Closing band" }),
      cta_secondary_label: t("Second button", "Get in touch", { group: "Closing band" }),
      cta_secondary_href: t("Second button link", "/contact", { group: "Closing band" }),
    },
  },

  centers: {
    label: "Learning Centers Map",
    path: "/centers",
    canDisable: true,
    description: "The map of every center. The centers themselves are under Learning Centers.",
    seo: {
      title: "Learning Centers in Chitral, Pakistan",
      description:
        "See every early childhood learning center Worldwide Education Fund Canada supports across Upper and Lower Chitral, Pakistan — on one map, filterable by funding partner.",
    },
    blocks: {
      hero_eyebrow: t("Small heading", "Transparency you can see", { group: "Opening" }),
      hero_title: t("Heading", "See exactly where your *support* goes", { group: "Opening", help: EMPH }),
      hero_text: ta(
        "Introduction",
        "Every learning center we run across Chitral, Pakistan — plotted on one map. Filter by funding partner to find the centers your gift made possible, and tap any point to see the community it serves.",
        { group: "Opening" },
      ),
      stats: lines(
        "Figures",
        "88 | Learning centers mapped\n2,200+ | Children enrolled at reporting centers\n18 | Funding partners & sponsors\n2 | Regions — Upper & Lower Chitral",
        { group: "Figures", help: "One per line, as “number | label”. A trailing + is drawn in green." },
      ),
      map_title: t("Heading", "Explore our centers network", { group: "Map" }),
      map_text: ta(
        "Text",
        "By default the map shows all of our active learning centers. Use the filter to isolate a single funding partner, tap the keys in the legend to focus on a type of center, and click any marker for its details.",
        { group: "Map" },
      ),
      map_note: ta(
        "Note under the map",
        "Center locations are drawn from our own program records for Chitral, Pakistan. A small number of centers still being surveyed are not yet plotted. Scroll to zoom once the map is focused, or use the + / − controls.",
        { group: "Map" },
      ),
      cta_heading: t("Heading", "Put your name on the map", { group: "Closing band" }),
      cta_text: ta("Text", "Sponsor a learning center and you'll see it appear here — reaching real children in a named village, every year it stays open.", {
        group: "Closing band",
      }),
      cta_button: t("Button", "Sponsor a center", { group: "Closing band" }),
    },
  },

  gallery: {
    label: "Gallery",
    path: "/gallery",
    canDisable: true,
    description: "The photos are under Gallery; the filter chips under Gallery Categories.",
    seo: {
      title: "Photos from Our Learning Centers in Chitral",
      description: "Classrooms, language labs and the students behind the numbers — photos of Worldwide Education Fund Canada's work across Chitral, Pakistan and Central Asia.",
    },
    blocks: {
      hero_eyebrow: t("Small heading", "Gallery", { group: "Opening" }),
      hero_title: t("Heading", "Moments from the *field*", { group: "Opening", help: EMPH }),
      hero_text: ta(
        "Introduction",
        "Classrooms, language labs, and the students behind the numbers — a look at WEF's work across Chitral, Pakistan and Central Asia.",
        { group: "Opening" },
      ),
      all_label: t("“All” filter", "All", { group: "Filters" }),
    },
  },

  contact: {
    label: "Contact",
    path: "/contact",
    canDisable: false,
    description: "The address, phone and email come from Settings. Messages sent from the form arrive under Messages.",
    seo: {
      title: "Contact Us",
      description: "Questions about our programs, donating, volunteering or partnering with Worldwide Education Fund Canada? Get in touch.",
    },
    blocks: {
      hero_eyebrow: t("Small heading", "Contact", { group: "Opening" }),
      hero_title: t("Heading", "Let's build brighter futures, *together*", { group: "Opening", help: EMPH }),
      hero_text: ta(
        "Introduction",
        "Questions about our programs, donating, volunteering, or partnering with WEF? We'd love to hear from you — reach out and a member of our team will get back to you.",
        { group: "Opening" },
      ),
      info_title: t("Heading", "Get in touch", { group: "Contact details" }),
      info_text: ta("Text", "The fastest way to reach us is by email or phone. For general enquiries, use the form and we'll respond as soon as we can.", {
        group: "Contact details",
      }),
      follow: t("Above the social links", "Follow us", { group: "Contact details" }),
      form_title: t("Heading", "Send us a message", { group: "Form" }),
      form_text: t("Text", "Send this through and it lands straight with our team — we'll reply by email.", { group: "Form" }),
      optin_title: t("Newsletter tick box: heading", "Keep me updated", { group: "Form" }),
      optin_text: t(
        "Newsletter tick box: text",
        "Send me the WEF newsletter — a few emails a year on new learning centers, scholarships, and stories from the field.",
        { group: "Form" },
      ),
      button: t("Button", "Send message", { group: "Form" }),
      success: ta("Shown after sending", "Thank you — your message is on its way. We'll reply by email soon.", { group: "Form" }),
      direct: t("Line under the form", "Prefer to write to us directly? Email", { group: "Form" }),
      review_title: t("Heading", "Worked with us before?", { group: "Review band" }),
      review_text: ta(
        "Text",
        "If you've supported WEF as a donor, volunteer, or partner, we'd love to hear about your experience. Help us reach more people and impact more lives — leave us a review on Trustpilot.",
        { group: "Review band" },
      ),
      review_link: t("Link", "Leave a review on Trustpilot", { group: "Review band", help: "Goes to the Trustpilot address in Settings." }),
    },
  },

  donate: {
    label: "Ways to Give",
    path: "/donate",
    canDisable: false,
    description: "The donation form, progress bar and supporter wall come from Donorbox (campaign under Settings). The questions are under Donation FAQs.",
    seo: {
      title: "Donate to Education in Chitral & Central Asia",
      description:
        "Give to Worldwide Education Fund Canada, a registered Canadian charity (709257208). Your gift funds early childhood learning centers, teacher training and scholarships. Every gift is receipted.",
    },
    blocks: {
      hero_eyebrow: t("Small heading", "Support our work", { group: "Opening" }),
      hero_title: t("Heading", "Give a child a place to start", { group: "Opening", help: EMPH }),
      hero_text: ta(
        "Introduction",
        "Worldwide Education Fund Canada works in the mountain communities of Chitral, Pakistan, and across Central Asia — places where a child's nearest classroom can be hours away, and where a teacher may never have had formal training. Your gift funds the learning centers, the training, and the scholarships that change that.",
        { group: "Opening" },
      ),
      hero_charity: ta(
        "Charity line",
        "Worldwide Education Fund Canada is a registered Canadian charity, registration number {charity}. Donations are processed securely through Donorbox, or you can give by cheque.",
        { group: "Opening", help: "{charity} becomes the registration number from Settings." },
      ),
      where_title: t("Heading", "Where your gift goes", { group: "Where your gift goes" }),
      where_text: ta(
        "Text",
        "Every donation supports one of four programs. Each one is documented on this site, with the centers, partners and students it has reached.",
        { group: "Where your gift goes" },
      ),
      ...Object.fromEntries(
        (
          [
            [
              "Early childhood learning centers",
              "Bright Beginnings centers give children in Upper and Lower Chitral their first classroom — women-led, community-run, and built where no pre-primary education existed before.",
              "About Bright Beginnings",
              "/projects/bright-beginnings-eclc",
            ],
            [
              "Teacher training",
              "Professional development and refresher training for the educators running those classrooms, delivered with the University of Chitral and our implementing partners.",
              "About teacher training",
              "/topics/teacher-training",
            ],
            [
              "Scholarships",
              "Secondary school scholarships in Chitral, and undergraduate and graduate places at universities across Pakistan, Kyrgyzstan and Tajikistan for students who would otherwise stop studying.",
              "About scholarships",
              "/topics/scholarships",
            ],
            [
              "Learning spaces and technology",
              "Refurbished classrooms, English language labs and technology-enabled learning in government primary schools across the Chitral valley.",
              "About learning spaces",
              "/topics/learning-spaces",
            ],
          ] as const
        ).flatMap(([title, text, link, href], i) => {
          const group = "Where your gift goes";
          const n = i + 1;
          return [
            [`where_${n}_title`, t(`${n} · Title`, title, { group })],
            [`where_${n}_text`, ta(`${n} · Text`, text, { group })],
            [`where_${n}_link`, t(`${n} · Link text`, link, { group })],
            [`where_${n}_href`, t(`${n} · Link`, href, { group })],
          ];
        }),
      ),
      faq_title: t("Heading", "Before you give", { group: "Questions", help: "The questions are under Donation FAQs." }),
      close_text: ta(
        "Closing line",
        "Talent is universal. Opportunity is not. Every child deserves the chance to learn, grow and thrive — regardless of financial means, caste, religion or gender.",
        { group: "Questions" },
      ),
      close_button: t("Closing button", "Donate now", { group: "Questions" }),
      donors_title: t("Heading", "Our supporters", { group: "Supporters" }),
      donors_text: t("Text", "Everyone who has given through Donorbox so far — thank you.", { group: "Supporters" }),
    },
  },

  projects: {
    label: "Active Projects",
    path: "/projects",
    canDisable: false,
    description: "The list of Active Project posts.",
    seo: {
      title: "Active Education Projects in Chitral & Central Asia",
      description:
        "The programs Worldwide Education Fund Canada is running now — early childhood learning centers, research hubs, training and scholarships across Chitral, Pakistan and Central Asia.",
    },
    blocks: {
      ...listHero(
        "What We Do",
        "Our active projects",
        "These are the programs WEF is running right now — from early childhood learning centers to research hubs and training programs across Chitral, Pakistan and Central Asia. Open any project to see who it reaches and how you can support it.",
      ),
      list_eyebrow: t("Small heading", "Active Projects", { group: "List" }),
      list_title: t("Heading", "Pathways currently underway", { group: "List" }),
      list_text: ta("Text", "Every project below is live today. Click through for the full story, the community it serves, and how to give directly toward it.", {
        group: "List",
      }),
      read_more: t("Card link", "Read more", { group: "List" }),
      empty: t("Shown when there are none", "No active projects are published yet.", { group: "List" }),
      ...ctaBand("Want to help move one of these forward?", "Give directly, or get in touch to learn how you can support a specific project."),
    },
  },

  updates: {
    label: "Project Updates",
    path: "/updates",
    canDisable: false,
    description: "The list of Project Update posts.",
    seo: {
      title: "Project Updates from Chitral & Central Asia",
      description: "The latest news, milestones and announcements from Worldwide Education Fund Canada's programs across Chitral, Pakistan and Central Asia.",
    },
    blocks: {
      ...listHero("Impact", "Project updates", "The latest news, milestones, and announcements from WEF's programs across Chitral, Pakistan and Central Asia."),
      list_eyebrow: t("Small heading", "Latest News", { group: "List" }),
      list_title: t("Heading", "What’s new at WEF", { group: "List" }),
      list_text: ta("Text", "From new center openings to transformational gifts — stay up to date with WEF's progress.", { group: "List" }),
      read_more: t("Card link", "Read more", { group: "List" }),
      empty: t("Shown when there are none", "No updates are published yet.", { group: "List" }),
      ...ctaBand("Help power the next update", "Your gift funds the programs behind every milestone on this page."),
    },
  },

  stories: {
    label: "Success Stories",
    path: "/stories",
    canDisable: false,
    description: "The list of Success Story posts.",
    seo: {
      title: "Student Success Stories from Chitral",
      description: "Behind every number is a person: stories of the children, students and communities whose lives have changed through WEF's programs.",
    },
    blocks: {
      ...listHero(
        "Impact",
        "Success stories",
        "Behind every number is a person. These are the stories of the children, students, and communities whose lives have changed through WEF's programs.",
      ),
      list_eyebrow: t("Small heading", "Real Stories", { group: "List" }),
      list_title: t("Heading", "Voices from the communities we serve", { group: "List" }),
      list_text: ta("Text", "From a child finding his voice in Chitral to scholars pursuing MBAs abroad — read their stories in their own words.", {
        group: "List",
      }),
      read_more: t("Card link", "Read more", { group: "List" }),
      empty: t("Shown when there are none", "No stories are published yet.", { group: "List" }),
      ...ctaBand("Help write the next success story", "Your gift funds the classrooms, scholarships, and centers that make stories like these possible."),
    },
  },

  topics: {
    label: "Topic pages",
    path: null,
    canDisable: false,
    description: "The wording shared by every topic page (/topics/…). Each topic's name and description are under Topics.",
    blocks: {
      eyebrow: t("Small heading", "Topic", { group: "Opening" }),
      list_title: t("Heading above the posts", "Everything tagged {topic}", { group: "List", help: "{topic} becomes the topic's name." }),
      list_text: ta("Text", "Updates, stories and projects from across WEF's work, grouped by topic.", { group: "List" }),
      ...ctaBand("Help power this work", "Your gift funds the programs behind every story on this page."),
    },
  },

  article: {
    label: "Articles",
    path: null,
    canDisable: false,
    description: "The standard closing band on posts that do not set their own, and the back links.",
    blocks: {
      back_update: t("Back link on updates", "Project Updates", { group: "Back links" }),
      back_story: t("Back link on stories", "Success Stories", { group: "Back links" }),
      back_project: t("Back link on projects", "Active Projects", { group: "Back links" }),
      eyebrow_update: t("Label on updates", "Project Update", { group: "Labels" }),
      eyebrow_story: t("Label on stories", "Success Story", { group: "Labels" }),
      eyebrow_project: t("Label on projects", "Active Project", { group: "Labels" }),
      cta_heading: t("Heading", "Help us reach more children", { group: "Standard closing band" }),
      cta_text: ta("Text", "Your gift funds learning centers, teacher training and scholarships across Chitral and Central Asia.", {
        group: "Standard closing band",
      }),
      cta_primary_label: t("First button", "Support our work", { group: "Standard closing band" }),
      cta_secondary_label: t("Second button", "Get in touch", { group: "Standard closing band" }),
      cta_secondary_href: t("Second button link", "/contact", { group: "Standard closing band" }),
    },
  },

  notfound: {
    label: "Page not found",
    path: null,
    canDisable: false,
    description: "Shown when an address does not exist.",
    blocks: {
      title: t("Heading", "We couldn't find that page"),
      text: ta(
        "Text",
        "The link may be out of date, or the page may have moved. Everything we do is still here — learning centers in Chitral, teacher training, and scholarships across Central and South Asia.",
      ),
      links: lines(
        "Links",
        "Home | /\nActive Projects | /projects\nProject Updates | /updates\nLearning Centers Map | /centers\nContact Us | /contact",
        { help: "One per line, as “label | address”." },
      ),
    },
  },
} satisfies Record<string, CorePageDef>;

export type CorePageKey = keyof typeof CORE_PAGES;

export function isCorePageKey(key: string): key is CorePageKey {
  return Object.prototype.hasOwnProperty.call(CORE_PAGES, key);
}

type StoredBlocks = Record<string, Record<string, string>>;
type CorePageState = Record<string, { enabled: boolean; seoTitle: string | null; seoDescription: string | null }>;

function storedBlocks(): Promise<StoredBlocks> {
  return cached("content_blocks", async () => {
    const rows = await query<{ page_key: string; block_key: string; value: string | null }>(
      "SELECT page_key, block_key, value FROM content_blocks",
    );
    const out: StoredBlocks = {};
    for (const r of rows) {
      if (r.value === null) continue;
      (out[r.page_key] ??= {})[r.block_key] = r.value;
    }
    return out;
  });
}

export function corePageStates(): Promise<CorePageState> {
  return cached("core_pages", async () => {
    const rows = await query<{ page_key: string; is_enabled: number; seo_title: string | null; seo_description: string | null }>(
      "SELECT page_key, is_enabled, seo_title, seo_description FROM core_pages",
    );
    const out: CorePageState = {};
    for (const r of rows) {
      out[r.page_key] = { enabled: Boolean(r.is_enabled), seoTitle: r.seo_title, seoDescription: r.seo_description };
    }
    return out;
  });
}

export async function isCorePageEnabled(key: CorePageKey): Promise<boolean> {
  const def: CorePageDef = CORE_PAGES[key];
  if (!def.canDisable) return true;
  return (await corePageStates())[key]?.enabled ?? true;
}

/** Call at the top of a built-in page: a page switched off in the admin is a 404. */
export async function assertCorePageEnabled(key: CorePageKey) {
  if (!(await isCorePageEnabled(key))) notFound();
}

/** Paths of built-in pages that are switched off, so menus can leave them out. */
export async function disabledCorePaths(): Promise<Set<string>> {
  const states = await corePageStates();
  const out = new Set<string>();
  for (const [key, def] of Object.entries(CORE_PAGES) as [string, CorePageDef][]) {
    if (def.canDisable && def.path && states[key]?.enabled === false) out.add(def.path);
  }
  return out;
}

export async function corePageSeo(key: CorePageKey) {
  const def: CorePageDef = CORE_PAGES[key];
  const state = (await corePageStates())[key];
  return {
    title: state?.seoTitle || def.seo?.title || def.label,
    description: state?.seoDescription || def.seo?.description,
  };
}

export type PageCopy = {
  /** The block's text, or its default. */
  t: (block: string) => string;
  /** A `paragraphs` block split into paragraphs. */
  paras: (block: string) => string[];
  /** An `image` block's picture, if one is set. */
  image: (block: string) => MediaRef | undefined;
  /** A `toggle` block: is it switched on? */
  on: (block: string) => boolean;
  /** An `order` block: its keys in order, with any the editor has not placed added at the end. */
  order: (block: string) => string[];
};

export async function getPageCopy(key: CorePageKey): Promise<PageCopy> {
  const def: CorePageDef = CORE_PAGES[key];
  const stored = (await storedBlocks())[key] ?? {};
  const value = (block: string) => {
    const v = stored[block];
    return v !== undefined && v.trim() !== "" ? v : (def.blocks[block]?.default ?? "");
  };

  const imageIds = Object.entries(def.blocks)
    .filter(([, b]) => b.type === "image")
    .map(([k]) => Number(value(k)))
    .filter((n) => Number.isInteger(n) && n > 0);
  const media = await getMediaRefs(imageIds);

  return {
    t: value,
    paras: (block) =>
      value(block)
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    image: (block) => media[Number(value(block))],
    on: (block) => value(block) !== "0",
    order: (block) => {
      const known = (def.blocks[block]?.options ?? []).map((o) => o.value);
      const stored = value(block)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => known.includes(s));
      return [...new Set([...stored, ...known])];
    },
  };
}
