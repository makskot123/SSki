// Runs before first paint so the saved/system theme is applied without a flash.
// Until the visitor picks a theme with the toggle, it follows the system setting, also when that changes.
const script = `(function(){var m=window.matchMedia("(prefers-color-scheme: dark)");function saved(){try{var t=localStorage.getItem("theme");return t==="light"||t==="dark"?t:null}catch(e){return null}}function apply(){document.documentElement.dataset.theme=saved()||(m.matches?"dark":"light")}apply();m.addEventListener("change",function(){if(!saved())apply()})})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
