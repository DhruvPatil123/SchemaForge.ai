"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "schemaforge_cookie_consent_v1";

type ConsentChoice = "essential" | "all";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!window.localStorage.getItem(CONSENT_KEY));
  }, []);

  function saveConsent(choice: ConsentChoice) {
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ choice, accepted_at: new Date().toISOString() })
    );
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-background/95 px-4 py-4 shadow-2xl backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-medium">Cookie preferences</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We use essential cookies and local storage to keep the app working. Optional cookies
            may be used for analytics after you accept them. See our{" "}
            <Link href="/privacy" className="text-indigo-300 underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => saveConsent("essential")}>
            Essential only
          </Button>
          <Button size="sm" onClick={() => saveConsent("all")}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
