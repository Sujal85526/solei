/**
 * Inline <head> script (root layout). Runs while the HTML is parsed — before first paint and before
 * hydration — so the intro loader never flashes in late and never waits for JavaScript bundles.
 *
 * - On every full load of the homepage, sets `data-intro` on <html>; CSS then shows the loader and
 *   delays the hero entrance (see globals.css "Intro loader"). Removed once everything settled, so
 *   a client-side navigation back to "/" does not replay it.
 * - Skipped entirely for prefers-reduced-motion.
 */
export const motionScript = `(function(){try{
var d=document.documentElement,p=location.pathname;
if(p.indexOf("/admin")===0||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
if(p==="/"){d.setAttribute("data-intro","");setTimeout(function(){d.removeAttribute("data-intro")},3600)}
}catch(e){}})()`;
