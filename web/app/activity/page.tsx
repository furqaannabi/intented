import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { ActivitySkeleton, ActivityView } from "./Activity";

export const metadata: Metadata = {
  title: "Activity · Intented",
  description: "Every payment the agent proposed, with the signed verdict, the model's reason and the on-chain result.",
};

export default function ActivityPage() {
  return (
    <div className="overflow-x-clip">
      <SiteHeader current="demo" />
      <main className="mx-auto max-w-[1440px] px-[clamp(16px,4.5vw,72px)]">
        <Suspense fallback={<ActivitySkeleton />}>
          <ActivityView />
        </Suspense>
      </main>
    </div>
  );
}
