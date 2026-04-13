import ResetPasswordForm from "@/components/reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{ email?: string; token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;

  return <ResetPasswordForm initialEmail={params.email ?? ""} initialToken={params.token ?? ""} />;
}
