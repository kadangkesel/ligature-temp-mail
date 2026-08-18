// Human-looking random address parts.
//
// Single source of truth: the API (`/api/generate`) imports these directly and
// the dashboard gets the same two lists injected into its client-side JS, so the
// two surfaces cannot drift apart.

export const FIRST_NAMES = [
	"adam",
	"agus",
	"ahmad",
	"aldi",
	"alif",
	"andi",
	"anggi",
	"anton",
	"arif",
	"asep",
	"bayu",
	"budi",
	"cahya",
	"dani",
	"dedi",
	"dewi",
	"dian",
	"dimas",
	"dwi",
	"eka",
	"endah",
	"erik",
	"fajar",
	"farid",
	"fitri",
	"gilang",
	"hadi",
	"hendra",
	"ilham",
	"indah",
	"intan",
	"irfan",
	"joko",
	"kurnia",
	"lestari",
	"lina",
	"maya",
	"nanda",
	"novi",
	"nur",
	"putra",
	"putri",
	"rahmat",
	"reza",
	"rina",
	"rizky",
	"sari",
	"satria",
	"siti",
	"surya",
	"tari",
	"tono",
	"umar",
	"wahyu",
	"wulan",
	"yoga",
	"yudi",
	"yuni",
	"zaki",
	"zahra",
];

export const LAST_NAMES = [
	"abdullah",
	"anggraini",
	"budiman",
	"gunawan",
	"halim",
	"hardiyanti",
	"hidayat",
	"irawan",
	"kusuma",
	"lestari",
	"maulana",
	"nugroho",
	"permata",
	"pradana",
	"pratama",
	"purnama",
	"puspita",
	"rahayu",
	"rahman",
	"rahmawati",
	"ramadhan",
	"santoso",
	"saputra",
	"setiawan",
	"siregar",
	"suryani",
	"utami",
	"wibowo",
	"wijaya",
	"yulianti",
];

/**
 * Uniform random integer in [0, max) via rejection sampling.
 *
 * A plain `getRandomValues() % max` is biased whenever `max` does not divide
 * 2^32; we discard the final partial bucket so every value is equally likely.
 */
export function randomInt(max: number): number {
	if (max <= 0) throw new RangeError("max must be positive");
	const limit = Math.floor(0x1_0000_0000 / max) * max;
	const buf = new Uint32Array(1);
	do {
		crypto.getRandomValues(buf);
	} while (buf[0] >= limit);
	return buf[0] % max;
}

function pick<T>(items: readonly T[]): T {
	return items[randomInt(items.length)];
}

/**
 * A human-looking local part, e.g. `budi.santoso`, `dewiwibowo42`, `a.pratama17`.
 * Mirrors the shapes the dashboard produces.
 */
/** Lowercase alphanumerics only — safe in a local part, and unambiguous to read aloud. */
const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SUFFIX_LENGTH = 6;

/**
 * ~31 bits of entropy (36^6). Names alone are guessable: the pool is only
 * 60 x 30 x 4 forms, so anyone could enumerate addresses and read other
 * people's mail. The suffix makes an address unguessable while the readable
 * name keeps it easy to dictate or retype.
 */
function randomSuffix(): string {
	let out = "";
	for (let i = 0; i < SUFFIX_LENGTH; i++) {
		out += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
	}
	return out;
}

export function randomLocalPart(): string {
	const first = pick(FIRST_NAMES);
	const last = pick(LAST_NAMES);
	const suffix = randomSuffix();
	switch (randomInt(4)) {
		case 0:
			return `${first}.${last}.${suffix}`;
		case 1:
			return `${first}${last}${randomInt(89) + 10}.${suffix}`;
		case 2:
			return `${first}.${last}${randomInt(9) + 1}.${suffix}`;
		default:
			return `${first[0]}.${last}${randomInt(89) + 10}.${suffix}`;
	}
}

/** Pick one of the supported domains at random. */
export function randomDomain(domains: readonly string[]): string {
	return pick(domains);
}

/** A full random address on a random supported domain. */
export function randomAddress(domains: readonly string[]): string {
	return `${randomLocalPart()}@${randomDomain(domains)}`;
}
