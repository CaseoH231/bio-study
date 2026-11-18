// The notes a brand-new copy of the app starts with – the owner's notes (from the notebook, the scanner and the
// study helper), as of 18 Nov 2026. Drawings scanned from the notebook are in img/notes/ and img/.
// `filled: true` marks a definition that wasn't in the notebook yet; the app shows it as "Added for you – check it".
// Topics can sit inside other topics: `parent` is the id of the topic they're in.
// Bump `starter` when these change and add a step to upgradeStarter() in app.js if old copies need updating.
// (Usually you'd use "Publish my notes" in the app instead – new visitors then get the published notes.)
export const STARTER = {
  "version": 1,
  "starter": 4,
  "topics": [
    {
      "id": "t-headstart",
      "name": "Headstart",
      "color": "#7c3aed",
      "entries": []
    },
    {
      "id": "t-plant",
      "parent": "t-shared",
      "name": "Plant-Only Organelles",
      "color": "#16a34a",
      "entries": [
        {
          "id": "e-wall",
          "title": "Cell wall",
          "diagram": "wall",
          "found": "Plant only",
          "definition": "The tough outer layer of a plant cell. It gives structural support and protection.",
          "notes": [
            "Tough outer layer",
            "Structural support",
            "Protection"
          ]
        },
        {
          "id": "e-chloro",
          "title": "Chloroplasts",
          "diagram": "chloroplast",
          "found": "Plant only",
          "definition": "Plastids containing chlorophyll – where photosynthesis happens.",
          "notes": [
            "Plastids containing chlorophyll",
            "Photosynthesis"
          ]
        },
        {
          "id": "e-vacuole",
          "title": "Large central vacuole",
          "diagram": "vacuole",
          "found": "Plant only",
          "definition": "A large water-filled sac surrounded by a membrane (the tonoplast). It stores nutrients and maintains turgor pressure.",
          "notes": [
            "Large water-filled sac surrounded by a membrane",
            "The membrane is called the tonoplast",
            "Stores nutrients",
            "Maintains turgor pressure – to keep the plant upright"
          ]
        },
        {
          "id": "e-plasmo",
          "title": "Plasmodesmata",
          "diagram": "plasmodesmata",
          "found": "Plant only",
          "definition": "Microscopic channels through the cell wall.",
          "notes": [
            "Microscopic channels through the cell wall"
          ]
        }
      ]
    },
    {
      "id": "t-shared",
      "parent": "t-headstart",
      "name": "Organelles",
      "color": "#2563eb",
      "entries": [
        {
          "id": "e-nucleus",
          "title": "Nucleus",
          "diagram": "nucleus",
          "found": "Plant, Animal",
          "filled": true,
          "definition": "Contains the cell’s DNA and controls the cell’s activities.",
          "notes": [
            "Parts (from my diagram): nuclear envelope, nuclear pore, nucleolus, nucleoplasm"
          ]
        },
        {
          "id": "e-mito",
          "title": "Mitochondria",
          "diagram": "mitochondria",
          "image": "img/mitochondria.jpg",
          "found": "Plant, Animal",
          "definition": "Release energy as ATP – the site of aerobic respiration.",
          "notes": [
            "Mitochondria = plural, mitochondrion = singular",
            "RELEASES energy – ATP (adenosine triphosphate)",
            "Metabolically active cells have more",
            "The “jiggly wiggly” folds are the cristae",
            "Site of aerobic respiration (Krebs cycle & oxidative phosphorylation)",
            "Can make their own proteins",
            "Can replicate themselves when the cell divides"
          ]
        },
        {
          "id": "e-er",
          "title": "Endoplasmic reticulum (ER)",
          "diagram": "er",
          "image": "img/er.jpg",
          "found": "Plant, Animal",
          "filled": true,
          "definition": "A network of membranes joined to the nucleus. Rough ER (with ribosomes) makes proteins; smooth ER makes lipids.",
          "notes": [
            "Rough ER – covered in ribosomes",
            "Smooth ER – no ribosomes"
          ]
        },
        {
          "id": "e-golgi",
          "title": "Golgi body",
          "diagram": "golgi",
          "image": "img/golgi.jpg",
          "found": "Plant, Animal",
          "definition": "Packages proteins into vesicles and moves them safely out of the cell.",
          "notes": [
            "Also called the Golgi complex or Golgi apparatus",
            "Safely gets things out of the cell",
            "Packages & moves proteins out of the cell – covers them in vesicles if they might be seen as dangerous",
            "Close to, but not touching, the nucleus",
            "Transports, modifies and stores lipids (fats)",
            "Assembles glycoproteins",
            "Forms lysosomes",
            "Digestive fluids"
          ]
        },
        {
          "id": "e-ribo",
          "title": "Ribosomes",
          "diagram": "ribosome",
          "image": "img/ribosome.jpg",
          "found": "Plant, Animal",
          "filled": true,
          "definition": "Where proteins are made: they read the mRNA and join amino acids together, which tRNA brings in.",
          "notes": [
            "Parts (from my diagram): large subunit, small subunit, mRNA, tRNA, amino acid"
          ]
        },
        {
          "id": "e-perox",
          "title": "Peroxisomes",
          "diagram": "peroxisome",
          "found": "Plant, Animal",
          "filled": true,
          "definition": "Small sacs of enzymes, surrounded by one membrane, that break down harmful hydrogen peroxide and fatty acids.",
          "notes": []
        },
        {
          "id": "e-cytoskel",
          "title": "Cytoskeleton",
          "diagram": "cytoskeleton",
          "found": "Plant, Animal",
          "filled": true,
          "definition": "A network of protein fibres that supports the cell, keeps its shape and moves things around inside it.",
          "notes": []
        },
        {
          "id": "e-lyso",
          "title": "Lysosomes",
          "diagram": "lysosome",
          "image": "img/lysosome.jpg",
          "found": "Animal",
          "definition": "Release enzymes that digest worn-out organelles and material taken into the cell.",
          "notes": [
            "Release enzymes which digest worn-out organelles",
            "Completely break down the cell when it dies",
            "Digest material taken into the cell – take & process dangerous intruders once they die",
            "Exocytosis – exo = exit, cyt = cell"
          ]
        }
      ]
    },
    {
      "id": "t-animal",
      "parent": "t-headstart",
      "name": "Cells",
      "color": "#be123c",
      "entries": [
        {
          "id": "e-animalcell",
          "title": "Animal cell",
          "diagram": "animalcell",
          "image": "img/animal-cell.jpg",
          "found": "Animal",
          "filled": true,
          "definition": "A eukaryotic cell with a nucleus but no cell wall, chloroplasts or large central vacuole.",
          "notes": [
            "Parts (from my diagram): cell membrane, cytoplasm, nucleus, rough & smooth ER, ribosomes, Golgi body, secretory vesicles, mitochondrion, lysosome, peroxisome, centrosome & centrioles, cilium"
          ]
        },
        {
          "id": "e-plantcell",
          "title": "Plant cell",
          "diagram": "plantcell",
          "found": "Plant",
          "filled": true,
          "definition": "A eukaryotic cell with a cell wall, chloroplasts and a large central vacuole, as well as all the shared organelles.",
          "notes": []
        }
      ]
    },
    {
      "id": "mwlfuym70tjyw",
      "name": "Plasma membrane",
      "color": "#7c3aed",
      "entries": [
        {
          "id": "mwlfuym7vx7dm",
          "title": "Plasma membrane",
          "definition": "The cell surface membrane.",
          "notes": [
            "Also called the plasma membrane"
          ],
          "found": "",
          "diagram": "membrane",
          "image": ""
        },
        {
          "id": "mwlfuym8cnhp8",
          "title": "Glycolipid",
          "definition": "A component of the cell surface membrane.",
          "notes": [],
          "found": "",
          "diagram": "",
          "image": "",
          "filled": true
        },
        {
          "id": "mwlfuym8egiy6",
          "title": "Glycoprotein",
          "definition": "A component of the cell surface membrane.",
          "notes": [],
          "found": "",
          "diagram": "",
          "image": "",
          "filled": true
        },
        {
          "id": "mwlfuym8nla8s",
          "title": "Integral protein",
          "definition": "A protein that is part of the membrane.",
          "notes": [
            "Also called intrinsic protein - goes all the way through both layers"
          ],
          "found": "",
          "diagram": "",
          "image": ""
        },
        {
          "id": "mwlfuym8qccqj",
          "title": "Extrinsic protein",
          "definition": "A protein that is part of the way into the membrane, through 1 layer.",
          "notes": [
            "Also called extrinsic - outside"
          ],
          "found": "",
          "diagram": "",
          "image": ""
        },
        {
          "id": "mwlfuym8ph1nr",
          "title": "Phospholipid bilayer",
          "definition": "A structure made of phospholipids arranged in a bilayer.",
          "notes": [
            "Fluid mosaic model",
            "Globular proteins in between",
            "Cholesterol makes membrane more or less flexible - lets things in & out easier",
            "Others are: - steroids - glycolipids",
            "Parts (from my diagram): outside, inside, water, water, water, small hydrophobic molecules, small hydrophilic polar molecule, ions, large polar molecules, ions, large"
          ],
          "found": "",
          "diagram": "",
          "image": "img/notes/phospholipid-bilayer.jpg"
        },
        {
          "id": "mwlfuym82b5vq",
          "title": "Micelle",
          "definition": "A structure formed by amphipathic molecules.",
          "notes": [
            "Ions & large anchored polar molecules need special ways to get in & out, while the others can squeeze through"
          ],
          "found": "",
          "diagram": "",
          "image": "img/notes/micelle.jpg"
        },
        {
          "id": "mwlfuym8u12b5",
          "title": "Amphipathic molecule",
          "definition": "A molecule that has both hydrophilic & hydrophobic properties.",
          "notes": [
            "Properties: - hydrophilic = polar molecule - hydrophobic = non-polar molecule"
          ],
          "found": "",
          "diagram": "",
          "image": "img/notes/amphipathic-molecule.jpg"
        },
        {
          "id": "mwlfuym8olj2y",
          "title": "Hydrophilic",
          "definition": "Having an affinity for water.",
          "notes": [
            "philic = likes"
          ],
          "found": "",
          "diagram": "",
          "image": ""
        },
        {
          "id": "mwlfuym8mqmuc",
          "title": "Hydrophobic",
          "definition": "Having an aversion to water.",
          "notes": [
            "phobic = hates"
          ],
          "found": "",
          "diagram": "",
          "image": ""
        }
      ],
      "parent": "t-shared"
    },
    {
      "id": "mwlg3xh6vd9tx",
      "name": "Animal-Only Organelles",
      "color": "#0891b2",
      "entries": [],
      "parent": "t-shared"
    }
  ]
};
