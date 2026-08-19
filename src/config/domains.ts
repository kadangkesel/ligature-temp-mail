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
] satisfies {
	owner: string;
	domain: string;
}[];

export const DOMAINS_SET = new Set(DOMAINS.map((d) => d.domain));
