// Who may use the AI features (scanning and the study helper)? They run on the owner's free daily allowance.
//   OWNER_IPS     – optional secret: the owner's internet address(es), comma-separated. Exact addresses, or ranges
//                   like 203.0.113.0/24 or 2001:db8:1:2::/64 (home IPv6 addresses change often, so use the /64 the app suggests).
//   APP_PASSCODE  – optional secret: a passcode that also unlocks them, from any network.
// With neither set, anyone can use them. Notes themselves never touch the server: they stay on each person's device.

const expand6 = (ip) => {
  const [head, tail = ''] = ip.split('::');
  const a = head ? head.split(':') : [], b = tail ? tail.split(':') : [];
  const gap = ip.includes('::') ? Array(Math.max(0, 8 - a.length - b.length)).fill('0') : [];
  return [...a, ...gap, ...b].map((x) => x.padStart(4, '0').toLowerCase());
};
const ip4 = (ip) => ip.split('.').reduce((n, o) => n * 256 + (+o & 255), 0) >>> 0;

export function ipMatches(ip, rule) {
  rule = rule.trim();
  if (!ip || !rule) return false;
  if (!rule.includes('/')) return rule.toLowerCase() === ip.toLowerCase();
  const [base, bitsText] = rule.split('/');
  const bits = +bitsText;
  if (base.includes(':') && ip.includes(':')) {
    const a = expand6(base), b = expand6(ip);
    let left = bits;
    for (let i = 0; i < 8 && left > 0; i++, left -= 16) {
      const take = Math.min(16, left), mask = (0xffff << (16 - take)) & 0xffff;
      if ((parseInt(a[i], 16) & mask) !== (parseInt(b[i], 16) & mask)) return false;
    }
    return true;
  }
  if (!base.includes(':') && !ip.includes(':')) {
    const mask = bits ? (0xffffffff << (32 - bits)) >>> 0 : 0;
    return ((ip4(base) & mask) >>> 0) === ((ip4(ip) & mask) >>> 0);
  }
  return false;
}

// A good OWNER_IPS value for this address: the exact IPv4 address, or the /64 network for IPv6.
export const suggestRule = (ip) => (ip.includes(':') ? `${expand6(ip).slice(0, 4).map((h) => h.replace(/^0+(?=.)/, '')).join(':')}::/64` : ip);

export function access(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  const rules = String(env.OWNER_IPS || '').split(',').filter((r) => r.trim());
  const passOk = !!env.APP_PASSCODE && request.headers.get('x-passcode') === env.APP_PASSCODE;
  const ipOk = rules.some((r) => ipMatches(ip, r));
  const locked = rules.length > 0 || !!env.APP_PASSCODE;
  return { ip, owner: !locked || ipOk || passOk, locked, ipLocked: rules.length > 0, hasPasscode: !!env.APP_PASSCODE, suggest: suggestRule(ip) };
}

// The answer to send when someone isn't allowed: ask for the passcode if there is one, otherwise just say no.
export const refuse = (a, json) => (a.hasPasscode ? json({ error: 'passcode' }, 401) : json({ error: 'not-owner' }, 403));
