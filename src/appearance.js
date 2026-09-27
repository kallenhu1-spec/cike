// Shared, deterministic vector design. No generated code or remote content.
(function (root) {
  const defaults = () => ({
    shape: "paper",
    face: 0,
    eyes: 0,
    expression: "smile",
    skinColor: "#fff9e8", leafColor: "#b7c5a0", pattern: "none", patternColor: "#b5bfa3",
    patternSize: 1, patternDensity: 1, outfit: "none", outfitColor: "#a9bdc5",
  });
  const presets = {
    paper: { ...defaults() },
    round: { ...defaults(), shape: "round", face: 2, eyes: 1, expression: "smile" },
    bean: { ...defaults(), shape: "bean", face: 1, eyes: 0, expression: "sleepy" },
  };
  function validate(a) {
    if (
      !a ||
      !["paper", "round", "bean"].includes(a.shape) ||
      !Number.isInteger(a.face) ||
      a.face < -2 ||
      a.face > 2 ||
      !Number.isInteger(a.eyes) ||
      a.eyes < 0 ||
      a.eyes > 2 ||
      !["smile", "happy", "sleepy"].includes(a.expression)
    )
      throw Error("形象参数无效");
    const extra = {};
    for (const key of ["skinColor", "leafColor", "patternColor", "outfitColor"]) {
      extra[key] = a[key] === undefined ? defaults()[key] : a[key];
      if (typeof extra[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(extra[key])) throw Error("颜色参数无效");
      extra[key] = extra[key].toLowerCase();
    }
    for (const [key, values] of Object.entries({pattern: ["none", "dots", "stripes", "flowers"], outfit: ["none", "overalls", "sweater", "apron", "pajamas"], patternSize: [0, 1, 2], patternDensity: [0, 1, 2]})) {
      extra[key] = a[key] === undefined ? defaults()[key] : a[key];
      if (!values.includes(extra[key])) throw Error("皮肤或衣服参数无效");
    }
    return {
      shape: a.shape,
      face: a.face,
      eyes: a.eyes,
      expression: a.expression,
      ...extra,
    };
  }
  function isOriginal(a) {
    return JSON.stringify(validate(a)) === JSON.stringify(validate(defaults()));
  }
  function inner(input) {
    const a = validate(input),
      y = (a.outfit === "none" ? 111 : 89) + a.face * 5,
      eye = 3 + a.eyes * 0.8;
    const bodies = {
      paper:
        "M56 155C30 136 42 100 52 84C43 62 58 39 82 44C93 24 121 25 135 42C167 33 189 53 181 82C203 111 193 148 170 159C153 179 74 183 56 155Z",
      round:
        "M38 123C37 75 64 34 110 34C158 34 187 77 186 123C185 158 164 178 111 178C61 178 39 160 38 123Z",
      bean: "M32 132C30 100 52 68 89 72C98 37 129 36 151 60C181 73 197 106 191 139C188 169 156 181 109 178C59 184 32 164 32 132Z",
    };
    const size = [2.2, 3.2, 4.2][a.patternSize], gap = [34, 26, 19][a.patternDensity];
    let marks = "";
    for (let row = 0, py = 47; py < 180; py += gap, row++) {
      for (let px = 37 + (row % 2) * gap / 2; px < 195; px += gap) {
        // Keep the small face readable even with a dense print.
        if (px > 62 && px < 160 && py > y - 15 && py < y + 26) continue;
        if (a.pattern === "dots") marks += `<circle cx="${px}" cy="${py}" r="${size}"/>`;
        if (a.pattern === "stripes") marks += `<path d="M${px-size} ${py-size*2}l${size*2} ${size*4}" fill="none" stroke="${a.patternColor}" stroke-width="${size*.85}" stroke-linecap="round"/>`;
        if (a.pattern === "flowers") marks += `<g transform="translate(${px} ${py})"><circle cy="${-size}" r="${size*.8}"/><circle cx="${size}" r="${size*.8}"/><circle cy="${size}" r="${size*.8}"/><circle cx="${-size}" r="${size*.8}"/><circle r="${size*.55}" fill="${a.skinColor}"/></g>`;
      }
    }
    const skin = `<defs><clipPath id="cike-body"><path d="${bodies[a.shape]}"/></clipPath></defs><g clip-path="url(#cike-body)" fill="${a.patternColor}" stroke="none" opacity=".65">${marks}</g>`;
    const clothes = {
      none: "",
      overalls: `<path d="M52 149L74 151V137H89V153H132V137H147V151L176 146V185H52Z"/><path d="M89 154H133V170Q110 178 89 170Z" fill="none"/><path d="M111 178V192" fill="none"/><circle cx="81" cy="155" r="2.4" fill="#fff9e8"/><circle cx="140" cy="155" r="2.4" fill="#fff9e8"/>`,
      sweater: `<path d="M36 143L72 140Q110 153 150 140L189 143V185H36Z"/><path d="M73 141Q110 157 149 141M56 173H173" fill="none"/><path d="M65 154V169M78 157V171M91 159V172M104 160V172M117 160V172M130 158V171M143 156V170M156 153V168" opacity=".25" fill="none"/>`,
      apron: `<path d="M77 143L91 145L94 151H130L134 145L147 143L143 158L158 184H66L81 158Z"/><path d="M94 159H130V168Q112 178 94 168Z" fill="#fff9e8"/><path d="M50 157L79 161M144 161L174 157" fill="none"/>`,
      pajamas: `<path d="M39 144L82 139L110 148L140 139L187 144V185H39Z"/><path d="M82 140L93 156L110 148L129 157L141 140M110 149V184" fill="none"/><circle cx="116" cy="163" r="1.8" fill="#fff9e8"/><circle cx="116" cy="175" r="1.8" fill="#fff9e8"/><path d="M142 159H159V169H142Z" fill="none"/>`,
    };
    // Keep the hem anchored while opening up room for the full garment.
    // Lower face settings gently lower the neckline so it never crosses the mouth.
    const garmentScale = (180 - Math.max(113, y + 25)) / 40;
    const garmentShift = 180 * (1 - garmentScale);
    const outfit = `<g data-outfit="${a.outfit}" clip-path="url(#cike-body)" fill="${a.outfitColor}" stroke-width="1.8">${a.outfit === "none" ? "" : `<g transform="translate(0 ${garmentShift}) scale(1 ${garmentScale})">${clothes[a.outfit]}</g>`}</g>`;
    const eyes =
      a.expression === "sleepy"
        ? `<path d="M${82 - eye} ${y}q${eye + 4} 6 ${eye * 2 + 8} 0M${129 - eye} ${y}q${eye + 4} 6 ${eye * 2 + 8} 0" fill="none"/>`
        : a.expression === "happy"
          ? `<path d="M${82 - eye} ${y}q${eye + 4} -9 ${eye * 2 + 8} 0M${129 - eye} ${y}q${eye + 4} -9 ${eye * 2 + 8} 0" fill="none"/>`
          : `<ellipse cx="86" cy="${y}" rx="${eye}" ry="${eye + 1}" fill="#756a55" stroke="none"/><ellipse cx="137" cy="${y}" rx="${eye}" ry="${eye + 1}" fill="#756a55" stroke="none"/>`;
    return `<ellipse cx="110" cy="191" rx="55" ry="8" fill="#645d48" opacity=".10"/><g stroke="#756a55" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${bodies[a.shape]}" fill="${a.skinColor}"/>${skin}${outfit}${a.shape === "paper" ? '<path d="M66 56L81 64M151 51L145 61M49 123L59 120M169 145L176 148" opacity=".24"/>' : ""}<path d="M72 165Q66 185 83 181M145 168Q152 185 163 176" fill="${a.skinColor}"/><path d="M51 126Q36 116 34 129M180 128Q195 117 195 130" fill="none"/>${eyes}<path d="M105 ${y + 11}Q111 ${y + 17} 117 ${y + 11}" fill="none"/><path data-leaf="true" d="M95 38Q109 17 128 28Q117 44 95 38Z" fill="${a.leafColor}"/><path d="M99 36L116 30" stroke-width="1.3"/></g><ellipse cx="73" cy="${y + 11}" rx="10" ry="5" fill="#eac0b0" opacity=".65"/><ellipse cx="150" cy="${y + 11}" rx="10" ry="5" fill="#eac0b0" opacity=".65"/>`;
  }
  function svg(a) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="210" viewBox="0 0 220 210">${inner(a)}</svg>`;
  }
  const api = { defaults, presets, validate, isOriginal, inner, svg };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CikeAppearance = api;
})(typeof window !== "undefined" ? window : globalThis);
