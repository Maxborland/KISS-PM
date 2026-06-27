import { createBrowserRouter } from "react-router";
import { LandingDemoContainer } from "./components/LandingDemoContainer";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingDemoContainer,
  },
]);
