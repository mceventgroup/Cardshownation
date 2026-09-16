import { BlockList, isIP } from "node:net";

// Cloudflare's published origin-facing proxy networks, checked 2026-09-16.
// https://www.cloudflare.com/ips/
const proxies = new BlockList();
for (const cidr of [
  "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "104.16.0.0/13",
  "104.24.0.0/14", "108.162.192.0/18", "131.0.72.0/22", "141.101.64.0/18",
  "162.158.0.0/15", "172.64.0.0/13", "173.245.48.0/20", "188.114.96.0/20",
  "190.93.240.0/20", "197.234.240.0/22", "198.41.128.0/17",
]) {
  const [network, prefix] = cidr.split("/");
  proxies.addSubnet(network, Number(prefix), "ipv4");
}
for (const cidr of [
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
  "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
]) {
  const [network, prefix] = cidr.split("/");
  proxies.addSubnet(network, Number(prefix), "ipv6");
}

export function isCloudflareIp(ip: string | null) {
  if (!ip) return false;
  const version = isIP(ip);
  return version !== 0 && proxies.check(ip, version === 4 ? "ipv4" : "ipv6");
}
