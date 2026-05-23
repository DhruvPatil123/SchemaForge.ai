const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@schemaforge.ai";

const sections = [
  {
    title: "Information We Collect",
    body: [
      "Contact details you provide when asking for help, reporting issues, or creating an account if accounts are enabled.",
      "Schema prompts, uploaded CSV files, generated schemas, comments, exports, and related workspace activity needed to provide the service.",
      "Technical and usage data such as IP address, browser, device, request logs, error events, and approximate usage volume.",
      "Payment and subscription data if paid plans are enabled. Card details should be handled by the payment processor, not stored by SchemaForge AI.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "Operate, secure, debug, and improve SchemaForge AI.",
      "Generate schemas, save versions, provide share links, and respond to support or bug reports.",
      "Monitor abuse, enforce limits, prevent brute force attempts, and protect service reliability.",
      "Send service messages such as verification, password reset, billing, and security notices when those flows are enabled.",
    ],
  },
  {
    title: "Cookies And Local Storage",
    body: [
      "Essential cookies and local storage may be used to keep the app functional, remember preferences, and protect sessions.",
      "Optional analytics or marketing cookies should only be used after consent where required by law.",
      "You can clear browser storage or cookies at any time, though some product preferences may reset.",
    ],
  },
  {
    title: "Sharing And Retention",
    body: [
      "We may share limited data with infrastructure, analytics, payment, email, security, and support providers that help run the service.",
      "We may disclose information when required by law, to protect rights and safety, or as part of a business transfer.",
      "We retain information only as long as needed for product operation, legal obligations, security, and legitimate business purposes.",
    ],
  },
  {
    title: "Your Choices",
    body: [
      "You may request access, correction, deletion, or export of your personal information where applicable.",
      "You may opt out of non-essential communications and reject optional cookies where consent is required.",
      `Contact ${supportEmail} for privacy requests.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
      <div className="mb-10">
        <p className="text-sm font-medium text-indigo-300">Last updated May 21, 2026</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-muted-foreground">
          This policy explains how SchemaForge AI handles information when you use the product,
          website, API, and support channels.
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
          For privacy questions, email{" "}
          <a className="text-indigo-300 underline-offset-4 hover:underline" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
          .
        </p>
      </section>
    </main>
  );
}
