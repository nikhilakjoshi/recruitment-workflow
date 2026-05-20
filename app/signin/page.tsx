import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SignInForm } from "./signin-form";

export default async function SignInPage() {
  const session = await getSession();
  if (session.userId) {
    redirect("/");
  }
  return <SignInForm />;
}
