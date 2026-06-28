import * as React from "react";

type NextLinkProps = React.ComponentProps<"a"> & { href: string | { pathname?: string } };

/** Storybook (Vite, без Next-рантайма) мок для next/link — рендерит обычный <a>. */
const NextLink = React.forwardRef<HTMLAnchorElement, NextLinkProps>(({ href, children, ...props }, ref) => {
  const to = typeof href === "string" ? href : href?.pathname ?? "#";
  return (
    <a ref={ref} href={to} {...props}>
      {children}
    </a>
  );
});
NextLink.displayName = "NextLinkMock";

export default NextLink;
