import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";
import customParseFormat from "dayjs/plugin/customParseFormat";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import weekOfYear from "dayjs/plugin/weekOfYear";
import localeData from "dayjs/plugin/localeData";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.extend(duration);
dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(weekOfYear);
dayjs.extend(localeData);

// Add .toArray() instance method — moment returns [Y, M, D, h, m, s, ms] (month 0-indexed)
dayjs.extend((_, cls) => {
	cls.prototype.toArray = function () {
		return [
			this.year(),
			this.month(),
			this.date(),
			this.hour(),
			this.minute(),
			this.second(),
			this.millisecond(),
		];
	};
});

// Shims for moment-specific static APIs used in frappe

// moment.weekdays() → ["Sunday", "Monday", ..., "Saturday"]
dayjs.weekdays = function () {
	return Array.from({ length: 7 }, (_, i) =>
		new Intl.DateTimeFormat("en", { weekday: "long" }).format(
			new Date(2021, 0, 3 + i) // Jan 3 2021 is a Sunday
		)
	);
};

// moment.locale(name) — no-op; frappe only calls with 'en'
dayjs.locale = function () {
	return dayjs;
};

// moment.updateLocale(name, config) — used to set first day of week
dayjs.updateLocale = function (_name, config) {
	if (config?.week?.dow !== undefined) {
		dayjs._weekStart = config.week.dow;
	}
};

// moment.defaultFormat — frappe assigns to this; dayjs ignores it
dayjs.defaultFormat = "";

// moment.user_utc_offset — custom property set in desk.js after boot
dayjs.user_utc_offset = null;

// moment.tz.add() pre-loads moment-timezone data; dayjs uses Intl (no-op)
const _original_tz = dayjs.tz;
// moment.tz(timezone) with a single timezone-name arg → current time in that tz
dayjs.tz = function (dateOrTz, formatOrTz, maybeTz) {
	if (arguments.length === 1 && typeof dateOrTz === "string" && !dateOrTz.match(/^\d/)) {
		// Called as moment.tz("America/New_York") — current time in timezone
		return dayjs().tz(dateOrTz);
	}
	return _original_tz(dateOrTz, formatOrTz, maybeTz);
};
// copy static properties from original (like .guess(), .names()) onto the wrapper
Object.assign(dayjs.tz, _original_tz);
dayjs.tz.add = function () {};

window.moment = dayjs;
