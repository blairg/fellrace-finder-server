// @TODO: Refactor me. index.js from `pretty-ms` package.

const parseMs = (ms: any): any => {
  if (typeof ms !== 'number') {
    throw new TypeError('Expected a number');
  }

  const roundTowardZero = ms > 0 ? Math.floor : Math.ceil;

  return {
    days: roundTowardZero(ms / 86400000),
    hours: roundTowardZero(ms / 3600000) % 24,
    minutes: roundTowardZero(ms / 60000) % 60,
    seconds: roundTowardZero(ms / 1000) % 60,
    milliseconds: roundTowardZero(ms) % 1000,
  };
};

const pluralize = (word: string, count: number) =>
  count === 1 ? word : word + 's';

export function prettyMs(ms: number, opts: any): string {
  if (!Number.isFinite(ms)) {
    throw new TypeError('Expected a finite number');
  }

  opts = opts || {};

  if (ms < 1000) {
    const msDecimalDigits =
      typeof opts.msDecimalDigits === 'number' ? opts.msDecimalDigits : 0;
    return (
      (msDecimalDigits ? ms.toFixed(msDecimalDigits) : Math.ceil(ms)) +
      (opts.verbose ? ' ' + pluralize('millisecond', Math.ceil(ms)) : 'ms')
    );
  }

  const ret = new Array();

  const add = (val: number, long: string, short: string, valStr: any) => {
    if (val === 0) {
      return;
    }

    const postfix = opts.verbose ? ' ' + pluralize(long, val) : short;

    ret.push((valStr || val) + postfix);
  };

  const parsed = parseMs(ms);

  add(Math.trunc(parsed.days / 365), 'year', 'y', null);
  add(parsed.days % 365, 'day', 'd', null);
  add(parsed.hours, 'hour', 'h', null);
  add(parsed.minutes, 'minute', 'm', null);

  if (opts.compact) {
    add(parsed.seconds, 'second', 's', null);

    return '~' + ret[0];
  }

  const sec = (ms / 1000) % 60;
  const secDecimalDigits =
    typeof opts.secDecimalDigits === 'number' ? opts.secDecimalDigits : 1;
  const secFixed = sec.toFixed(secDecimalDigits);
  const secStr = opts.keepDecimalsOnWholeSeconds
    ? secFixed
    : secFixed.replace(/\.0+$/, '');
  add(sec, 'second', 's', secStr);

  return ret.join(' ');
}

export function getMonthName(dateTime: any): string {
  const monthList = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return monthList[dateTime.getMonth()];
}
