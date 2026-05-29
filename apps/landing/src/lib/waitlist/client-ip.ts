const TRUST_PROXY_VALUES = new Set(["1", "true", "yes"]);

export function resolveClientIp(request: Request, clientAddress: string | undefined): string {
  const socketAddress = normalizeAddress(clientAddress);
  if (!shouldTrustForwardedHeaders(socketAddress)) {
    return socketAddress;
  }

  return (
    firstForwardedAddress(request.headers.get("x-forwarded-for")) ||
    normalizeAddress(request.headers.get("cf-connecting-ip")) ||
    normalizeAddress(request.headers.get("x-real-ip")) ||
    socketAddress
  );
}

function shouldTrustForwardedHeaders(socketAddress: string): boolean {
  const trustProxy = process.env["WAITLIST_TRUST_PROXY"]?.trim().toLowerCase();
  return TRUST_PROXY_VALUES.has(trustProxy ?? "") || isPrivateProxyAddress(socketAddress);
}

function firstForwardedAddress(value: string | null): string {
  if (!value) return "";
  return normalizeAddress(value.split(",")[0]);
}

function normalizeAddress(value: string | null | undefined): string {
  const address = value?.trim() ?? "";
  if (!address) return "";
  if (address.startsWith("[") && address.includes("]")) {
    return address.slice(1, address.indexOf("]"));
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(address)) {
    return address.slice(0, address.lastIndexOf(":"));
  }
  return address;
}

function isPrivateProxyAddress(address: string): boolean {
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address) ||
    address.toLowerCase().startsWith("fc") ||
    address.toLowerCase().startsWith("fd")
  );
}
