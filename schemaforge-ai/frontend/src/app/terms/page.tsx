const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@schemaforge.ai";

const sections = [
  {
    title: "Using The Service",
    body: [
      "You are responsible for the prompts, files, schemas, comments, and other content you submit.",
      "You must not use the service to attack, disrupt, reverse engineer, overload, or access systems without authorization.",
      "You must not submit content that is unlawful, harmful, or violates another party's rights.",
    ],
  },
  {
    title: "Accounts And Security",
    body: [
      "If accounts are enabled, you are responsible for keeping credentials secure and for activity under your account.",
      "You must provide accurate signup, billing, and support information.",
      "We may suspend or limit access to protect the product, users, or infrastructure.",
    ],
  },
  {
    title: "Generated Output",
    body: [
      "SchemaForge AI generates database schemas, DDL, exports, and recommendations from user input.",
      "Generated output may require human review before use in production systems.",
      "You are responsible for validating correctness, compliance, data retention rules, indexes, constraints, migrations, and security implications.",
    ],
  },
  {
    title: "Plans And Payments",
    body: [
      "Free and paid plan limits may apply. Paid subscriptions, upgrades, downgrades, cancellations, taxes, and refunds are governed by the billing terms shown at purchase.",
      "Payments should be processed by a third-party payment provider. SchemaForge AI should not store full card numbers.",
      "Subscription access may change after cancellation, failed payment, abuse, or plan changes.",
    ],
  },
  {
    title: "Intellectual Property",
    body: [
      "We retain ownership of the product, software, design, documentation, and service infrastructure.",
      "You retain ownership of your submitted content and generated schemas, subject to rights needed for us to operate the service.",
      "Feedback or suggestions may be used to improve the product without obligation.",
    ],
  },
  {
    title: "Disclaimers And Liability",
    body: [
      "The service is provided as available and without warranties to the extent allowed by law.",
      "We are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages to the extent allowed by law.",
      "Nothing in these terms limits liability that cannot legally be limited.",
    ],
  },
  {
    title: "Changes And Contact",
    body: [
      "We may update these terms and will revise the updated date when changes are made.",
      `Questions about these terms can be sent to ${supportEmail}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
      <div className="mb-10">
        <p className="text-sm font-medium text-indigo-300">Last updated May 21, 2026</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-muted-foreground">
          These terms govern access to SchemaForge AI, including the website, workspace, API,
          generated outputs, and support channels.
        </p>
      </div>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              {section.body.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-10 border-t border-border pt-8">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Email{" "}
          <a className="text-indigo-300 underline-offset-4 hover:underline" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>{" "}
          for terms, account, or billing questions.
        </p>
      </section>
    </main>
  );
}
