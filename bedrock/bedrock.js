if (!window.BigInt) {
	document.querySelector('.browser-warning').classList.add('show');
}

let processChunk = (tile, chunkX, chunkZ, done) => setTimeout(() => {
	renderChunk(tile, chunkX, chunkZ);
	done(null, tile);
}, 0);

const usingWorkers = window.OffscreenCanvas && window.Worker;
if (usingWorkers) {
	const callbacks = {};
	let id = 0;

	const workers = [];
	for (let i = 0; i < Math.max(1, navigator.hardwareConcurrency); i++) {
		const worker = new Worker('/bedrock/nether-bedrock.js');
		worker.onmessage = ({ data: { id } }) => {
			callbacks[id]();
			delete callbacks[id];
		};

		workers.push(worker);
	}

	processChunk = (tile, chunkX, chunkZ, done) => {
		callbacks[++id] = () => done(null, tile);

		const offscreen = tile.transferControlToOffscreen();
		workers[id % workers.length].postMessage({
			tile: offscreen,
			chunkX,
			chunkZ,
			id,
		}, [offscreen]);
	};
}

const BedrockLayer = L.GridLayer.extend({
	createTile({ x: chunkX, y: chunkZ }, done) {
		const tile = L.DomUtil.create('canvas', 'leaflet-tile');
		({ x: tile.width, y: tile.height } = this.getTileSize());

		processChunk(tile, chunkX, chunkZ, done);
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
		map.off('mousemove', this._onMouseMove);
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
	minZoom: usingWorkers ? -3 : -2,
	maxZoom: 3,
	zoom: 0,
});
map.attributionControl.addAttribution('Created by <a href=https://tomthorogood.net>Tom Thorogood</a> for <a href=https://www.minecraft.net>Minecraft</a> 1.15.2');

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
		{ start: 1, end: 1, interval: 16 * 8 },
		{ start: 2, end: 2, interval: 16 * 2 },
		{ start: 3, end: 3, interval: 16 },
	],
	labelMultiplier: 1 / 16,
	showOriginLabel: true,
	redraw: 'move',
}).addTo(map);

new MousePosition().addTo(map);

const gotoRect = L.rectangle([[0, 0], [16, 16]], {
	color: '#000',
	fillOpacity: 0.1,
});

const GoToAction = L.Toolbar2.Action.extend({
	options: {
		toolbarIcon: {
			html: '⮞',
			tooltip: 'Go to coordinates',
		},
	},

	addHooks() {
		// TODO(tmthrgd): Use something better than prompt.
		let coords = (prompt('Go to coordinates:') || '')
			.trim()
			.split(/[\/ ,]+/g)
			.map(c => parseInt(c.trim(), 10) * 16);
		if (coords.some(c => isNaN(c))) {
			return;
		}

		switch (coords.length) {
			case 2:
				coords = [coords[1], coords[0]];
				break;
			case 3:
				coords = [coords[2], coords[0]];
				break;
			default:
				return;
		}

		const center = coords.map(c => c + 8);
		const corner = coords.map(c => c + 16);

		if (map.getZoom() < -1) {
			map.setView(center, 0);
		} else {
			map.panTo(center);
		}

		gotoRect.addTo(map);
		gotoRect.setBounds([coords, corner]);
	},
});

new L.Toolbar2.Control({
	position: 'topleft',
	actions: [GoToAction],
}).addTo(map);

map.restoreView();