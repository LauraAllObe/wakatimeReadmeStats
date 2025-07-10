export function parseHours(humanTime) {
  const [hrsStr, minsStr] = humanTime.split('hrs');
  const hours = parseFloat(hrsStr?.trim()) || 0;
  const minutes = parseFloat(minsStr?.replace('mins', '').trim()) || 0;
  return hours + minutes / 60;
}

export function safeFetchJson(url, headers = {}, timeout = 10000) {
  return Promise.race([
    fetch(url, { headers }).then(res => res.json()),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${url}`)), timeout))
  ]);
}
