import { Suspense } from "react";
import { WorkspaceClient } from "./workspace-client";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading workspace...</div>}>
      <WorkspaceClient />
    </Suspense>
  );
}
