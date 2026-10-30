import type { Metadata } from "next";
import "./tailwind.css";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — WEF Canada Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="admin-root flex min-h-screen flex-1 flex-col overflow-x-hidden font-ui antialiased">{children}</div>;
}
