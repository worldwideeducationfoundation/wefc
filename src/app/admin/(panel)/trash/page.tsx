import type { Metadata } from "next";
import { ConfirmButton, SubmitButton } from "@/components/admin/client";
import { Badge, EmptyState, PageHeader, btn, formatDateTime } from "@/components/admin/ui";
import { listTrash, TRASH_TYPES, trashType } from "@/server/admin/trash";
import { roleCan } from "@/server/auth/roles";
import { requireUser } from "@/server/auth/session";
import { emptyTrash, purgeItem, restoreItem } from "./actions";

export const metadata: Metadata = { title: "Trash" };

export default async function TrashPage() {
  const user = await requireUser();
  const visible = TRASH_TYPES.filter((t) => roleCan(user.role, t.viewCap));
  const items = await listTrash(visible);
  const canEmpty = items.some((i) => {
    const t = trashType(i.type);
    return t && roleCan(user.role, t.purgeCap);
  });

  return (
    <>
      <PageHeader
        title="Trash"
        description="Deleted items wait here. Restore puts an item back exactly as it was; Delete forever cannot be undone."
        actions={
          canEmpty && (
            <form action={emptyTrash}>
              <ConfirmButton message="Delete everything in Trash forever? This cannot be undone.">Empty Trash</ConfirmButton>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState title="Trash is empty" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-sand-200 bg-white shadow-xs">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-sand-50 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              <tr>
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Deleted</th>
                <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {items.map((item) => {
                const t = trashType(item.type)!;
                return (
                  <tr key={`${item.type}-${item.id}`}>
                    <td className="max-w-md truncate px-4 py-2.5 font-semibold text-forest-900">{item.title}</td>
                    <td className="px-4 py-2.5">
                      <Badge value="draft" label={item.label} />
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(item.deletedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <span className="inline-flex gap-1">
                        {roleCan(user.role, t.restoreCap) && (
                          <form action={restoreItem.bind(null, item.type, item.id)}>
                            <SubmitButton className={btn.secondary} pendingLabel="Restoring…">
                              Restore
                            </SubmitButton>
                          </form>
                        )}
                        {roleCan(user.role, t.purgeCap) && (
                          <form action={purgeItem.bind(null, item.type, item.id)}>
                            <ConfirmButton className={btn.ghost} message={`Delete “${item.title}” forever?`}>
                              Delete forever
                            </ConfirmButton>
                          </form>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
