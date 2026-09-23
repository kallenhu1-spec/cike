// Original vector scenes extend our paper creature; no reference artwork is copied.
const fs = require("node:fs"),
  path = require("node:path");
const out = path.join(__dirname, "../assets/scenes");
fs.mkdirSync(out, { recursive: true });
const character = fs
  .readFileSync(path.join(__dirname, "../assets/creature.svg"), "utf8")
  .replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");
const stroke =
  'stroke="#796f5e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
const pet = (x, y, scale = 0.92, rotation = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rotation} 110 110) scale(${scale})">${character}</g>`;
const plant = (x, y) =>
  `<g transform="translate(${x} ${y})" ${stroke}><path d="M7 61L13 100Q35 108 54 100L60 61Z" fill="#e9cab8"/><path d="M33 61V11M33 39Q5 38 4 16Q28 10 33 39M33 27Q39 0 66 2Q69 27 33 27" fill="#aeba96"/><path d="M18 70L22 92M28 71L30 96" stroke="#f9e6d5"/></g>`;
const windowArt = (night = false) =>
  `<g ${stroke}><path d="M45 33Q44 25 56 24L209 24Q218 24 218 35L218 165L45 165Z" fill="${night ? "#bdc6cc" : "#dae8e7"}"/><path d="M131 25V165M46 96H217" stroke="#faf5e9" stroke-width="8"/><path d="M35 167H229" stroke-width="8" stroke="#d8c6a8"/>${night ? '<path d="M186 49Q164 63 184 83Q154 84 153 65Q153 47 186 49Z" fill="#fff3c3" stroke="none"/>' : '<circle cx="183" cy="57" r="19" fill="#f1d799" stroke="none"/><path d="M57 131Q83 105 100 137Q112 119 129 140L129 160H57Z" fill="#becfac" stroke="none"/><path d="M137 145Q166 119 187 145Q208 123 215 144V160H137Z" fill="#b2c7a2" stroke="none"/>'}</g>`;
const desk = `<g ${stroke}><path d="M105 240Q102 234 112 231H490Q501 235 492 245H109Z" fill="#e8d3b2"/><path d="M137 246L132 281M465 246L469 281" stroke="#ae9474" stroke-width="6"/></g>`;
const cup = (x, y) =>
  `<g transform="translate(${x} ${y})" ${stroke}><path d="M4 7Q29 0 52 7L49 49Q28 60 8 49Z" fill="#d6e3d8"/><path d="M52 13Q78 11 69 34Q64 44 51 39" fill="none"/><ellipse cx="28" cy="8" rx="23" ry="6" fill="#f9f3df"/><path d="M24 24Q20 17 16 24Q14 31 28 36Q43 23 36 21Q31 19 28 26" fill="#b1c29a" stroke="none"/></g>`;
const notebook = `<g ${stroke}><path d="M218 221L286 213L332 223L323 255L284 246L221 254Z" fill="#fffaf0"/><path d="M286 215L284 245M237 231L269 227M236 240L263 236M297 230L317 234" stroke="#bdb29f" stroke-width="2"/><path d="M332 213L373 175" stroke="#c7a675" stroke-width="7"/><path d="M327 220L332 213" stroke-width="3"/></g>`;
const base = (inner, tone = "#f5ead5") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320"><path d="M56 77Q72 23 162 31Q234 4 332 27Q446 7 522 64Q570 115 538 211Q555 274 463 283Q376 310 279 288Q125 312 68 259Q15 210 56 77Z" fill="${tone}"/><ellipse cx="307" cy="278" rx="213" ry="16" fill="#766b50" opacity=".055"/>${inner}<g stroke="#b8bc91" stroke-width="2.5" stroke-linecap="round"><path d="M543 122V137M536 130H550M37 206V216M32 211H42"/></g></svg>`;
const art = {
  water: base(
    windowArt() +
      pet(215, 56) +
      desk +
      cup(304, 181) +
      plant(463, 144) +
      `<g ${stroke}><path d="M294 192Q305 181 315 199M365 199Q377 182 388 186" fill="none"/><path d="M180 211L197 212" stroke="#d5b9aa" stroke-width="9"/></g>`,
  ),
  window: base(
    windowArt() +
      pet(265, 80, 0.95, -6) +
      plant(77, 172) +
      `<g ${stroke}><path d="M268 165Q246 144 230 152" fill="none"/><path d="M231 151L241 145M231 151L242 157"/><path d="M458 218Q481 211 492 221" fill="none" stroke="#d6bdb0"/></g>`,
    "#edf0df",
  ),
  desk: base(
    pet(220, 43) +
      desk +
      `<g ${stroke}><path d="M103 223L123 203L192 208L181 226Z" fill="#f5ead1"/><path d="M112 208L181 213M133 217L164 220" stroke="#c3b9a7"/><path d="M369 219H440V230H367Z" fill="#c8d4b9"/><path d="M379 204H443V216H379Z" fill="#e7c4b5"/><path d="M389 190H437V202H389Z" fill="#eae1cb"/><path d="M342 208Q359 198 368 210" fill="none"/><path d="M490 186Q485 178 483 165" fill="none"/><path d="M485 170L471 169"/></g>` +
      plant(74, 104),
  ),
  note: base(
    windowArt() +
      pet(210, 44) +
      desk +
      notebook +
      cup(419, 179) +
      `<g ${stroke}><path d="M360 177Q374 163 381 178" fill="none"/><path d="M476 56L480 66L491 67L482 73L484 84L475 78L466 83L469 72L461 65L472 65Z" fill="#e7d4a7" stroke="none"/></g>`,
  ),
  meal: base(
    pet(214, 38) +
      desk +
      `<g ${stroke}><ellipse cx="320" cy="226" rx="66" ry="15" fill="#e9d5c4"/><path d="M265 211Q267 241 318 240Q366 241 375 211Z" fill="#f5e8d4"/><ellipse cx="320" cy="211" rx="55" ry="13" fill="#dce1bc"/><path d="M289 207Q302 190 316 208Q321 196 340 205" fill="#f4d68c"/><path d="M283 210L303 208M336 214L355 210" stroke="#98aa7d"/><path d="M381 187L413 214M389 184L420 210" stroke="#b49973"/><path d="M153 190H197L194 225H157Z" fill="#e4d5bc"/><path d="M155 193Q168 177 177 184Q189 176 197 193" fill="#faf0d5"/></g>` +
      cup(440, 167),
    "#f7e9d7",
  ),
  stretch: base(
    windowArt() +
      pet(241, 84) +
      `<g ${stroke}><path d="M284 194Q253 159 242 119M403 193Q434 161 432 120" fill="none" stroke-width="5"/><path d="M234 116L241 105M439 117L446 109M218 131L211 126M454 132L463 128" stroke="#c8b992"/><path d="M235 280Q346 298 438 277" fill="none" stroke="#c2cba7" stroke-width="9"/></g>`,
    "#edf0df",
  ),
  lamp: base(
    windowArt() +
      pet(230, 71) +
      desk +
      `<path d="M448 117L384 237H543L487 117Z" fill="#f9e7b2" opacity=".55"/><g ${stroke}><path d="M466 119V225M444 229H491" fill="none" stroke-width="5"/><path d="M445 65H484L504 121H424Z" fill="#efd79d"/><path d="M165 218L219 213L227 230L175 234Z" fill="#bccdb7"/><path d="M178 219L214 217" stroke="#f5efd9" stroke-width="4"/></g>`,
    "#e8e8dc",
  ),
  music: base(
    pet(212, 67) +
      `<g ${stroke}><path d="M252 139Q253 72 315 79Q382 78 385 145" fill="none" stroke="#a9b997" stroke-width="13"/><path d="M252 133V165M385 135V166" stroke="#c8d3b5" stroke-width="19"/><rect x="410" y="190" width="58" height="79" rx="10" fill="#ddd5be"/><circle cx="439" cy="240" r="13" fill="#f8f3e6"/><path d="M420 207H454" stroke="#9dab8b"/><path d="M152 118V89L175 83V111" fill="none"/><ellipse cx="145" cy="120" rx="8" ry="5" fill="#a6b396"/><ellipse cx="169" cy="114" rx="8" ry="5" fill="#a6b396"/><path d="M460 90V61L481 55" fill="none"/><ellipse cx="452" cy="92" rx="8" ry="5" fill="#e2c2ad"/></g>` +
      plant(75, 161),
    "#f2e8dc",
  ),
};
for (const [name, svg] of Object.entries(art)) {
  fs.writeFileSync(path.join(out, name + ".svg"), svg);
  const night = svg
    .replace(windowArt(), windowArt(true))
    .replace(/fill="#(?:f5ead5|edf0df|f7e9d7|f2e8dc)"/g, 'fill="#e8e8dc"');
  fs.writeFileSync(path.join(out, name + "-night.svg"), night);
}
console.log("Wrote " + Object.keys(art).length + " original action scenes.");
