# MMM-MyCommute

This a module for the [MagicMirror](https://github.com/MichMich/MagicMirror/tree/develop).

It shows your commute time using TomTom's Routing API (requires a free API key from TomTom).

It is a fork of [jclarke0000's work](https://github.com/jclarke0000/MMM-MyCommute/)

![Screenshot](/screenshots/MMM-MyCommute-screenshot.png?raw=true "Screenshot")

## Status

I started this fork because it seems Jeff Clarke has abondoned MMM-MyCommute, no recent updates and not mering PR's. I have merged the interesting changes I've found in other forks.

The module is a bit outdated, doesn't properly install on a new MagicMirror and doesn't live up to its expectations anymore. It's in need of a complete rewrite. 

*Support MMM-MyCommute rebuild*

I'm looking for some moral support to start a complete rebuild.

The rebuild will be fully open source and free of charge.

Feature requests from contributors will be implemented (reasonably).

Donate here: https://gofund.me/b15bc3a0

Forward and share the Gofund.me as you see fit. 

## Updating

### Migrating from the Google Directions version

This fork now uses the **TomTom Routing API** instead of Google's Directions API. If you're updating from an older version:

1. Sign up for a free API key at the [TomTom Developer Portal](https://developer.tomtom.com/) and replace your Google key in `apiKey`.
2. Any destinations configured with `mode: "transit"` must be changed — TomTom does not offer public-transit routing. Use `driving`, `walking`, or `bicycling` instead. Transit destinations will otherwise render an error.
3. The `transitMode`, `showNextVehicleDeparture`, `nextTransitVehicleDepartureFormat`, and `avoid: "indoor"` options are no longer supported and can be removed.
4. No changes are needed to `origin`, `destination`, `waypoints`, `startTime`, `endTime`, `hideDays`, `arrival_time`, calendar integration, or styling — those continue to work as before. Addresses are auto-geocoded on first use (see [Geocoding](#geocoding)).

### apikey → apiKey

In an earlier change the parameter `apikey` (no capital K) was renamed to `apiKey` (capital K). Please make sure, after updating, you apply this change in your `config.js` too.

## Installation

1. Navigate into your MagicMirror `modules` folder and execute<br>`git clone https://github.com/poonasor/MMM-MyCommute.git`.
2. Enter the `MMM-MyCommute` directory and execute `npm install`.
3. Register at the [TomTom Developer Portal](https://developer.tomtom.com/) and create an API key. The free tier includes a generous daily request allowance and covers both the Routing and Search APIs.
4. Restart MagicMirror<br>e.g. `pm2 restart mm`

## Geocoding

TomTom's Routing API needs latitude/longitude, not addresses. On first use each address is resolved via the TomTom Search API and the result is cached to `.geocode-cache.json` inside the module folder. Subsequent polls — and restarts — reuse the cache, so there's one Search call per new address and nothing after that. You can also put coordinates directly in `origin`/`destination` (e.g. `"43.6426,-79.3871"`) to skip geocoding entirely.

## NOTE To those updating from previous verions

You now configure the header in the standard way instead using the `headerText` and `showHeader` parameters. So if your config looked like this before:

```JavaScript
    {
      module: 'MMM-MyCommute',
      position: 'top_left',
      classes: 'default everyone',
      config: {
        showHeader: true,
        headerText: 'Traffic',
        ...
      }
    }
```

change it to this:

```JavaScript
   {
      module: 'MMM-MyCommute',
      position: 'top_left',
      header: 'Traffic',
      classes: 'default everyone',
      config: {
        ...
      }
    }
```

If you don’t want a header, then just omit it.

## Config

Option                              | Description
----------------------------------- | -----------
`apiKey`                            | **REQUIRED** API key from TomTom<br><br>**Type:** `string`
`origin`                            | **REQUIRED** The starting point for your commute. Usually this is your home address.<br><br>**Type:** `string`<br>An address (e.g. `65 Front St W, Toronto, ON M5J 1E6`) or `lat,lon` pair (e.g. `43.6462,-79.3810`).
`startTime`                         | The start time of the window during which this module wil be visible.<br><br>**Type:** `string`<br>Must be in 24-hour time format. Defaults to `00:00` (i.e.: midnight)
`endTime`                           | The end time of the window during which this module wil be visible.<br><br>**Type:** `string`<br>Must be in 24-hour time format. Defaults to `23:59` (i.e.: one minute before midnight).
`hideDays`                          | A list of numbers representing days of the week to hide the module.<br><br>**Type:** `array`<br>Valid numbers are 0 through 6, 0 = Sunday, 6 = Saturday.<br>e.g.: `[0,6]` hides the module on weekends.
`showSummary`                       | Whether to show a brief summary of the route<br><br>**Type:** `boolean`<br>Defaults to `true`
`showUpdated`                       | Show when the last update completed<br><br>**Type:** `boolean`<br>Default to `true`
`showUpdatedPosition`               | Position where to show last update completed. Valid options are `header` or `footer`.<br><br>**Type:** `string`<br>Default to `footer`
`colorCodeTravelTime`               | Whether to colour-code the travel time red, yellow, or green based on traffic.<br><br>**Type:** `boolean`<br>Defaults to `true`
`travelTimeFormat`                  | How the module should format your total travel time.<br><br>**Type:** `string`<br>Defaults to `m [min]` (e.g. 86 min). Some other examples are `h[h] m[m]` (e.g.: 1h 26min), `h:mm` (e.g. 1:26). This uses the `moment-duration-format` plugin's [templating feature](https://github.com/jsmreese/moment-duration-format#template).
`travelTimeFormatTrim`              | How to handle time tokens that have no value. For example, if you configure `travelTimeFormat` as `"hh:mm"` but the actual travel time is less than an hour, by default only the minute portion of the duration will be rendered. Set `travelTimeFormatTrim` to `false` to preserve the `hh:` portion of the format (e.g.: `00:21`). Valid options are `"left"`, `"right"` (e.g.: `2:00` renders as `2`), or `false` (e.g.: do not trim).<br><br>**Type:** `String` or `false`<br>Defaults to `"left"`.
`moderateTimeThreshold`             | The amount of variance between time in traffic vs absolute fastest time after which the time is coloured yellow<br><br>**Type:** `float`<br>Defaults to `1.1` (i.e.: 10% longer than fastest time)
`poorTimeThreshold`                 | The amount of variance between time in traffic vs absolute fastest time after which the time is coloured red<br><br>**Type:** `float`<br>Defaults to `1.3` (i.e.: 30% longer than fastest time)
`pollFrequency`                     | How frequently, in milliseconds, to poll for traffic predictions. Each entry in the destinations list requires its own routing request, so keep an eye on your daily TomTom quota if you lower this.<br><br>**Type:** `number`.<br>Defaults to `10 * 60 * 1000` (i.e.: 600000ms, or every 10 minutes)
`destinations`                     | An array of destinations to which you would like to see commute times.<br><br>**Type:** `array` of objects.<br>See below for destination options.
`showError`                        | Hides error message if false and renders the last result. This is meant to bypass short issues like a lost WiFi signal.<br><br>**Type:** `boolean`<br>Default to `true`

Each object in the `destinations` array can have the following parameters:

Option                       | Description
---------------------------- | -----------
`destination`                | **REQUIRED** The address (or `lat,lon`) of the destination<br><br>**Type:** `string`
`label`                      | **REQUIRED** How you would like this displayed on your MagicMirror.<br><br>**Type:** `string`
`mode`                       | Transportation mode, one of the following: `driving`, `walking`, `bicycling`.<br><br>**Type:** `string`<br>Defaults to `driving`.<br>**Note:** TomTom does not support public-transit routing; `transit` is no longer a valid mode.
`waypoints`                  | If specified, routes through the given intermediate points.<br><br>**Type:** `string`.<br>Separate multiple entries with the `\|` character. Each entry may be an address or `lat,lon` pair.
`avoid`                      | Instruct the routing engine to avoid one or more of: `tolls`, `highways`, `ferries`.<br><br>**Type:** `string`.<br>Separate multiple entries with the `\|` character (e.g.: `"avoid" : "highways\|tolls"`).
`alternatives`               | If `true`, request alternate routes (up to 2 extra). Must be used with `showSummary: true`.<br><br>**Type:** `boolean`
`color`                      | If specified, the colour for the icon in hexadecimal format (e.g.: `"#82BAE5"`)<br><br>**Type:** `string`<br>Defaults to white.
`startTime`                  | The start time of the window during which this destination wil be visible.<br><br>**Type:** `string`<br>Must be in 24-hour time format. Defaults to `00:00` (i.e.: midnight)
`endTime`                    | The end time of the window during which this destination wil be visible.<br><br>**Type:** `string`<br>Must be in 24-hour time format. Defaults to `23:59` (i.e.: one minute before midnight).
`hideDays`                   | A list of numbers representing days of the week to hide the destination.<br><br>**Type:** `array`<br>Valid numbers are 0 through 6, 0 = Sunday, 6 = Saturday.<br>e.g.: `[0,6]` hides the destination on weekends.
`origin`                     | Optionally overide the global origin for a single destination.

Here is an example of an entry in `config.js`

```JavaScript
{
  module: 'MMM-MyCommute',
  position: 'top_left',
  config: {
    apiKey: 'API_KEY_FROM_TOMTOM',
    origin: '65 Front St W, Toronto, ON M5J 1E6',
    startTime: '00:00',
    endTime: '23:59',
    hideDays: [0,6],
    destinations: [
      {
        destination: '14 Duncan St Toronto, ON M5H 3G8',
        label: 'Air Canada Centre',
        mode: 'walking',
        color: '#82E5AA'
      },
      {
        destination: '55 Mill St, Toronto, ON M5A 3C4',
        label: 'Distillery District',
        mode: 'bicycling'
      },
      {
        destination: '6301 Silver Dart Dr, Mississauga, ON L5P 1B2',
        label: 'Pearson Airport',
        avoid: 'tolls'
      }
    ]
  }
}
```

## Routes for calendar events

Additionally MMM-MyCommute can show travel times to upcoming events in the default calendar module. The config can be extended with the following options. Routes will be shown for events with a location.

Option              | Description
------------------- | -----------
`maxCalendarEvents` | Number of routes to show.<br><br>**Type:** `int`<br>Defaults to `0`
`maxCalendarTime`   | Show routes only for appointments within this timeframe (in milliseconds).<br><br>**Type:** `int`<br>Defaults to `24 * 60 * 60 * 1000` (1 day)
`calendarOptions`   | An array like the regular `destinations`. For each event all of these options are added as a route. All options from above can be used, except that `label` will be overwritten with the event subject and `destination` with the event location. `maxLabelLength` can be used to trim topics of appointments.<br><br>**Type:** `array`<br>Defaults to `[{mode: 'driving', maxLabelLength: 25}]`

Here is an example of an entry in `config.js` including calendar event routes

```JavaScript
{
  module: 'MMM-MyCommute',
  position: 'top_left',
  config: {
    apiKey: 'API_KEY_FROM_TOMTOM',
    origin: '65 Front St W, Toronto, ON M5J 1E6',
    destinations: [
      {
        destination: '14 Duncan St Toronto, ON M5H 3G8',
        label: 'Air Canada Centre',
        mode: 'walking',
        color: '#82E5AA'
      }
    ],
    // Additional config for calendar routes:
    maxCalendarEvents: 2,
    calendarOptions: [
      {
        mode: 'driving'
      },
      {
        mode: 'bicycling'
      }
    ]
  }
}
```

## Troubleshooting

If the module seems to malfunction or doesn't show any route information at all, here are some guidelines to help you fix it:

- Check the server side log of MagicMirror
- Check the client side log of your mirror
- Check the [known issues](https://github.com/poonasor/MMM-MyCommute/issues/)
- Create a new issue, including a clear description of your problem and the relevant server and client logs

## Dependencies

Installed during installation

- [request](https://www.npmjs.com/package/request)
- [moment](https://www.npmjs.com/package/moment)

## Special Thanks

- [Jeff Clarke](https://github.com/jclarke000) for creating MMM-MyCommute, this has inspired all my additional changes.
- [Michael Teeuw](https://github.com/MichMich) for creating the awesome [MagicMirror2](https://github.com/MichMich/MagicMirror/tree/develop) project that made this module possible.
- [Dominic Marx](https://github.com/domsen123) for creating the original mrx-work-traffic that this module heavily borrows upon.
