/* Magic Mirror
 * Module: MMM-MyCommute
 *
 * Uses TomTom Routing + Search APIs.
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const request = require("request");
const moment = require("moment");
const fs = require("fs");
const path = require("path");

const GEOCODE_CACHE_FILE = path.join(__dirname, ".geocode-cache.json");
const COORD_RE = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/;
const REQUEST_SPACING_MS = 250; // stay under TomTom free-tier QPS
const MAX_429_RETRIES = 3;

const MODE_MAP = {
	driving: "car",
	walking: "pedestrian",
	bicycling: "bicycle"
};

const AVOID_MAP = {
	tolls: "tollRoads",
	highways: "motorways",
	ferries: "ferries"
};

module.exports = NodeHelper.create({
	start: function () {
		console.log("====================== Starting node_helper for module [" + this.name + "]");
		this.geocodeCache = this.loadGeocodeCache();
	},

	loadGeocodeCache: function () {
		try {
			if (fs.existsSync(GEOCODE_CACHE_FILE)) {
				return JSON.parse(fs.readFileSync(GEOCODE_CACHE_FILE, "utf8"));
			}
		} catch (e) {
			console.log("MMM-MyCommute: failed to read geocode cache, starting fresh. " + e.message);
		}
		return {};
	},

	persistGeocodeCache: function () {
		try {
			fs.writeFileSync(GEOCODE_CACHE_FILE, JSON.stringify(this.geocodeCache, null, 2));
		} catch (e) {
			console.log("MMM-MyCommute: failed to write geocode cache. " + e.message);
		}
	},

	socketNotificationReceived: function (notification, payload) {
		if (notification === "TOMTOM_TRAFFIC_GET") {
			this.getPredictions(payload);
		}
	},

	// Serialized request with retry-after on HTTP 429 so we don't trip
	// TomTom's free-tier rate limit when polling multiple destinations.
	throttledRequest: function (url, callback, attempt) {
		attempt = attempt || 0;
		request({ url: url, method: "GET" }, function (error, response, body) {
			if (!error && response && response.statusCode === 429 && attempt < MAX_429_RETRIES) {
				const retryAfter = parseInt(response.headers && response.headers["retry-after"], 10);
				const wait = (isNaN(retryAfter) ? Math.pow(2, attempt) : retryAfter) * 1000;
				console.log("MMM-MyCommute: rate limited, retrying in " + wait + "ms");
				return setTimeout(() => this.throttledRequest(url, callback, attempt + 1), wait);
			}
			callback(error, response, body);
		}.bind(this));
	},

	geocode: function (address, apiKey, callback) {
		if (COORD_RE.test(address)) {
			const parts = address.split(",").map(s => parseFloat(s.trim()));
			return callback(null, { lat: parts[0], lon: parts[1] });
		}
		if (this.geocodeCache[address]) {
			return callback(null, this.geocodeCache[address]);
		}
		const url = "https://api.tomtom.com/search/2/geocode/" + encodeURIComponent(address) + ".json?limit=1&key=" + encodeURIComponent(apiKey);
		const self = this;
		this.throttledRequest(url, function (error, response, body) {
			if (error || !response || response.statusCode !== 200) {
				const msg = error ? error.message : ("HTTP " + (response && response.statusCode));
				return callback("Geocoding failed for \"" + address + "\": " + msg);
			}
			let data;
			try {
				data = JSON.parse(body);
			} catch (e) {
				return callback("Geocoding returned invalid JSON for \"" + address + "\"");
			}
			if (!data.results || data.results.length === 0 || !data.results[0].position) {
				return callback("Could not geocode \"" + address + "\"");
			}
			const pos = { lat: data.results[0].position.lat, lon: data.results[0].position.lon };
			self.geocodeCache[address] = pos;
			self.persistGeocodeCache();
			callback(null, pos);
		});
	},

	geocodeMany: function (addresses, apiKey, callback) {
		const results = new Array(addresses.length);
		const self = this;
		const step = function (i) {
			if (i >= addresses.length) return callback(null, results);
			self.geocode(addresses[i], apiKey, function (err, pos) {
				if (err) return callback(err);
				results[i] = pos;
				step(i + 1);
			});
		};
		step(0);
	},

	buildRoutingUrl: function (points, dest, apiKey) {
		const locations = points.map(p => p.lat + "," + p.lon).join(":");
		let url = "https://api.tomtom.com/routing/1/calculateRoute/" + locations + "/json?key=" + encodeURIComponent(apiKey);

		const mode = MODE_MAP[dest.mode] || "car";
		url += "&travelMode=" + mode;

		if (dest.arrival_time) {
			// TomTom expects RFC 3339 with explicit offset, no fractional seconds.
			url += "&arriveAt=" + encodeURIComponent(moment.unix(dest.arrival_time).format("YYYY-MM-DDTHH:mm:ssZ"));
		} else {
			url += "&departAt=now&traffic=true&computeTravelTimeFor=all";
		}

		if (dest.avoid) {
			const parts = dest.avoid.split("|");
			const mapped = [];
			for (let i = 0; i < parts.length; i++) {
				const a = AVOID_MAP[parts[i]];
				if (a && mapped.indexOf(a) === -1) mapped.push(a);
			}
			mapped.forEach(a => { url += "&avoid=" + a; });
		}

		if (dest.alternatives === true) {
			url += "&maxAlternatives=2";
		}

		if (dest.language) {
			url += "&language=" + encodeURIComponent(dest.language);
		}

		return url;
	},

	handleRoutingResponse: function (dest, error, response, body) {
		const prediction = { config: dest.config };

		if (error || !response || response.statusCode !== 200) {
			prediction.error = true;
			if (response && body) {
				let data;
				try { data = JSON.parse(body); } catch (e) { /* ignore */ }
				if (data && data.error && data.error.description) {
					prediction.error_msg = data.error.description;
				} else {
					prediction.error_msg = "HTTP " + response.statusCode;
				}
			} else {
				prediction.error_msg = error ? error.message : "Unknown routing error";
			}
			console.log("MMM-MyCommute: " + prediction.error_msg);
			return prediction;
		}

		let data;
		try {
			data = JSON.parse(body);
		} catch (e) {
			prediction.error = true;
			prediction.error_msg = "TomTom returned invalid JSON";
			return prediction;
		}

		if (!data.routes || data.routes.length === 0) {
			prediction.error = true;
			prediction.error_msg = (data.error && data.error.description) || "No routes found";
			return prediction;
		}

		const routeList = [];
		const trafficRequested = !dest.config.arrival_time;
		for (let i = 0; i < data.routes.length; i++) {
			const r = data.routes[i];
			const s = r.summary || {};
			const routeObj = {
				summary: data.routes.length > 1 ? "Route " + (i + 1) : "",
				time: trafficRequested && typeof s.noTrafficTravelTimeInSeconds === "number"
					? s.noTrafficTravelTimeInSeconds
					: s.travelTimeInSeconds
			};
			if (trafficRequested && typeof s.travelTimeInSeconds === "number") {
				routeObj.timeInTraffic = s.travelTimeInSeconds;
			}
			routeList.push(routeObj);
		}
		prediction.routes = routeList;
		return prediction;
	},

	getPredictions: function (payload) {
		const self = this;
		const apiKey = payload.apiKey;
		const predictions = [];

		const processOne = function (index) {
			if (index >= payload.destinations.length) {
				self.sendSocketNotification("TOMTOM_TRAFFIC_RESPONSE" + payload.instanceId, predictions);
				return;
			}
			const dest = payload.destinations[index];
			const next = function (pred) {
				predictions[index] = pred;
				setTimeout(() => processOne(index + 1), REQUEST_SPACING_MS);
			};

			if (dest.config.mode === "transit") {
				return next({
					config: dest.config,
					error: true,
					error_msg: "Transit mode is not supported by TomTom; use driving, walking, or bicycling"
				});
			}

			const addresses = [dest.origin];
			if (dest.waypoints) {
				dest.waypoints.split("|").forEach(wp => addresses.push(wp));
			}
			addresses.push(dest.destination);

			self.geocodeMany(addresses, apiKey, function (err, points) {
				if (err) {
					console.log("MMM-MyCommute: " + err);
					return next({ config: dest.config, error: true, error_msg: err });
				}
				const url = self.buildRoutingUrl(points, dest, apiKey);
				self.throttledRequest(url, function (rErr, rResp, rBody) {
					next(self.handleRoutingResponse(dest, rErr, rResp, rBody));
				});
			});
		};

		processOne(0);
	}
});
