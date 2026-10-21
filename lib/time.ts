export const TOMOCA_TIME_ZONE='Africa/Addis_Ababa';
export function addisDay(now=Date.now()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:TOMOCA_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
}
export function nextAddisMidnight(now=Date.now()){
  // Addis Ababa is UTC+03 year-round. Midnight EAT is 21:00 UTC on the previous UTC date.
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TOMOCA_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
  const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day)+1,0,0,0)-3*60*60*1000;
}
