// List of supported email domains

export const DOMAINS = [
	{ owner: "kadangkesel", domain: "kadangkesel.site" },
	{ owner: "kadangkesel", domain: "kadangkesel.online" },
	{ owner: "kadangkesel", domain: "estimasion.my.id" },
	{ owner: "kadangkesel", domain: "kutanklanank.my.id" },
	{ owner: "kadangkesel", domain: "mukaberuk.web.id" },
	{ owner: "kadangkesel", domain: "naisely.my.id" },
	{ owner: "kadangkesel", domain: "pantatbergetar.my.id" },
	{ owner: "kadangkesel", domain: "nestapvo.site" },
	{ owner: "kadangkesel", domain: "hemdev.cloud" },
	{ owner: "kadangkesel", domain: "mezucy.site" },
	{ owner: "kadangkesel", domain: "orenage.site" },
	{ owner: "kadangkesel", domain: "widuri.site" },
	{ owner: "kadangkesel", domain: "kusaragi.site" },
	{ owner: "kadangkesel", domain: "murtualis.site" },
	{ owner: "kadangkesel", domain: "erazely.site" },
	{ owner: "kadangkesel", domain: "nimbuslogy.site" },
	// A subdomain, not an apex. Nothing in this codebase parses domain labels --
	// every consumer treats the domain as an opaque string matched via
	// DOMAINS_SET.has() -- so no code change is needed beyond this line. It only
	// receives mail once Cloudflare Email Routing is onboarded for this exact
	// hostname; the parent zone's MX record does NOT cover its subdomains.
	{ owner: "kadangkesel", domain: "sub.kusaragi.site" },
] satisfies {
	owner: string;
	domain: string;
}[];

export const DOMAINS_SET = new Set(DOMAINS.map((d) => d.domain));
