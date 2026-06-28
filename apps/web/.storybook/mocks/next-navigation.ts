/** Storybook (Vite, без Next-рантайма) мок для next/navigation. */
const noop = () => {};

export function usePathname(): string {
  return "/dashboard";
}

export function useRouter() {
  return { push: noop, replace: noop, back: noop, forward: noop, refresh: noop, prefetch: noop };
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useParams(): Record<string, string> {
  return {};
}

export function redirect(_url: string): never {
  throw new Error(`redirect(${_url}) is a no-op in Storybook`);
}

export function notFound(): never {
  throw new Error("notFound() is a no-op in Storybook");
}
