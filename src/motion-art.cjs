// One shared character master, independent props, and a finite action timeline.
// Static and animated renders use the same layout. Only authored local SVG is returned.
const design = require("./appearance.js");
const { definitions } = require("./motions.js");
module.exports = function motionArt(input) {
  const def = definitions[input.motionId];
  if (
    !def ||
    typeof input.night !== "boolean" ||
    typeof input.animate !== "boolean"
  )
    throw Error("动作参数无效");
  const a = design.validate(input.appearance),
    animate = input.animate,
    id = def.id,
    duration = `${def.durationMs / 1000}s`;
  const line =
    'stroke="#796f5e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  function timing(values) {
    const count = values.length;
    const keyTimes = Array.from({ length: count }, (_, i) =>
      (i / (count - 1)).toFixed(4).replace(/0+$/, "").replace(/\.$/, ""),
    ).join(";");
    const keySplines = Array.from(
      { length: count - 1 },
      () => "0.22 1 0.36 1",
    ).join(";");
    return `keyTimes="${keyTimes}" calcMode="spline" keySplines="${keySplines}" dur="${duration}"`;
  }
  function transform(content, type, values) {
    const last = values.at(-1);
    return `<g transform="${type}(${animate ? values[0] : last})">${animate ? `<animateTransform attributeName="transform" type="${type}" values="${values.join(";")}" ${timing(values)} repeatCount="1" fill="freeze"/>` : ""}${content}</g>`;
  }
  const move = (s, values) => transform(s, "translate", values);
  const rotate = (s, values) => transform(s, "rotate", values);
  function fade(s, values) {
    return `<g opacity="${animate ? values[0] : values.at(-1)}">${animate ? `<animate attributeName="opacity" values="${values.join(";")}" ${timing(values)} repeatCount="1" fill="freeze"/>` : ""}${s}</g>`;
  }
  const hand = (x, y) =>
    `<ellipse cx="${x}" cy="${y}" rx="11" ry="8" fill="${a.skinColor}" ${line}/>`;
  const mug = (x, y) =>
    `<g transform="translate(${x} ${y})" ${line}><path d="M0 0H43L41 39Q23 48 3 39Z" fill="#c8d8bf"/><path d="M43 7Q65 4 60 25Q57 34 43 30" fill="none"/><ellipse cx="22" cy="1" rx="21" ry="5" fill="#f8f0d9"/><path d="M15 16Q20 10 23 18Q32 8 34 19Q33 25 24 29Q11 21 15 16" fill="#97ac83" stroke="none"/></g>`;
  const book = (closed = false) =>
    `<g ${line}>${closed ? '<rect x="284" y="207" width="101" height="28" rx="5" fill="#bbcba5"/><path d="M291 225H379" stroke="#fff9e8" stroke-width="5"/>' : '<path d="M265 208Q295 195 325 207Q356 195 387 209L381 237Q352 226 325 238Q295 226 270 237Z" fill="#fffaf0"/><path d="M325 208V235M280 214L310 215M340 213L372 215M340 222L369 224" stroke="#b4aa94" stroke-width="2"/>'}</g>`;
  const laptop = `<g ${line}><rect x="271" y="155" width="129" height="78" rx="7" fill="#c3cfbd"/><rect x="280" y="163" width="111" height="57" rx="3" fill="#f7f4e8"/><path d="M258 238H413L400 226H271Z" fill="#d5d9cb"/></g>`;
  const smallThing = `<g ${line}><rect x="340" y="199" width="35" height="25" rx="5" fill="#e3bda7"/><path d="M349 206H366M349 214H361" stroke="#f9eddd"/></g>`;
  const player = `<g ${line}><rect x="288" y="188" width="92" height="50" rx="10" fill="#d5ceb9"/><circle cx="310" cy="211" r="12" fill="#fff8e8"/><path d="M306 205L317 211L306 217Z" fill="#a7b78d"/><path d="M337 205H368" stroke="#a7b78d" stroke-width="5"/></g>`;
  const plant = `<g ${line}><path d="M426 211H485L479 251Q457 258 432 250Z" fill="#e3bea8"/><path d="M455 213V144M455 178Q418 176 419 150Q449 145 455 178M455 166Q462 139 491 144Q490 168 455 166" fill="#adbf92"/></g>`;
  const sink = `<g ${line}><path d="M246 217H421L406 252H264Z" fill="#c9ddda"/><path d="M378 211V172Q378 159 360 161L349 163" fill="none" stroke-width="8"/></g>`;
  let actor = design
    .inner(a)
    .replace(
      '<path d="M51 126Q36 116 34 129M180 128Q195 117 195 130" fill="none"/>',
      "",
    );
  actor = `<g transform="translate(212 38) scale(.95)">${actor}</g>`;
  let props = "",
    backgroundExtra = "",
    foreground = "",
    desk = true;
  if (id === "sip") {
    actor = rotate(move(actor, ["0 0", "0 0", "0 -2", "0 -4", "0 -2", "0 0", "0 0"]), [
      "0 315 205", "0 315 205", "-2 315 205", "-4 315 205", "-2 315 205", "0 315 205", "0 315 205",
    ]);
    props = move(
      rotate(mug(300, 193) + hand(296, 215) + hand(346, 215), [
        "0 323 215", "0 323 215", "-7 323 215", "-12 323 215", "-7 323 215", "0 323 215", "0 323 215",
      ]),
      ["0 0", "0 -8", "0 -38", "0 -45", "0 -38", "0 -8", "0 0"],
    );
  } else if (id === "pour-water") {
    props =
      mug(300, 197) +
      rotate(
        `<g ${line}><path d="M384 139H423V182Q399 190 385 182Z" fill="#dbe5df"/><path d="M385 146L375 153L386 159" fill="#dbe5df"/></g>` +
          hand(428, 167),
        ["0 390 170", "-25 390 170", "-25 390 170", "0 390 170"],
      ) +
      fade(
        '<path d="M376 163Q352 163 321 199" fill="none" stroke="#8fbec8" stroke-width="5"/>',
        [0, 1, 1, 0],
      );
  } else if (id === "rinse-cup" || id === "rinse-dish") {
    props =
      sink +
      move(
        id === "rinse-cup"
          ? mug(301, 204) + hand(298, 222)
          : `<ellipse cx="328" cy="230" rx="37" ry="14" fill="#fff8e8" ${line}/>` +
              hand(295, 228),
        ["-12 0", "8 0", "-6 0", "0 0"],
      ) +
      fade(
        '<path d="M350 171V222M357 176V220" stroke="#8ebfc5" stroke-width="4" stroke-linecap="round"/>',
        [0, 1, 1, 0],
      );
  } else if (id === "place-cup") {
    props =
      '<ellipse cx="379" cy="239" rx="29" ry="7" fill="#dfc8ac"/>' +
      move(mug(356, 196) + hand(352, 216), [
        "-58 -20",
        "-25 -16",
        "0 0",
        "0 0",
      ]);
  } else if (id === "open-curtain") {
    desk = false;
    backgroundExtra = move(
      '<path d="M50 28H155V165Q123 147 92 164Q70 153 50 166Z" fill="#e9c9b5" stroke="#bda88d" stroke-width="3"/>',
      ["0 0", "-22 0", "-67 0", "-67 0"],
    );
    props = move(hand(253, 172), ["0 0", "-22 -6", "-50 -8", "-50 -8"]);
  } else if (id === "look-outside") {
    desk = false;
    actor = rotate(actor, [
      "0 315 205",
      "-8 315 205",
      "-8 315 205",
      "0 315 205",
    ]);
    props = fade(
      '<path d="M266 154L235 147M265 169L233 175" stroke="#adb68b" stroke-width="3" stroke-linecap="round"/>',
      [0, 0.9, 0.9, 0],
    );
  } else if (id === "inspect-leaf" || id === "wipe-leaf") {
    desk = false;
    props = plant;
    actor = rotate(actor, ["0 316 208", "8 316 208", "8 316 208", "0 316 208"]);
    props +=
      id === "wipe-leaf"
        ? move(
            `<path d="M421 158L451 169L441 198L411 187Z" fill="#f4f0d9" ${line}/>` +
              hand(416, 190),
            ["0 0", "14 -8", "-3 4", "0 0"],
          )
        : move(hand(418, 188), ["-20 8", "0 -13", "0 -13", "-20 8"]);
  } else if (id === "clear-item") {
    props = move(smallThing + hand(342, 211), [
      "0 0",
      "35 -19",
      "83 0",
      "83 0",
    ]);
  } else if (id === "store-pen") {
    props =
      `<path d="M415 184H452L447 235H420Z" fill="#d8c4ab" ${line}/>` +
      rotate(
        `<path d="M391 177L435 209" stroke="#b28c64" stroke-width="6" stroke-linecap="round"/>` +
          hand(414, 194),
        ["0 435 209", "48 435 209", "55 435 209", "55 435 209"],
      );
  } else if (id === "move-phone") {
    props = move(
      `<g ${line}><rect x="335" y="192" width="40" height="58" rx="7" fill="#cabda8"/><path d="M349 198H360"/></g>` +
        hand(330, 215),
      ["-40 -24", "10 -30", "85 -8", "85 -8"],
    );
  } else if (id === "tidy-cable") {
    props =
      `<g ${line}><path d="${animate ? "M285 217Q307 181 330 222T402 207" : "M310 220Q333 214 349 220T393 218"}" fill="none" stroke="#b5c29f" stroke-width="6">${animate ? '<animate attributeName="d" values="M285 217Q307 181 330 222T402 207;M294 219Q314 205 333 223T394 218;M310 220Q333 214 349 220T393 218;M310 220Q333 214 349 220T393 218" keyTimes="0;.28;.62;1" dur="3.2s" repeatCount="1" fill="freeze"/>' : ""}</path></g>` +
      move(hand(310, 215), ["-20 -15", "0 -10", "30 0", "30 0"]);
  } else if (id === "stack-paper") {
    props =
      `<path d="M316 216H390V238H316Z" fill="#fffaf0" ${line}/>` +
      move(
        `<path d="M310 210H384V230H310Z" fill="#f4e7c9" ${line}/>` +
          hand(310, 217),
        ["-75 -16", "-34 -28", "6 0", "6 0"],
      );
  } else if (id === "throw-away") {
    props =
      `<path d="M433 213H478L474 266H438Z" fill="#d4d6be" ${line}/>` +
      move(
        `<path d="M292 205L309 199L321 207L317 224L302 220Z" fill="#e7c7b3" ${line}/>` +
          hand(286, 213),
        ["0 0", "60 -30", "140 -2", "140 -2"],
      );
  } else if (id === "wipe-desk") {
    props = move(
      `<path d="M293 219L337 216L347 234L300 237Z" fill="#e4c3ac" ${line}/>` +
        hand(316, 215),
      ["-30 0", "20 0", "-10 0", "-10 0"],
    );
  } else if (id === "write-note" || id === "mark-page") {
    props =
      book() +
      move(
        `<path d="M333 218L366 171" stroke="#b69260" stroke-width="6" stroke-linecap="round"/>` +
          hand(354, 186),
        ["0 0", "6 -2", "17 2", "17 2"],
      ) +
      fade(
        `<path d="M283 224H309${id === "write-note" ? "M339 226H362" : ""}" stroke="#a5ae88" stroke-width="2.5"/>`,
        [0, 0.3, 1, 1],
      );
  } else if (id === "close-book") {
    props =
      book(true) +
      `<g transform="translate(0 236)">${transform(`<g transform="translate(0 -236)">${book()}</g>`, "scale", ["1 1", "1 .6", "1 .02", "1 .02"])}</g>` +
      move(hand(313, 206), ["-14 -21", "0 -10", "18 6", "18 6"]);
  } else if (id === "read-book") {
    props =
      book() +
      rotate(hand(281, 221), [
        "0 325 220",
        "-22 325 220",
        "0 325 220",
        "0 325 220",
      ]);
    foreground = fade(
      '<path d="M326 209Q348 179 370 208L351 228Z" fill="#fffaf0" stroke="#bfb5a0" stroke-width="2"/>',
      [0, 1, 0.4, 0],
    );
  } else if (
    ["type-text", "save-file", "close-tab", "screen-dim"].includes(id)
  ) {
    props = laptop;
    props += move(hand(293, 232), ["0 0", "0 -6", "5 -2", "0 0"]);
    if (id === "type-text")
      props += fade(
        '<path d="M292 177H365M292 186H354M292 195H375" stroke="#a2ad8d" stroke-width="3"/>',
        [0, 0.3, 1, 1],
      );
    if (id === "save-file")
      props += fade(
        '<path d="M319 189L330 200L350 179" stroke="#83976e" stroke-width="5" fill="none"/>',
        [0, 0, 1, 1],
      );
    if (id === "close-tab")
      props += fade(
        `<rect x="287" y="169" width="83" height="43" rx="3" fill="#e2c9b8" ${line}/><path d="M354 175L363 184M363 175L354 184" ${line}/>`,
        [1, 1, 0, 0],
      );
    if (id === "screen-dim")
      props += fade(
        '<rect x="280" y="163" width="111" height="57" rx="3" fill="#525c50"/>',
        [0, 0.05, 0.25, 0.25],
      );
  } else if (id === "prepare-meal" || id === "taste-food") {
    props = `<g ${line}><ellipse cx="331" cy="234" rx="56" ry="12" fill="#e5cbb6"/><path d="M284 214H377Q375 242 331 244Q289 239 284 214Z" fill="#f7e6cb"/><ellipse cx="331" cy="214" rx="46" ry="10" fill="#d5dcad"/></g>`;
    props +=
      id === "prepare-meal"
        ? move(
            `<path d="M391 196V234M399 196V234" stroke="#ad8c64" stroke-width="4"/>` +
              hand(394, 199),
            ["-45 -24", "-18 -17", "0 0", "0 0"],
          )
        : move(
            `<path d="M350 211L386 189" stroke="#b79463" stroke-width="5"/><ellipse cx="348" cy="211" rx="11" ry="6" fill="#e9c989" ${line}/>` +
              hand(380, 193),
            ["0 0", "-29 -46", "-29 -46", "0 0"],
          );
  } else if (
    ["play-song", "lower-volume", "stop-music", "put-headphones"].includes(id)
  ) {
    props = player + move(hand(381, 211), ["10 -11", "-8 0", "-8 0", "10 -11"]);
    if (id === "play-song")
      props += fade(
        '<path d="M424 140V116L445 110V134" stroke="#8f9d75" stroke-width="4" fill="none"/><ellipse cx="417" cy="143" rx="8" ry="5" fill="#a4b68c"/><ellipse cx="439" cy="136" rx="8" ry="5" fill="#a4b68c"/>',
        [0, 1, 1, 0],
      );
    if (id === "lower-volume")
      props += move('<circle cx="365" cy="205" r="5" fill="#798b67"/>', [
        "0 0",
        "-9 0",
        "-20 0",
        "-20 0",
      ]);
    if (id === "stop-music")
      props += fade(
        '<rect x="304" y="205" width="11" height="12" rx="1" fill="#ad8a72"/>',
        [0, 0.4, 1, 1],
      );
    if (id === "put-headphones")
      props += move(
        `<g ${line}><path d="M410 216Q410 167 447 169Q481 171 480 217" stroke="#9aa981" stroke-width="7" fill="none"/><path d="M411 208V225M479 208V225" stroke="#c7d1b2" stroke-width="14"/></g>`,
        ["-70 -40", "-30 -20", "0 0", "0 0"],
      );
  } else if (["relax-hands", "shrug", "sit-back"].includes(id)) {
    desk = false;
    backgroundExtra =
      '<path d="M255 185V267H397V182" stroke="#d1bc9b" stroke-width="10" fill="none"/><path d="M267 252V283M387 252V283" stroke="#af9876" stroke-width="5"/>';
    if (id === "sit-back") {
      actor = rotate(actor, [
        "0 325 210",
        "7 325 210",
        "7 325 210",
        "7 325 210",
      ]);
      props = hand(275, 205) + hand(379, 205);
    } else {
      props =
        move(hand(268, 195), ["0 0", "-15 -24", "-15 -24", "0 0"]) +
        move(hand(383, 195), ["0 0", "15 -24", "15 -24", "0 0"]);
      if (id === "shrug") actor = move(actor, ["0 0", "0 -9", "0 -9", "0 0"]);
      else
        props += fade(
          '<path d="M243 164L232 153M238 174H224M408 163L419 151M413 173H428" stroke="#b6bc93" stroke-width="3"/>',
          [0, 1, 1, 0],
        );
    }
  } else if (id === "dim-lamp" || id === "switch-light") {
    props =
      `<g ${line}><path d="M464 128V237M438 238H489" stroke-width="5"/><path d="M442 76H483L503 134H423Z" fill="#efd99f"/></g>` +
      move(hand(411, 215), ["-22 -6", "20 0", "20 0", "-22 -6"]);
    backgroundExtra = fade(
      '<path d="M430 131L385 254H549L495 131Z" fill="#f9d980"/>',
      [
        0.65,
        0.55,
        id === "switch-light" ? 0 : 0.22,
        id === "switch-light" ? 0 : 0.22,
      ],
    );
  }
  const window = `<g ${line}><rect x="49" y="30" width="159" height="133" rx="8" fill="${input.night ? "#b9c4cb" : "#dbe8e6"}"/><path d="M128 32V162M51 99H208" stroke="#faf5e9" stroke-width="7"/><path d="M41 166H219" stroke="#d6c4a5" stroke-width="8"/>${input.night ? '<path d="M182 52Q162 66 184 79Q152 83 154 64Q155 49 182 52Z" fill="#fff1bd" stroke="none"/>' : '<circle cx="177" cy="59" r="17" fill="#edd49b" stroke="none"/>'}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320" data-instance="${Number.isInteger(input.instance) ? input.instance : 0}"><title>${def.label}</title><path d="M56 77Q72 23 162 31Q234 4 332 27Q446 7 522 64Q570 115 538 211Q555 274 463 283Q376 310 279 288Q125 312 68 259Q15 210 56 77Z" fill="${input.night ? "#e8e8dc" : "#f5ead5"}"/>${window}${backgroundExtra}${actor}${desk ? `<g ${line}><path d="M109 246H500L492 257H109Z" fill="#e5d0ad"/><path d="M139 259V284M467 259V284" stroke-width="5"/></g>` : ""}${props}${foreground}</svg>`;
};
