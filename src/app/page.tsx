import { redirect } from "next/navigation";

import AuthShell from "@/components/auth-shell";
import { getAuthSession } from "@/lib/auth";

export default async function Home() {
  const session = await getAuthSession();

  if (session?.user?.id) {
    redirect("/feed");
  }

  return <AuthShell />;
}
