import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LandingPage from "@/components/landing-page";
import "./landing.css";

export default async function Home() {
  const session = await auth();
  if (session) {
    redirect("/app/dashboard");
  }

  return <LandingPage />;
}
