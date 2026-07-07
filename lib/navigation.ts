export function isSameNavigationRoute(
  pathname: string,
  searchParams: Pick<URLSearchParams, "get"> & { size?: number },
  href: string
) {
  const [base, query = ""] = href.split("?");
  if (base === "/") return pathname === "/";
  if (query) {
    const linkParams = new URLSearchParams(query);
    if (pathname !== base) return false;
    return Array.from(linkParams.entries()).every(
      ([key, value]) => searchParams.get(key) === value
    );
  }
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return false;

  if (pathname === base && (searchParams.size ?? 0) > 0) return false;
  return true;
}
