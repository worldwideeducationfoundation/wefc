/**
 * Roles and what each may do.
 *
 * Every admin page and every action asks for a capability, never a role by
 * name, so changing what an editor can do is a one-line edit here. The same
 * check hides the button and guards the action, so the two cannot disagree.
 *
 * Shared by server and client (the sidebar hides what a role cannot open),
 * so this file holds no secrets and imports nothing server-only.
 */
export const ROLES = ["super_admin", "administrator", "editor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  administrator: "Administrator",
  editor: "Editor",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Everything, including managing other admins and restoring backups.",
  administrator: "All content, settings, messages and the activity log. Cannot manage admins.",
  editor: "Create and edit content and upload images. Cannot delete, publish settings or read messages.",
};

export const CAPABILITIES = [
  "content.view",
  "content.create",
  "content.edit",
  "content.delete",
  "media.view",
  "media.upload",
  "media.delete",
  "settings.manage",
  "submissions.view",
  "submissions.manage",
  "activity.view",
  "users.manage",
  "backups.manage",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<Role, readonly Capability[] | "*"> = {
  super_admin: "*",
  administrator: [
    "content.view", "content.create", "content.edit", "content.delete",
    "media.view", "media.upload", "media.delete",
    "settings.manage", "submissions.view", "submissions.manage", "activity.view",
  ],
  // No submissions: messages from the public are personal data, and reading
  // them is a separate decision from being allowed to edit a project page.
  editor: ["content.view", "content.create", "content.edit", "media.view", "media.upload"],
};

export function roleCan(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  const caps = ROLE_CAPABILITIES[role];
  return caps === "*" || caps.includes(capability);
}
