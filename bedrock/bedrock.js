class Random {
	constructor(seed) {
		const multiplier = 0x5DEECE66Dn;
		const mask = (1n << 48n) - 1n;

		this.v = (BigInt(seed) ^ multiplier) & mask;
	}

	next(bits) {
		const multiplier = 0x5DEECE66Dn;
		const addend = 0xBn;
		const mask = (1n << 48n) - 1n;

		this.v = (this.v * multiplier + addend) & mask;
		return Number(BigInt.asIntN(32, this.v >> (48n - BigInt(bits))));
	}

	nextInt(bound) {
		if ((bound & -bound) == bound) {
			return Number(BigInt.asIntN(32, (BigInt(bound) * (BigInt)(this.next(31))) >> 31n));
		}

		for (; ;) {
			const bits = this.next(31);
			const val = bits % bound;

			if (!(bits - val + (bound - 1) < 0)) {
				return val;
			}
		}
	}

	nextDouble() {
		this.next(26);
		this.next(27);

		//const DOUBLE_UNIT = 1.1102230246251565e-16;
		//return (float64)(r.next(26)<<27+r.next(27)) * DOUBLE_UNIT
	}
}

const netherCeiling = (chunkX, chunkZ) => {
	const bedrock = [];
	for (let i = 0; i < 16 * 16; i++) {
		bedrock.push(new Array(5));
	}

	// minecraft 1.15.2.jar; https://launcher.mojang.com/v1/objects/59c55ae6c2a7c28c8ec449824d9194ff21dc7ff1/server.txt
	// net.minecraft.world.level.levelgen.NoiseBasedChunkGenerator buildSurfaceAndBedrock

	// net.minecraft.world.level.levelgen.WorldgenRandom setBaseChunkSeed
	const hellRNG = new Random(BigInt(chunkX) * 341873128712n + BigInt(chunkZ) * 132897987541n);

	// net.minecraft.world.level.levelgen.NoiseBasedChunkGenerator buildSurfaceAndBedrock
	for (let n = 0; n < 16; n++) {
		for (let i1 = 0; i1 < 16; i1++) {
			// net.minecraft.world.level.levelgen.surfacebuilders.NetherSurfaceBuilder apply
			hellRNG.nextDouble();
			hellRNG.nextDouble();
			hellRNG.nextDouble();
		}
	}

	// net.minecraft.world.level.levelgen.NoiseBasedChunkGenerator setBedrock
	for (let z = 0; z < 16; z++) {
		for (let x = 0; x < 16; x++) {
			// net.minecraft.world.level.levelgen.NetherGeneratorSettings
			const m = 127;
			const k = 0;

			for (let n = m; n >= m - 4; n--) {
				bedrock[x * 16 + z][n - 123] = n >= m - hellRNG.nextInt(5);
			}
			for (let n = k + 4; n >= k; n--) {
				hellRNG.nextInt(5);
			}
		}
	}

	return bedrock;
};

const BedrockLayer = L.GridLayer.extend({
	createTile({ x: chunkX, y: chunkZ }, done) {
		const tile = L.DomUtil.create('canvas', 'leaflet-tile');
		({ x: tile.width, y: tile.height } = this.getTileSize());

		setTimeout(() => {
			const bedrock = netherCeiling(chunkX, chunkZ);

			const ctx = tile.getContext('2d');

			ctx.fillStyle = 'purple';
			for (let x = 0; x < 16; x++) {
				for (let z = 0; z < 16; z++) {
					const column = bedrock[x * 16 + z];
					if (!column[0] && !column[1] && !column[2] && !column[3]) {
						ctx.fillRect(x * 16, z * 16, 16, 16);
					}
				}
			}

			ctx.lineWidth = 2;
			ctx.strokeStyle = '#999';
			ctx.strokeRect(0, 0, tile.width, tile.height);

			done(null, tile);
		}, 0);

		return tile;
	},
});

// https://web.archive.org/web/20090717035140if_/javascript.about.com/od/problemsolving/a/modulobug.htm
const mod = (v, n) => ((v % n) + n) % n;

// Modified L.Control.MousePosition
const MousePosition = L.Control.extend({
	options: {
		position: 'bottomleft',
	},

	onAdd(map) {
		this._container = L.DomUtil.create('div', 'leaflet-control-mouseposition');

		L.DomEvent.disableClickPropagation(this._container);

		map.on('mousemove', this._onMouseMove, this);

		return this._container;
	},

	onRemove(map) {
		map.off('mousemove', this._onMouseMove)
	},

	_onMouseMove({ latlng: { lng, lat } }) {
		const x = Math.floor(lng / 16);
		const z = Math.floor(lat / 16);

		const bedrock = netherCeiling(Math.floor(x / 16), Math.floor(z / 16));
		const column = bedrock[mod(x, 16) * 16 + mod(z, 16)];

		const layers = column.map(block => block ? '▮' : '▯').join('');
		this._container.innerHTML = `${x} / ${z}: ${layers}`;
	},
});

const crs = L.Util.extend({}, L.CRS.Simple, {
	transformation: L.transformation(1, 0, 1, 0),
});

const map = L.map('map', {
	crs,
	center: [0, 0],
	minZoom: -3,
	maxZoom: 3,
	zoom: 0,
});

new BedrockLayer({
	tileSize: 16 * 16,
	minZoom: -Infinity,
	minNativeZoom: 0,
	maxNativeZoom: 0,
}).addTo(map);

L.simpleGraticule({
	interval: 16 * 16,
	zoomIntervals: [
		{ start: -3, end: -2, interval: 16 * 16 * 2 },
		{ start: -1, end: 0, interval: 16 * 16 },
		{ start: 0, end: 1, interval: 16 * 8 },
		{ start: 2, end: 2, interval: 16 * 2 },
		{ start: 3, end: 3, interval: 16 },
	],
	labelMultiplier: 1 / 16,
	showOriginLabel: true,
	redraw: 'move',
}).addTo(map);

new MousePosition().addTo(map);