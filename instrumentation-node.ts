import dns from "node:dns";
import net from "node:net";

// Node 20 tries IPv6 first and its 250 ms fallback is too short on some networks,
// which surfaces as "TypeError: fetch failed" for Supabase requests.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamilyAttemptTimeout(1000);