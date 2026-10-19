import { ChangePasswordForm, ProfileForm } from "@/components/account/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { requireCustomer } from "@/server/auth/guards";

export default async function ProfilePage() {
  const session = await requireCustomer("/account/profile");
  const c = session.customer;
  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description={`Signed in as ${session.user.email}`} />
      <Card>
        <CardHeader title="Contact details" />
        <CardBody>
          <ProfileForm defaults={{ firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone ?? "", companyName: c.companyName ?? "" }} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Password" />
        <CardBody>
          <ChangePasswordForm />
        </CardBody>
      </Card>
    </div>
  );
}
