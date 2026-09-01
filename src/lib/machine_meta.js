/** Shared series metadata + slug mapping, used by /machines and /machines/[slug]. */

export const META = {
  'Spark Series':  { badge:'ENTRY',       cls:'badge-entry',      tagline:'Entry-Level Plasma Table',            intro:'Compact, affordable plasma tables for hobbyists, makers, and small shops. Touchscreen control, Wi-Fi, USB, and TF card support — no computer required during operation.',
    image: null,
    bestFor:'Hobbyists and makers cutting steel in a garage or small shop.' },
  'ION Series':    { badge:'MID-TIER',    cls:'badge-mid',        tagline:'Mid-Tier CNC Plasma Table',           intro:'Upgraded from the Spark with NEMA 23 motors, 20 mm timing belts, and a motorized Z-axis with floating touch-off for automatic material sensing and better cut consistency.',
    image: null,
    bestFor:'Shops wanting automatic material sensing and better cut consistency.' },
  'Prime Series':  { badge:'PRODUCTION',  cls:'badge-pro',        tagline:'Production-Grade Plasma Table',       intro:'Production-ready with integrated Torch Height Control (THC), rack-and-pinion drive on all axes, and travel speeds up to 800 IPM. Optional water table upgrade available.',
    image: null,
    bestFor:'Production shops cutting steel daily that need torch height control.' },
  'Ascent Series': { badge:'MID-RANGE',   cls:'badge-mid',        tagline:'Entry-Level CNC Router',              intro:'Runs on standard 110V household power — no industrial electrical service required. Welded steel base, aluminum extrusion gantry, FluidNC control. A real CNC platform, not a kit.',
    bestFor:'Shops without 220V service that need a real CNC platform on a standard household outlet.',
    image: null,
    keySpecs: [
      { label:'Frame',   value:'Welded steel base, aluminum gantry' },
      { label:'Drive',   value:'Straight-tooth rack & pinion (X/Y)' },
      { label:'Control', value:'FluidNC' },
      { label:'Power',   value:'110V single-phase' },
    ] },
  'Ridge Series':  { badge:'ENTRY',   cls:'badge-entry',        tagline:'Extrusion-Based CNC Router',          intro:'Rigid aluminum extrusion frame with rack-and-pinion drive and Centroid CNC12 control. X/Y resolution to 0.0005". Modular design supports future upgrades and custom configurations.',
    bestFor:'Serious hobbyists and small shops wanting a modular platform that can be upgraded over time.',
    image: null,
    keySpecs: [
      { label:'Frame',   value:'Aluminum extrusion' },
      { label:'Drive',   value:'Rack & pinion (X/Y)' },
      { label:'Control', value:'Centroid CNC12' },
      { label:'Power',   value:'220V single-phase' },
    ] },
  'Summit Series': { badge:'PRODUCTION',  cls:'badge-pro',        tagline:'Industrial Production CNC Router',    intro:'Fully welded steel frame, helical rack-and-pinion drive, full vacuum table, auto-lubrication, and Centroid CNC12. Built for cabinet shops and sign makers who need daily reliability.',
    bestFor:'Cabinet shops and sign makers running production work every day.',
    image: null,
    keySpecs: [
      { label:'Frame',   value:'Fully welded steel' },
      { label:'Drive',   value:'Helical rack & pinion (X/Y)' },
      { label:'Table',   value:'Full vacuum table' },
      { label:'Power',   value:'220V single-phase' },
    ] },
  'Summit ATC':    { badge:'PRODUCTION+', cls:'badge-pro',        tagline:'Summit with Automatic Tool Change',   intro:'The full Summit platform upgraded with a 6HP ATC spindle, 8-position linear tool rack, BT30/ER25 holders, and automatic tool length setter. Compressed air required for operation.',
    bestFor:'Production shops running multi-tool jobs that lose time to manual tool changes.',
    image: null,
    keySpecs: [
      { label:'Frame',   value:'Fully welded steel' },
      { label:'Spindle', value:'6 HP ATC, 24,000 RPM' },
      { label:'Control', value:'Centroid CNC12' },
      { label:'Power',   value:'220V single-phase + air' },
    ] },
  'Apex Series':   { badge:'INDUSTRIAL',  cls:'badge-industrial', tagline:'Industrial Production CNC Router',    intro:'1500W AC servo motors with closed-loop feedback, 12HP spindle, 1,200 IPM rapid speed, centralized auto-lubrication, and Centroid CNC12. The flagship router in the Elevate CNC lineup.',
    bestFor:'High-volume manufacturers where speed and uptime matter more than upfront cost.',
    image: null,
    keySpecs: [
      { label:'Frame',   value:'Fully welded steel' },
      { label:'Motors',  value:'1500W AC servo, closed loop' },
      { label:'Control', value:'Centroid CNC12' },
      { label:'Power',   value:'220V single-phase' },
    ] },
  'BoreLine':      { badge:'SPECIALTY',   cls:'badge-specialty',  tagline:'Double-Head Side Hole Drilling',      intro:'Purpose-built for production cabinet and furniture shops. Dual 3HP horizontal spindles, laser probe positioning, barcode scanning, and pneumatic material clamping. 110 in operating stroke.',
    image: null,
    bestFor:'Cabinet and furniture shops doing high-volume side drilling.' },
  'Summit Lathe':  { badge:'SPECIALTY',   cls:'badge-specialty',  tagline:'CNC Wood Lathe',                      intro:'One-piece cast iron bed with Taiwan Hiwin rails, TBI ballscrews, and a 7.4HP main motor. Optional lengths to 118 in. Designed for furniture makers, stair builders, and column shops.',
    image: null,
    bestFor:'Furniture makers, stair builders, and column shops.' },
  'CO2 Laser Series':   { badge:'ENTRY',      cls:'badge-entry', tagline:'CO2 Laser Cutter & Engraver',     intro:'Cuts and engraves wood, acrylic, leather, fabric, and other non-metals. A sealed CO2 tube system built for makers, sign shops, and small production runs that need clean edges without router setup.',
    bestFor:'Sign shops and makers cutting non-metals who want clean edges without router setup.',
    image: null,
    keySpecs: [
      { label:'Cuts',    value:'Wood, acrylic, leather, fabric' },
      { label:'Source',  value:'Sealed CO2 tube' },
      { label:'Control', value:'LightBurn-compatible' },
      { label:'Power',   value:'110V / 220V by size' },
    ] },
  'Fiber Laser Series': { badge:'PRODUCTION',  cls:'badge-pro',    tagline:'Fiber Laser Marking & Cutting',   intro:'Marks and cuts metal — mild steel, stainless, aluminum, and more — with a clean, fast, no-contact process. No consumables, no secondary finishing.',
    bestFor:'Metal fabricators and shops marking parts who need permanent results with no consumables.',
    image: null,
    keySpecs: [
      { label:'Cuts',    value:'Steel, stainless, aluminum, brass' },
      { label:'Source',  value:'Sealed fiber laser' },
      { label:'Control', value:'EZCad / Cypcut-compatible' },
      { label:'Power',   value:'110V marking / 220V cutting' },
    ] },
};

/** Router series get individual detail pages at /machines/{slug}. */
export const ROUTER_SLUGS = {
  'ridge': 'Ridge Series',
  'ascent': 'Ascent Series',
  'summit': 'Summit Series',
  'summit-atc': 'Summit ATC',
  'apex': 'Apex Series',
};

/** Laser series get individual detail pages at /machines/laser/{slug}. */
export const LASER_SLUGS = {
  'co2': 'CO2 Laser Series',
  'fiber': 'Fiber Laser Series',
};

export function slugForSeries(seriesName) {
  return Object.keys(ROUTER_SLUGS).find(slug => ROUTER_SLUGS[slug] === seriesName) || null;
}

export function laserSlugForSeries(seriesName) {
  return Object.keys(LASER_SLUGS).find(slug => LASER_SLUGS[slug] === seriesName) || null;
}
