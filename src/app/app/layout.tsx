import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import "./augur-theme.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="aug-app-layout">
      <AppSidebar user={session.user} />
      <main className="aug-main">{children}</main>
    </div>
  );
}
