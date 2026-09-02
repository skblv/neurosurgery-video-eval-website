/**
 * Closed-set example items shown on each leaderboard page.
 *
 * Frames are never shown; the UI draws a labeled rectangle in their place.
 */

export interface BenchExampleGroup {
  label: string;
  options: string[];
}

export interface BenchExampleSpec {
  question: string;
  /** How the closed set is scored. */
  selection: "one" | "any";
  options: string[];
  groups?: BenchExampleGroup[];
}

export const INSTRUMENT_EXAMPLES: Record<"cholect50" | "pitvis" | "surgvu", BenchExampleSpec> = {
  cholect50: {
    question:
      "Which instruments are visible in this laparoscopic cholecystectomy frame?",
    selection: "any",
    options: ["grasper", "bipolar", "hook", "scissors", "clipper", "irrigator"],
  },
  pitvis: {
    question:
      "Which instruments are visible in this endoscopic pituitary-surgery frame?",
    selection: "any",
    options: [
      "bipolar forceps",
      "cottle",
      "cup forceps",
      "dural scissors",
      "freer elevator",
      "haemostatic foam",
      "irrigation syringe",
      "kerrisons",
      "micro doppler",
      "nasal cutting forceps",
      "pituitary rongeurs",
      "retractable knife",
      "ring curette",
      "spatula dissector",
      "stealth pointer",
      "suction",
      "surgical drill",
      "tissue glue",
    ],
  },
  surgvu: {
    question: "Which instruments are visible in this robotic surgical frame?",
    selection: "any",
    options: [
      "bipolar dissector",
      "bipolar forceps",
      "cadiere forceps",
      "clip applier",
      "force bipolar",
      "grasping retractor",
      "monopolar curved scissors",
      "needle driver",
      "permanent cautery hook/spatula",
      "potts scissors",
      "prograsp forceps",
      "stapler",
      "suction irrigator",
      "synchroseal",
      "tenaculum forceps",
      "tip-up fenestrated grasper",
      "vessel sealer",
    ],
  },
};

export const GESTURE_EXAMPLE: BenchExampleSpec = {
  question: "What surgical gesture is being performed in this frame?",
  selection: "one",
  options: [
    "aspirate",
    "clip",
    "coagulate",
    "cut",
    "dissect",
    "grasp",
    "irrigate",
    "no action",
    "remove specimen",
    "suture",
  ],
};

export const DOMAIN_EXAMPLES: Record<
  | "dsad"
  | "cadis"
  | "endoscapes"
  | "pitvqa"
  | "cholect50verbs"
  | "pitvissteps"
  | "sarrarp50",
  BenchExampleSpec
> = {
  dsad: {
    question:
      "Which anatomical structures are visible in this laparoscopic frame?",
    selection: "any",
    options: [
      "abdominal wall",
      "colon",
      "inferior mesenteric artery",
      "intestinal veins",
      "liver",
      "pancreas",
      "small intestine",
      "spleen",
      "stomach",
      "ureter",
      "uterus",
      "vesicular glands",
    ],
  },
  cadis: {
    question:
      "Which anatomical structures, instruments, and other entities are visible in this cataract-surgery frame?",
    selection: "any",
    options: [
      "Pupil",
      "Surgical Tape",
      "Hand",
      "Eye Retractors",
      "Iris",
      "Skin",
      "Cornea",
      "Cannula",
      "Cap. Cystotome",
      "Tissue Forceps",
      "Primary Knife",
      "Ph. Handpiece",
      "Lens Injector",
      "I/A Handpiece",
      "Secondary Knife",
      "Micromanipulator",
      "Cap. Forceps",
    ],
  },
  endoscapes: {
    question:
      "Which anatomical structures and tools are visible in this laparoscopic cholecystectomy frame?",
    selection: "any",
    options: [
      "cystic plate",
      "hepatocystic triangle dissection",
      "cystic artery",
      "cystic duct",
      "gallbladder",
      "tool",
    ],
  },
  pitvqa: {
    question:
      "What is the current surgical phase and surgical step in this endoscopic pituitary frame?",
    selection: "one",
    options: [],
    groups: [
      {
        label: "Phase (choose one)",
        options: ["closure", "nasal sphenoid", "sellar"],
      },
      {
        label: "Step (choose one)",
        options: [
          "anterior sphenoidotomy",
          "debris clearance",
          "dural sealant",
          "durotomy",
          "fat graft placement",
          "gasket seal construct",
          "haemostasis",
          "nasal corridor creation",
          "nasal packing",
          "sellotomy",
          "septum displacement",
          "sphenoid sinus clearance",
          "synthetic graft placement",
          "tumour excision",
        ],
      },
    ],
  },
  cholect50verbs: {
    question:
      "Which surgical actions are being performed in this cholecystectomy frame?",
    selection: "any",
    options: [
      "grasp",
      "retract",
      "dissect",
      "coagulate",
      "clip",
      "cut",
      "aspirate",
      "irrigate",
      "pack",
      "idle",
    ],
  },
  pitvissteps: {
    question:
      "Which surgical step is visible in this endoscopic pituitary-surgery frame?",
    selection: "one",
    options: [
      "nasal corridor creation",
      "anterior sphenoidotomy",
      "septum displacement",
      "sphenoid sinus clearance",
      "sellotomy",
      "durotomy",
      "tumour excision",
      "haemostasis",
      "synthetic graft placement",
      "fat graft placement",
      "dural sealant",
      "debris clearance",
    ],
  },
  sarrarp50: {
    question: "What suturing action is being performed in this frame?",
    selection: "one",
    options: [
      "Other",
      "Picking Up The Needle",
      "Positioning The Needle Tip",
      "Pushing The Needle Through The Tissue",
      "Pulling The Needle Out Of The Tissue",
      "Tying A Knot",
      "Cutting The Suture",
      "Returning Or Dropping The Needle",
    ],
  },
};
