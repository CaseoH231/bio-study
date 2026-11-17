// Textbook diagrams from Wikimedia Commons, saved in img/ref/. All free to use; the credit line is shown under each one.
// Picked to match the hand-drawn diagrams in the notebook (same parts labelled).
const PD = { license: 'Public domain' };
const BY3 = { license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/' };
const BYSA4 = { license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' };
const CC0 = { license: 'CC0 (public domain)' };
const commons = (file) => `https://commons.wikimedia.org/wiki/File:${file}`;

const FILES = {
  animal: { src: 'img/ref/animal-cell.svg', title: 'Animal cell structure', by: 'Mariana Ruiz (LadyofHats)', page: commons('Animal_cell_structure_en.svg'), ...PD },
  plant: { src: 'img/ref/plant-cell.svg', title: 'Plant cell structure', by: 'Mariana Ruiz (LadyofHats)', page: commons('Plant_cell_structure-en.svg'), ...PD },
  mito: { src: 'img/ref/mitochondrion.svg', title: 'Animal mitochondrion diagram', by: 'Mariana Ruiz (LadyofHats)', page: commons('Animal_mitochondrion_diagram_en.svg'), ...PD },
  nucleus: { src: 'img/ref/nucleus.svg', title: 'Diagram of a cell nucleus', by: 'Mariana Ruiz (LadyofHats)', page: commons('Diagram_human_cell_nucleus.svg'), ...PD },
  endo: { src: 'img/ref/endomembrane.svg', title: 'Endomembrane system (nucleus, ER, Golgi)', by: 'Mariana Ruiz (LadyofHats)', page: commons('Endomembrane_system_diagram_en.svg'), ...PD },
  golgi: { src: 'img/ref/golgi.svg', title: 'Golgi apparatus', by: 'Kelvinsong', page: commons('Golgi_apparatus_(borderless_version)-en.svg'), ...BY3 },
  ribosome: { src: 'img/ref/ribosome.svg', title: 'Ribosome translating mRNA', by: 'Mariana Ruiz (LadyofHats)', page: commons('Ribosome_mRNA_translation_en.svg'), ...PD },
  chloro: { src: 'img/ref/chloroplast.svg', title: 'Chloroplast', by: 'Miguelsierra, adapted by Vossman', page: commons('Scheme_Chloroplast-en.svg'), ...BYSA4 },
  perox: { src: 'img/ref/peroxisome.svg', title: 'Peroxisome', by: 'Agateller, vector by Qef', page: commons('Peroxisome.svg'), ...PD,
    edited: 'English labels only; “Plasma membrane” corrected to “Single membrane”' },
};

// Which textbook diagram goes with each kind of note (keyed like the built-in diagrams).
export const REFS = {
  animalcell: FILES.animal,
  plantcell: FILES.plant,
  wall: FILES.plant,
  vacuole: FILES.plant,
  plasmodesmata: FILES.plant,
  cytoskeleton: FILES.animal,
  lysosome: FILES.endo,
  mitochondria: FILES.mito,
  nucleus: FILES.nucleus,
  er: FILES.endo,
  golgi: FILES.golgi,
  ribosome: FILES.ribosome,
  chloroplast: FILES.chloro,
  peroxisome: FILES.perox,
};

export const refFiles = () => [...new Set(Object.values(FILES).map((f) => f.src))];
