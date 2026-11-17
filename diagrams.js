// Built-in coloured, labelled diagrams. Each diagram is drawn on a 640 x 360 canvas.
// labels: [text, colour, pointX, pointY, labelX, labelY, what it does]

function lbl([t, c, px, py, lx, ly], i) {
  const right = lx >= px;
  return `<g class="lb" data-i="${i}"><line x1="${px}" y1="${py}" x2="${lx}" y2="${ly}" stroke="${c}" stroke-width="2"/>` +
    `<circle cx="${px}" cy="${py}" r="4.5" fill="${c}" stroke="#fff" stroke-width="1.5"/>` +
    `<text x="${right ? lx + 6 : lx - 6}" y="${ly + 5}" text-anchor="${right ? 'start' : 'end'}" fill="${c}">${t}</text></g>`;
}

const range = (a, b, s) => { const r = []; for (let x = a; x <= b; x += s) r.push(x); return r; };

// ---------- organelle drawings ----------

const nucleusArt = () => {
  const pores = [10, 80, 150, 215, 280, 330].map((a) =>
    `<rect x="-5" y="-124" width="10" height="20" fill="#eff6ff" transform="translate(320 180) rotate(${a})"/>`).join('');
  return `<circle cx="320" cy="180" r="118" fill="#bfdbfe" stroke="#1e40af" stroke-width="5"/>
  <circle cx="320" cy="180" r="106" fill="#dbeafe" stroke="#1e40af" stroke-width="3"/>${pores}
  <g fill="none" stroke="#db2777" stroke-width="3.5" stroke-linecap="round">
    <path d="M245 140 q20 -25 40 0 t40 0"/><path d="M235 215 q15 20 35 0 t35 0 t30 0"/>
    <path d="M300 255 q20 -20 40 0 t30 5"/><path d="M370 125 q15 20 30 0"/><path d="M385 220 q10 -18 22 0"/></g>
  <circle cx="335" cy="180" r="32" fill="#7c3aed"/>`;
};

const mitoArt = () => {
  let cristae = '';
  [200, 240, 280, 320, 360, 400, 440].forEach((x, i) => {
    const e = 74 * Math.sqrt(1 - ((x - 320) / 150) ** 2);
    const y1 = i % 2 ? 180 + e : 180 - e, y2 = i % 2 ? y1 - 50 : y1 + 50;
    cristae += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#c2410c" stroke-width="13" stroke-linecap="round"/>` +
      `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 + (i % 2 ? 4 : -4)}" stroke="#fdba74" stroke-width="5" stroke-linecap="round"/>`;
  });
  return `<ellipse cx="320" cy="180" rx="165" ry="88" fill="#fdba74" stroke="#9a3412" stroke-width="5"/>
  <ellipse cx="320" cy="180" rx="150" ry="74" fill="#ffedd5" stroke="#c2410c" stroke-width="4"/>${cristae}
  <circle cx="255" cy="180" r="10" fill="none" stroke="#db2777" stroke-width="3"/>
  <circle cx="458" cy="182" r="4" fill="#6d28d9"/><circle cx="372" cy="186" r="4" fill="#6d28d9"/><circle cx="300" cy="186" r="4" fill="#6d28d9"/>
  <g stroke="#16a34a" stroke-width="3"><line x1="406" y1="215" x2="413" y2="215"/><line x1="394" y1="228" x2="387" y2="228"/><line x1="246" y1="214" x2="253" y2="214"/></g>
  <g fill="#16a34a"><circle cx="417" cy="215" r="4.5"/><circle cx="383" cy="228" r="4.5"/><circle cx="257" cy="214" r="4.5"/></g>`;
};

const chloroArt = () => {
  const stacks = [[220, 180], [300, 140], [330, 225], [420, 175]];
  const discs = stacks.map(([cx, cy]) => range(0, 4, 1).map((i) =>
    `<rect x="${cx - 24}" y="${cy - 25 + i * 10}" width="48" height="9" rx="4" fill="#16a34a" stroke="#14532d"/>`).join('')).join('');
  return `<ellipse cx="320" cy="180" rx="175" ry="95" fill="#86efac" stroke="#14532d" stroke-width="5"/>
  <ellipse cx="320" cy="180" rx="163" ry="84" fill="#dcfce7" stroke="#166534" stroke-width="3"/>
  <g stroke="#15803d" stroke-width="4"><line x1="220" y1="180" x2="300" y2="140"/><line x1="300" y1="140" x2="420" y2="175"/>
  <line x1="220" y1="180" x2="330" y2="225"/><line x1="330" y1="225" x2="420" y2="175"/></g>${discs}
  <ellipse cx="385" cy="240" rx="24" ry="12" fill="#fffbeb" stroke="#a16207" stroke-width="2"/>`;
};

const riboArt = () => `<ellipse cx="320" cy="145" rx="115" ry="72" fill="#a78bfa" stroke="#5b21b6" stroke-width="4"/>
  <ellipse cx="320" cy="250" rx="95" ry="40" fill="#ddd6fe" stroke="#6d28d9" stroke-width="4"/>
  <line x1="340" y1="153" x2="330" y2="76" stroke="#b45309" stroke-width="3"/>
  <rect x="290" y="168" width="24" height="46" rx="10" fill="#fbbf24" stroke="#b45309" stroke-width="2.5"/>
  <rect x="328" y="168" width="24" height="46" rx="10" fill="#fbbf24" stroke="#b45309" stroke-width="2.5"/>
  <circle cx="302" cy="159" r="8" fill="#10b981" stroke="#fff" stroke-width="1.5"/><circle cx="340" cy="159" r="8" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>
  <path d="M110 215 q20 -10 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t20 0" fill="none" stroke="#db2777" stroke-width="5"/>
  ${[[330, 68, '#f59e0b'], [345, 55, '#10b981'], [362, 47, '#3b82f6'], [380, 43, '#ef4444'], [398, 46, '#f59e0b'], [414, 38, '#10b981'], [430, 30, '#3b82f6']]
    .map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="8" fill="${c}" stroke="#fff" stroke-width="1.5"/>`).join('')}
  <text x="320" y="348" text-anchor="middle" class="note">Real size: about 20–30 nm – only visible with an electron microscope</text>`;

const membraneArt = () => {
  let lipids = '';
  range(40, 600, 22).filter((x) => x < 275 || x > 365).forEach((x) => {
    lipids += `<g stroke="#ca8a04" stroke-width="3"><line x1="${x - 3}" y1="122" x2="${x - 4}" y2="172"/><line x1="${x + 3}" y1="122" x2="${x + 4}" y2="172"/>
    <line x1="${x - 3}" y1="238" x2="${x - 4}" y2="188"/><line x1="${x + 3}" y1="238" x2="${x + 4}" y2="188"/></g>
    <circle cx="${x}" cy="115" r="9" fill="#f87171" stroke="#b91c1c" stroke-width="2"/><circle cx="${x}" cy="245" r="9" fill="#f87171" stroke="#b91c1c" stroke-width="2"/>`;
  });
  return `<rect x="0" y="0" width="640" height="104" fill="#e0f2fe"/><rect x="0" y="256" width="640" height="104" fill="#fef9c3"/>
  <text x="14" y="24" class="note" text-anchor="start">Outside the cell</text><text x="14" y="350" class="note" text-anchor="start">Inside the cell (cytoplasm)</text>
  ${lipids}<rect x="288" y="88" width="64" height="184" rx="22" fill="#34d399" stroke="#047857" stroke-width="4"/>
  <rect x="313" y="84" width="14" height="192" fill="#ecfeff"/>
  <circle cx="320" cy="60" r="7" fill="#2563eb"/><circle cx="320" cy="150" r="7" fill="#2563eb"/><circle cx="320" cy="215" r="7" fill="#2563eb"/>`;
};

const wallArt = () => `<rect x="150" y="40" width="340" height="280" rx="26" fill="#a3e635" stroke="#4d7c0f" stroke-width="3"/>
  ${[7, 14, 20].map((d) => `<rect x="${150 + d}" y="${40 + d}" width="${340 - 2 * d}" height="${280 - 2 * d}" rx="${24 - d / 2}" fill="none" stroke="#4d7c0f" stroke-width="1.5" stroke-dasharray="14 6"/>`).join('')}
  <rect x="180" y="70" width="280" height="220" rx="12" fill="#fef9c3" stroke="#2563eb" stroke-width="3"/>
  <ellipse cx="330" cy="185" rx="92" ry="62" fill="#bae6fd" stroke="#0369a1" stroke-width="2"/>
  <circle cx="220" cy="112" r="24" fill="#93c5fd" stroke="#1e40af" stroke-width="2"/>
  ${[[215, 258], [430, 100], [435, 268]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="17" ry="9" fill="#22c55e" stroke="#14532d"/>`).join('')}`;

const vacuoleArt = () => `<rect x="150" y="40" width="340" height="280" rx="26" fill="#a3e635" stroke="#4d7c0f" stroke-width="3"/>
  <rect x="176" y="66" width="288" height="228" rx="12" fill="#fef9c3" stroke="#2563eb" stroke-width="3"/>
  <rect x="215" y="92" width="232" height="176" rx="40" fill="#7dd3fc" stroke="#0369a1" stroke-width="5"/>
  ${[[260, 130], [300, 200], [350, 150], [400, 220], [380, 120], [270, 240], [330, 245], [420, 170]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#0369a1"/>`).join('')}
  <circle cx="196" cy="112" r="15" fill="#93c5fd" stroke="#1e40af" stroke-width="2"/>
  <ellipse cx="196" cy="210" rx="7" ry="15" fill="#22c55e" stroke="#14532d"/>
  <ellipse cx="330" cy="79" rx="16" ry="7" fill="#22c55e" stroke="#14532d"/><ellipse cx="330" cy="281" rx="16" ry="7" fill="#22c55e" stroke="#14532d"/>`;

const BLOB = 'M190 90 C 260 30, 420 40, 470 110 C 520 180, 480 290, 380 310 C 280 330, 170 300, 160 220 C 150 160, 160 110, 190 90 Z';
const cytoArt = () => `<path d="${BLOB}" fill="#fef3c7" stroke="#2563eb" stroke-width="5"/>
  <circle cx="290" cy="170" r="42" fill="#93c5fd" stroke="#1e40af" stroke-width="3"/><circle cx="298" cy="175" r="12" fill="#7c3aed"/>
  ${[[400, 120, 25], [420, 240, -20], [230, 262, 10]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="24" ry="12" transform="rotate(${r} ${x} ${y})" fill="#fdba74" stroke="#9a3412" stroke-width="2"/>`).join('')}
  ${[[250, 120], [220, 160], [340, 110], [370, 200], [450, 180], [300, 280], [360, 270], [200, 210]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#6d28d9"/>`).join('')}`;

const erArt = () => {
  let rough = '';
  [[195, 95], [205, 135], [195, 175], [205, 215]].forEach(([x, y]) => {
    rough += `<rect x="${x}" y="${y}" width="135" height="24" rx="12" fill="#fbcfe8" stroke="#be185d" stroke-width="3"/>`;
    range(x + 10, x + 128, 13).forEach((dx) => { rough += `<circle cx="${dx}" cy="${y - 2}" r="3.5" fill="#6d28d9"/><circle cx="${dx}" cy="${y + 26}" r="3.5" fill="#6d28d9"/>`; });
  });
  const tubes = ['M370 110 C 400 80, 430 140, 460 110 S 510 90, 520 130', 'M375 175 C 410 150, 440 200, 480 170 S 520 190, 515 230', 'M380 260 C 420 235, 440 285, 500 262'];
  return `<circle cx="60" cy="180" r="110" fill="#bfdbfe" stroke="#1e40af" stroke-width="4"/>${rough}
  ${tubes.map((d) => `<path d="${d}" fill="none" stroke="#db2777" stroke-width="18" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fbcfe8" stroke-width="10" stroke-linecap="round"/>`).join('')}`;
};

const golgiArt = () => {
  let sacs = '';
  range(0, 4, 1).forEach((i) => {
    const d = `M ${225 + i * 6} ${105 + i * 32} Q 320 ${150 + i * 32} ${415 - i * 6} ${105 + i * 32}`;
    sacs += `<path d="${d}" fill="none" stroke="#d97706" stroke-width="22" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fde68a" stroke-width="11" stroke-linecap="round"/>`;
  });
  const v = (x, y, f, c) => `<circle cx="${x}" cy="${y}" r="11" fill="${f}" stroke="${c}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="3" fill="#7c3aed"/>`;
  return [[275, 58], [370, 48]].map(([x, y]) => v(x, y, '#99f6e4', '#0f766e')).join('') + sacs +
    v(398, 247, '#fde68a', '#d97706') + [[455, 300], [395, 322], [205, 292]].map(([x, y]) => v(x, y, '#fecdd3', '#be123c')).join('');
};

const lysoArt = () => {
  const enz = [[250, 130], [380, 120], [400, 220], [240, 240], [330, 270], [360, 160], [280, 110], [420, 170], [220, 190]];
  return `<circle cx="320" cy="180" r="110" fill="#fecdd3" stroke="#be123c" stroke-width="6"/>
  <ellipse cx="305" cy="195" rx="44" ry="24" fill="#fed7aa" stroke="#9a3412" stroke-width="3" stroke-dasharray="7 5"/>
  <path d="M280 192 l14 -8 l12 10 l14 -9" fill="none" stroke="#9a3412" stroke-width="3"/>
  ${enz.map(([x, y]) => `<path d="M${x} ${y} L${x + 8} ${y - 5} A9 9 0 1 0 ${x + 8} ${y + 5} Z" fill="#e11d48"/>`).join('')}
  ${[40, 160, 250].map((a) => `<rect x="-7" y="-121" width="14" height="22" rx="4" fill="#34d399" stroke="#047857" stroke-width="2" transform="translate(320 180) rotate(${a})"/>`).join('')}`;
};

const bacteriumArt = () => `<rect x="130" y="90" width="380" height="180" rx="90" fill="#fde68a" stroke="#92400e" stroke-width="5"/>
  <rect x="140" y="100" width="360" height="160" rx="80" fill="#fef9c3" stroke="#2563eb" stroke-width="3"/>
  <path d="M250 150 C 300 110, 380 130, 360 170 S 260 230, 280 190 S 350 150, 400 200 S 300 250, 250 210 Z" fill="none" stroke="#db2777" stroke-width="3.5"/>
  ${[[444, 140], [452, 218], [200, 220]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#7c3aed" stroke-width="4.5"/>`).join('')}
  ${[[200, 170], [230, 130], [300, 240], [410, 120], [420, 245], [180, 200], [330, 120]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#6d28d9"/>`).join('')}
  <path d="M510 180 c 25 -30 45 30 70 0 s 40 30 55 0" fill="none" stroke="#92400e" stroke-width="4"/>`;

const plasmoArt = () => `<rect x="140" y="40" width="360" height="280" rx="18" fill="#a3e635" stroke="#4d7c0f" stroke-width="3"/>
  ${[306, 320, 334].map((x) => `<line x1="${x}" y1="44" x2="${x}" y2="316" stroke="#4d7c0f" stroke-width="1.5" stroke-dasharray="12 6"/>`).join('')}
  <rect x="156" y="56" width="140" height="248" rx="10" fill="#fef9c3" stroke="#2563eb" stroke-width="3"/>
  <rect x="344" y="56" width="140" height="248" rx="10" fill="#fef9c3" stroke="#2563eb" stroke-width="3"/>
  ${[100, 180, 260].map((y) => `<rect x="293" y="${y - 9}" width="54" height="18" fill="#fef9c3"/>
    <line x1="293" y1="${y - 9}" x2="347" y2="${y - 9}" stroke="#2563eb" stroke-width="3"/><line x1="293" y1="${y + 9}" x2="347" y2="${y + 9}" stroke="#2563eb" stroke-width="3"/>
    <line x1="288" y1="${y}" x2="352" y2="${y}" stroke="#db2777" stroke-width="4" stroke-linecap="round"/>`).join('')}
  ${[[272, 248], [318, 252], [366, 266], [250, 120], [392, 170]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#7c3aed"/>`).join('')}
  <text x="226" y="290" class="note" text-anchor="middle">Cell 1</text><text x="414" y="290" class="note" text-anchor="middle">Cell 2</text>`;

const peroxiArt = () => {
  let grid = '';
  for (let i = 1; i < 4; i++) grid += `<line x1="${280 + i * 20}" y1="135" x2="${280 + i * 20}" y2="205"/><line x1="280" y1="${135 + i * 17.5}" x2="360" y2="${135 + i * 17.5}"/>`;
  return `<circle cx="320" cy="180" r="110" fill="#dcfce7" stroke="#15803d" stroke-width="5"/>
  <g transform="rotate(-15 320 170)"><rect x="280" y="135" width="80" height="70" rx="6" fill="#86efac" stroke="#166534" stroke-width="2.5"/><g stroke="#166534" stroke-width="1.2">${grid}</g></g>
  ${[[250, 230], [390, 240], [240, 140], [400, 130], [330, 262], [250, 190], [398, 190], [300, 110]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#d97706" stroke="#92400e" stroke-width="1.5"/>`).join('')}`;
};

const cytoskelArt = () => {
  const tubes = [[215, 95], [465, 125], [485, 200], [425, 290], [300, 305], [180, 240], [275, 70]];
  return `<path d="${BLOB}" fill="#fff7ed" stroke="#2563eb" stroke-width="5"/>
  <g stroke="#16a34a" stroke-width="4.5" stroke-linecap="round">${tubes.map(([x, y]) => `<line x1="360" y1="130" x2="${x}" y2="${y}"/>`).join('')}</g>
  <g fill="none" stroke="#dc2626" stroke-width="2.2"><path d="M200 105 L230 85 L260 100 L290 75 L320 90 L350 70 L380 90 L410 75 L440 100"/>
    <path d="M190 260 L220 285 L250 270 L280 300 L310 285 L340 305 L370 285 L400 300"/></g>
  <g fill="none" stroke="#7c3aed" stroke-width="3"><path d="M175 180 q20 -20 40 0 t40 0"/><path d="M380 230 q20 -20 40 0 t40 0"/></g>
  <circle cx="300" cy="185" r="40" fill="#bfdbfe" stroke="#1e40af" stroke-width="3"/>
  <rect x="350" y="124" width="16" height="7" fill="#a16207"/><rect x="359" y="122" width="7" height="16" fill="#ca8a04"/>`;
};

// Whole cells for the notes, drawn from the cell explorer but not clickable.
const still = (svg) => svg.replaceAll('class="part"', 'class="pt"').replaceAll(' tabindex="0"', '');

export const DIAGRAMS = {
  nucleus: { name: 'Nucleus', color: '#1e40af', art: nucleusArt, labels: [
    ['Nuclear envelope', '#1e40af', 417, 112, 475, 60, 'Double membrane that surrounds the nucleus'],
    ['Nuclear pore', '#0f766e', 431, 160, 475, 170, 'Holes that let mRNA leave the nucleus'],
    ['Nucleolus', '#7c3aed', 350, 200, 475, 280, 'Dense area that makes ribosomes'],
    ['Chromatin (DNA)', '#db2777', 250, 135, 165, 100, 'DNA wound around proteins; coils up into chromosomes when the cell divides'],
    ['Nucleoplasm', '#2563eb', 270, 260, 165, 280, 'Jelly-like fluid inside the nucleus'] ] },
  mitochondria: { name: 'Mitochondrion', color: '#c2410c', art: mitoArt, labels: [
    ['Outer membrane', '#9a3412', 190, 126, 165, 60, 'Smooth outer layer'],
    ['DNA (loop)', '#db2777', 250, 180, 165, 170, 'Their own DNA – so they can make their own proteins and replicate'],
    ['Inner membrane', '#c2410c', 180, 207, 165, 270, 'Folded inner layer where ATP is made'],
    ['Cristae', '#b45309', 360, 140, 475, 50, 'The “jiggly wiggly” folds of the inner membrane – a big surface area'],
    ['Ribosome', '#6d28d9', 458, 182, 515, 135, 'Makes the mitochondrion’s own proteins'],
    ['Matrix', '#ea580c', 338, 195, 515, 200, 'Fluid inside – where the Krebs cycle happens'],
    ['ATP synthase', '#16a34a', 417, 215, 515, 265, 'Enzyme on the cristae that makes ATP (oxidative phosphorylation)'] ] },
  chloroplast: { name: 'Chloroplast', color: '#15803d', art: chloroArt, labels: [
    ['Double membrane', '#14532d', 320, 85, 475, 40, 'Outer and inner membrane'],
    ['Granum', '#15803d', 300, 118, 165, 60, 'A stack of thylakoids'],
    ['Thylakoid', '#16a34a', 196, 180, 128, 180, 'Flat disc containing chlorophyll – absorbs light'],
    ['Stroma', '#4d7c0f', 260, 235, 165, 275, 'Fluid where glucose is made'],
    ['Lamella', '#15803d', 360, 157, 520, 125, 'Links one granum to another'],
    ['Starch grain', '#a16207', 385, 240, 505, 285, 'Stored starch made from glucose'] ] },
  ribosome: { name: 'Ribosome', color: '#6d28d9', art: riboArt, labels: [
    ['Large subunit', '#5b21b6', 240, 120, 165, 100, 'Joins the amino acids together'],
    ['Small subunit', '#6d28d9', 300, 262, 165, 290, 'Holds the mRNA in place'],
    ['tRNA', '#b45309', 352, 192, 475, 170, 'Brings the matching amino acid to the ribosome'],
    ['mRNA', '#db2777', 450, 215, 475, 250, 'Copy of a gene – read three bases (a codon) at a time'],
    ['Amino acid', '#047857', 398, 46, 475, 85, 'Building blocks – joined into a protein chain'] ] },
  membrane: { name: 'Cell membrane', color: '#b91c1c', art: membraneArt, labels: [
    ['Phospholipid head', '#b91c1c', 128, 115, 140, 55, 'Water-loving (hydrophilic) – faces outwards'],
    ['Fatty acid tails', '#a16207', 172, 150, 180, 300, 'Water-hating (hydrophobic) – face inwards'],
    ['Channel protein', '#047857', 350, 140, 420, 55, 'Lets particular molecules pass through'],
    ['Phospholipid bilayer', '#7c2d12', 560, 180, 520, 300, 'Two layers of phospholipids'] ] },
  wall: { name: 'Cell wall', color: '#4d7c0f', art: wallArt, labels: [
    ['Cell wall', '#4d7c0f', 163, 150, 135, 110, 'Strong layer outside the membrane'],
    ['Cellulose fibres', '#3f6212', 167, 260, 135, 285, 'Tough fibres that make the wall strong'],
    ['Cell membrane', '#2563eb', 460, 200, 505, 225, 'Sits just inside the wall'],
    ['Cytoplasm', '#ca8a04', 440, 180, 505, 165, 'Fluid inside the membrane'],
    ['Vacuole', '#0369a1', 360, 210, 505, 300, 'Pushes against the wall to keep the cell firm'] ] },
  vacuole: { name: 'Permanent vacuole', color: '#0369a1', art: vacuoleArt, labels: [
    ['Tonoplast', '#0369a1', 447, 150, 505, 115, 'The membrane around the vacuole'],
    ['Cell sap', '#0284c7', 330, 190, 505, 200, 'Water with dissolved sugars and salts'],
    ['Cytoplasm', '#ca8a04', 455, 250, 505, 285, 'Squashed into a thin layer at the edge'],
    ['Nucleus', '#1e40af', 196, 112, 135, 80, 'Pushed to the side by the vacuole'],
    ['Cell wall', '#4d7c0f', 163, 220, 135, 245, 'Vacuole presses against it so the cell is turgid'] ] },
  cytoplasm: { name: 'Cytoplasm', color: '#b45309', art: cytoArt, labels: [
    ['Cytoplasm', '#b45309', 350, 240, 505, 300, 'Jelly-like fluid where most reactions happen'],
    ['Cell membrane', '#2563eb', 470, 110, 505, 65, 'Surrounds the cytoplasm'],
    ['Nucleus', '#1e40af', 262, 160, 135, 150, 'Sits in the cytoplasm'],
    ['Mitochondrion', '#9a3412', 214, 260, 135, 280, 'Suspended in the cytoplasm'],
    ['Ribosomes', '#6d28d9', 250, 120, 135, 70, 'Free ribosomes float in the cytoplasm'] ] },
  er: { name: 'Endoplasmic reticulum', color: '#be185d', art: erArt, labels: [
    ['Rough ER', '#be185d', 240, 95, 220, 40, 'Covered in ribosomes – makes and transports proteins'],
    ['Ribosomes', '#6d28d9', 296, 241, 300, 315, 'Make proteins on the surface of the rough ER'],
    ['Smooth ER', '#db2777', 460, 110, 530, 50, 'No ribosomes – makes lipids (fats)'],
    ['Nucleus', '#1e40af', 110, 260, 130, 325, 'The ER membrane joins onto the nuclear envelope'] ] },
  golgi: { name: 'Golgi body', color: '#d97706', art: golgiArt, labels: [
    ['Incoming vesicle', '#0f766e', 275, 58, 135, 45, 'Transport vesicle bringing proteins from the ER'],
    ['Cis face', '#d97706', 225, 105, 135, 105, 'The receiving side, facing the ER'],
    ['Cisternae', '#b45309', 231, 137, 135, 165, 'Stack of flattened membrane sacs'],
    ['Trans face', '#c2410c', 249, 233, 135, 240, 'The shipping side – vesicles bud off here'],
    ['Lumen', '#a16207', 320, 191, 505, 150, 'Space inside each sac where proteins are modified'],
    ['Forming vesicle', '#ea580c', 398, 247, 505, 220, 'A new vesicle budding off the trans face'],
    ['Secretory vesicle', '#be123c', 455, 300, 490, 295, 'Carries finished proteins out of the cell (exocytosis)'] ] },
  lysosome: { name: 'Lysosome', color: '#be123c', art: lysoArt, labels: [
    ['Membrane', '#be123c', 398, 102, 505, 70, 'Lipid layer that keeps the enzymes away from the rest of the cell'],
    ['Hydrolytic enzymes', '#e11d48', 250, 130, 170, 70, 'A mixture of digestive enzymes that break things down'],
    ['Transport protein', '#047857', 217, 218, 135, 200, 'Lets the digested materials out into the cytoplasm'],
    ['Old organelle', '#9a3412', 268, 205, 135, 280, 'Worn-out part being digested and recycled'] ] },
  plasmodesmata: { name: 'Plasmodesmata', color: '#0f766e', art: plasmoArt, labels: [
    ['Plasmodesma', '#0f766e', 330, 91, 505, 50, 'A microscopic channel through the cell wall'],
    ['Cell wall', '#4d7c0f', 320, 140, 505, 120, 'The channels pass straight through it'],
    ['ER strand', '#db2777', 340, 180, 505, 185, 'A thin tube of ER runs through the middle'],
    ['Molecules', '#7c3aed', 318, 252, 505, 255, 'Water and small molecules move between cells'],
    ['Cytoplasm', '#ca8a04', 220, 160, 135, 140, 'Joined to the next cell’s cytoplasm through the channels'],
    ['Cell membrane', '#2563eb', 156, 230, 135, 240, 'Lines the channel, so the two cells’ membranes join up'] ] },
  peroxisome: { name: 'Peroxisome', color: '#15803d', art: peroxiArt, labels: [
    ['Single membrane', '#15803d', 398, 102, 505, 70, 'One membrane (mitochondria and chloroplasts have two)'],
    ['Crystal core', '#166534', 352, 150, 505, 175, 'A dense core of packed enzymes'],
    ['Enzymes', '#b45309', 250, 230, 165, 250, 'e.g. catalase – breaks harmful hydrogen peroxide into water and oxygen'] ] },
  cytoskeleton: { name: 'Cytoskeleton', color: '#16a34a', art: cytoskelArt, labels: [
    ['Actin filaments', '#dc2626', 350, 70, 505, 45, 'Thin fibres under the membrane – change the cell’s shape and help it move'],
    ['Centrosome', '#a16207', 360, 130, 505, 120, 'Where the microtubules grow from'],
    ['Microtubules', '#16a34a', 392, 210, 505, 215, 'Hollow tubes – tracks that move organelles and vesicles'],
    ['Intermediate filaments', '#7c3aed', 215, 180, 190, 140, 'Rope-like fibres that make the cell strong'],
    ['Nucleus', '#1e40af', 275, 205, 135, 255, 'Held in place by the cytoskeleton'] ] },
  animalcell: { name: 'Animal cell', color: '#be123c', art: () => still(CELLS.animal.svg()), labels: [
    ['Cilium', '#0f766e', 181, 65, 135, 35, 'Hair-like part that can move fluid past the cell'],
    ['Nucleus', '#1e40af', 290, 128, 135, 85, 'Holds the DNA – nucleolus, nucleoplasm, nuclear pores and envelope'],
    ['Rough ER', '#be185d', 228, 172, 135, 135, 'Membranes with ribosomes – make proteins'],
    ['Ribosomes', '#6d28d9', 200, 200, 135, 185, 'Make proteins'],
    ['Peroxisome', '#15803d', 282, 236, 135, 235, 'Breaks down hydrogen peroxide'],
    ['Mitochondrion', '#9a3412', 230, 262, 135, 285, 'Releases energy (ATP)'],
    ['Cell membrane', '#2563eb', 160, 222, 135, 330, 'Controls what enters and leaves'],
    ['Centrosome', '#a16207', 354, 122, 505, 40, 'Organises microtubules; contains the centrioles'],
    ['Secretory vesicle', '#be123c', 435, 188, 495, 90, 'Carries proteins out of the cell'],
    ['Cytoskeleton', '#64748b', 465, 162, 505, 145, 'Protein fibres that hold the cell’s shape'],
    ['Golgi body', '#d97706', 395, 213, 505, 200, 'Packages proteins into vesicles'],
    ['Lysosome', '#be123c', 350, 275, 505, 255, 'Digests worn-out organelles'],
    ['Cytoplasm', '#b45309', 440, 285, 505, 310, 'Jelly-like fluid where reactions happen'] ] },
  plantcell: { name: 'Plant cell', color: '#16a34a', art: () => still(CELLS.plant.svg()), labels: [
    ['Nucleus', '#1e40af', 175, 80, 135, 40, 'Holds the DNA and controls the cell'],
    ['Plasmodesmata', '#0f766e', 150, 131, 135, 100, 'Channels through the cell wall to the next cell'],
    ['Cell wall', '#4d7c0f', 150, 175, 135, 160, 'Tough outer layer – support and protection'],
    ['Cell membrane', '#2563eb', 160, 250, 135, 215, 'Controls what enters and leaves'],
    ['Chloroplast', '#15803d', 195, 262, 135, 270, 'Photosynthesis'],
    ['Mitochondrion', '#9a3412', 228, 290, 135, 325, 'Releases energy (ATP)'],
    ['Rough ER', '#be185d', 250, 74, 505, 30, 'Makes proteins'],
    ['Ribosomes', '#6d28d9', 455, 90, 505, 75, 'Make proteins'],
    ['Central vacuole', '#0369a1', 425, 150, 505, 125, 'Water-filled sac – keeps the cell turgid'],
    ['Golgi body', '#d97706', 452, 186, 505, 185, 'Packages proteins into vesicles'],
    ['Cytoplasm', '#ca8a04', 472, 300, 505, 245, 'Jelly-like fluid'],
    ['Peroxisome', '#15803d', 440, 292, 505, 300, 'Breaks down hydrogen peroxide'] ] },
  plasmid: { name: 'Bacterium with plasmids', color: '#7c3aed', art: bacteriumArt, labels: [
    ['Plasmid', '#7c3aed', 444, 127, 470, 45, 'Small ring of DNA with extra genes'],
    ['Chromosomal DNA', '#db2777', 360, 170, 330, 330, 'One big loop of DNA, loose in the cytoplasm (no nucleus)'],
    ['Cell wall', '#92400e', 230, 90, 170, 40, 'Supports the cell (not made of cellulose)'],
    ['Cell membrane', '#2563eb', 300, 100, 330, 40, 'Controls what enters and leaves'],
    ['Flagellum', '#92400e', 535, 175, 545, 300, 'Whip-like tail that spins to move the cell'],
    ['Ribosomes', '#6d28d9', 180, 200, 135, 260, 'Smaller (70S) ribosomes make proteins'] ] },
};

export function diagramSVG(key, { labels = true } = {}) {
  const d = DIAGRAMS[key];
  if (!d) return '';
  return `<svg class="dg" viewBox="0 0 640 360" role="img" aria-label="Labelled diagram of ${d.name}">${d.art()}${labels ? d.labels.map(lbl).join('') : ''}</svg>`;
}

// Words in a note title that point at a built-in diagram (used when pasting notes).
export const DIAGRAM_WORDS = [
  [/nucle(us|i)\b/i, 'nucleus'], [/mitochond/i, 'mitochondria'], [/chloroplast/i, 'chloroplast'], [/ribosom/i, 'ribosome'],
  [/(cell|plasma|surface) membrane/i, 'membrane'], [/cell wall/i, 'wall'], [/vacuole/i, 'vacuole'], [/cytoplasm/i, 'cytoplasm'],
  [/endoplasmic|\b[rs]?er\b/i, 'er'], [/golgi/i, 'golgi'], [/lysosom/i, 'lysosome'], [/plasmodesm/i, 'plasmodesmata'], [/plasmid/i, 'plasmid'],
  [/peroxisom/i, 'peroxisome'], [/cytoskelet/i, 'cytoskeleton'],
];

// ---------- whole-cell explorers (click a part to open its notes) ----------

const part = (k, name, svg) => `<g class="part" data-k="${k}" tabindex="0"><title>${name}</title>${svg}</g>`;
const dots = (pts, c = '#6d28d9') => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${c}"/>`).join('');
const mito = (x, y, r) => `<ellipse cx="${x}" cy="${y}" rx="26" ry="13" transform="rotate(${r} ${x} ${y})" fill="#fdba74" stroke="#9a3412" stroke-width="2.5"/><path d="M${x - 14} ${y} q4 -8 8 0 t8 0 t8 0" transform="rotate(${r} ${x} ${y})" fill="none" stroke="#9a3412" stroke-width="2"/>`;

export const CELLS = {
  animal: { name: 'Animal cell', svg: () => `
    ${part('cytoplasm', 'Cytoplasm', `<path d="${BLOB}" fill="#fef3c7"/>`)}
    ${part('cytoskeleton', 'Cytoskeleton', `<path d="M195 125 L250 105 M330 300 L420 285 M445 140 L485 185 M175 250 L215 290" fill="none" stroke="transparent" stroke-width="10"/><path d="M195 125 L250 105 M330 300 L420 285 M445 140 L485 185 M175 250 L215 290" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="6 3"/>`)}
    ${part('er', 'Rough ER', `<path d="M240 125 q-25 45 0 95 M252 118 q-25 52 0 108" fill="none" stroke="#db2777" stroke-width="7" stroke-linecap="round"/>${dots([[230, 140], [226, 175], [231, 205], [244, 120]])}`)}
    ${part('nucleus', 'Nucleus', `<circle cx="300" cy="170" r="44" fill="#93c5fd" stroke="#1e40af" stroke-width="4"/><circle cx="308" cy="176" r="13" fill="#7c3aed"/>`)}
    ${part('mitochondria', 'Mitochondria', mito(405, 120, 25) + mito(425, 240, -20) + mito(240, 265, 10))}
    ${part('golgi', 'Golgi body', `<path d="M360 200 q25 18 50 0 M362 214 q23 16 46 0 M366 228 q19 13 38 0" fill="none" stroke="#d97706" stroke-width="7" stroke-linecap="round"/><circle cx="420" cy="200" r="6" fill="#fecdd3" stroke="#be123c" stroke-width="2"/><circle cx="435" cy="188" r="6" fill="#fecdd3" stroke="#be123c" stroke-width="2"/>`)}
    ${part('peroxisome', 'Peroxisome', `<circle cx="282" cy="236" r="9" fill="#bbf7d0" stroke="#15803d" stroke-width="2.5"/><rect x="278" y="232" width="8" height="8" fill="#15803d"/>`)}
    ${part('centrosome', 'Centrosome', `<rect x="346" y="119" width="16" height="7" fill="#a16207"/><rect x="355" y="116" width="7" height="16" fill="#ca8a04"/>`)}
    ${part('lysosome', 'Lysosome', `<circle cx="350" cy="275" r="13" fill="#fecdd3" stroke="#be123c" stroke-width="3"/>`)}
    ${part('ribosome', 'Ribosomes', dots([[340, 105], [455, 175], [300, 290], [200, 200], [380, 165], [195, 150]]))}
    ${part('membrane', 'Cell membrane', `<path d="${BLOB}" fill="none" stroke="transparent" stroke-width="22"/><path d="${BLOB}" fill="none" stroke="#2563eb" stroke-width="6"/>`)}
    ${part('cilium', 'Cilium', `<path d="M190 90 q-15 -25 -5 -50 M215 76 q-8 -28 8 -50" fill="none" stroke="transparent" stroke-width="12"/><path d="M190 90 q-15 -25 -5 -50 M215 76 q-8 -28 8 -50" fill="none" stroke="#0f766e" stroke-width="4" stroke-linecap="round"/>`)}` },
  plant: { name: 'Plant cell', svg: () => `
    ${part('wall', 'Cell wall', `<rect x="140" y="30" width="360" height="300" rx="20" fill="#a3e635" stroke="#4d7c0f" stroke-width="3"/>`)}
    ${part('cytoplasm', 'Cytoplasm', `<rect x="160" y="50" width="320" height="260" rx="12" fill="#fef9c3"/>`)}
    ${part('membrane', 'Cell membrane', `<rect x="160" y="50" width="320" height="260" rx="12" fill="none" stroke="transparent" stroke-width="14"/><rect x="160" y="50" width="320" height="260" rx="12" fill="none" stroke="#2563eb" stroke-width="4"/>`)}
    ${part('vacuole', 'Permanent vacuole', `<rect x="225" y="95" width="200" height="170" rx="40" fill="#7dd3fc" stroke="#0369a1" stroke-width="4"/>`)}
    ${part('nucleus', 'Nucleus', `<circle cx="195" cy="90" r="24" fill="#93c5fd" stroke="#1e40af" stroke-width="3"/><circle cx="199" cy="93" r="8" fill="#7c3aed"/>`)}
    ${part('chloroplast', 'Chloroplasts', [[195, 180], [195, 260], [320, 75], [455, 140], [455, 240], [330, 287]].map(([x, y]) =>
      `<ellipse cx="${x}" cy="${y}" rx="${x < 200 || x > 450 ? 11 : 24}" ry="${x < 200 || x > 450 ? 22 : 11}" fill="#22c55e" stroke="#14532d" stroke-width="2"/>`).join(''))}
    ${part('mitochondria', 'Mitochondria', mito(400, 72, 0) + mito(250, 290, 0))}
    ${part('er', 'Rough ER', `<path d="M232 60 q12 14 0 28 M244 58 q12 16 0 32" fill="none" stroke="#db2777" stroke-width="5" stroke-linecap="round"/>${dots([[230, 64], [242, 82], [256, 70]])}`)}
    ${part('golgi', 'Golgi body', `<path d="M432 180 q20 12 40 0 M434 191 q18 10 36 0 M437 201 q15 8 30 0" fill="none" stroke="#d97706" stroke-width="5" stroke-linecap="round"/>`)}
    ${part('peroxisome', 'Peroxisome', `<circle cx="440" cy="292" r="8" fill="#bbf7d0" stroke="#15803d" stroke-width="2.5"/><rect x="436" y="288" width="7" height="7" fill="#15803d"/>`)}
    ${part('ribosome', 'Ribosomes', dots([[175, 130], [455, 90], [460, 285], [270, 72], [175, 295]]))}
    ${part('plasmodesmata', 'Plasmodesmata', [[138, 128], [138, 218], [478, 188]].map(([x, y]) => `<rect x="${x}" y="${y}" width="24" height="7" fill="#fef9c3" stroke="#0f766e" stroke-width="1.5"/>`).join(''))}` },
  bacteria: { name: 'Bacterial cell', svg: () => `
    ${part('wall', 'Cell wall', `<rect x="130" y="90" width="380" height="180" rx="90" fill="#fde68a" stroke="#92400e" stroke-width="5"/>`)}
    ${part('cytoplasm', 'Cytoplasm', `<rect x="142" y="102" width="356" height="156" rx="78" fill="#fef9c3"/>`)}
    ${part('membrane', 'Cell membrane', `<rect x="142" y="102" width="356" height="156" rx="78" fill="none" stroke="transparent" stroke-width="12"/><rect x="142" y="102" width="356" height="156" rx="78" fill="none" stroke="#2563eb" stroke-width="3"/>`)}
    ${part('dna', 'Chromosomal DNA', `<path d="M250 150 C 300 110, 380 130, 360 170 S 260 230, 280 190 S 350 150, 400 200 S 300 250, 250 210 Z" fill="none" stroke="transparent" stroke-width="14"/><path d="M250 150 C 300 110, 380 130, 360 170 S 260 230, 280 190 S 350 150, 400 200 S 300 250, 250 210 Z" fill="none" stroke="#db2777" stroke-width="4"/>`)}
    ${part('plasmid', 'Plasmids', [[444, 140], [452, 218], [200, 220]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="#fef9c3" stroke="#7c3aed" stroke-width="5"/>`).join(''))}
    ${part('ribosome', 'Ribosomes', dots([[200, 170], [230, 130], [300, 240], [410, 120], [420, 245], [180, 200], [330, 120]]))}
    ${part('flagellum', 'Flagellum', `<path d="M510 180 c 25 -30 45 30 70 0 s 40 30 55 0" fill="none" stroke="transparent" stroke-width="16"/><path d="M510 180 c 25 -30 45 30 70 0 s 40 30 55 0" fill="none" stroke="#92400e" stroke-width="5"/>`)}` },
};

export function cellSVG(kind) {
  return `<svg class="cell" viewBox="0 0 640 360" role="img" aria-label="${CELLS[kind].name} – click a part">${CELLS[kind].svg()}</svg>`;
}
