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

const renderChunk = (tile, chunkX, chunkZ) => {
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
};

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
	self.onmessage = ({ data: { tile, chunkX, chunkZ, id } }) => {
		renderChunk(tile, chunkX, chunkZ);
		postMessage({ id });
	};
}