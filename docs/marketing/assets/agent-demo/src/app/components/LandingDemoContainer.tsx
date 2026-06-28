import { LandingAgentDemo } from "./LandingAgentDemo";
import { LandingDemoCloseups } from "./LandingDemoCloseups";

export function LandingDemoContainer() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-20 px-4 sm:px-8 font-sans">
      <LandingAgentDemo />
      <LandingDemoCloseups />
    </div>
  );
}
