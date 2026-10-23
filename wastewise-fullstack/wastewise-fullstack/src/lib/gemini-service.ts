import { GoogleGenAI } from "@google/genai";

export type UniversalWasteStream =
  | "RECYCLABLE_CLEAN"
  | "COMPOST_ORGANIC"
  | "HAZARDOUS_EWASTE"
  | "MEDICAL_SANITARY"
  | "TEXTILE_DONATION"
  | "CONSTRUCTION_INERT"
  | "SOFT_PLASTIC_SPECIAL"
  | "RESIDUAL_LANDFILL";

export interface WasteComponent {
  id?: string;
  name: string;
  material: string;
  recyclability?: string;
  queryTerm?: string;
}

export interface IdentificationResult {
  name: string;
  itemName?: string;
  material: string;
  universalStream: UniversalWasteStream;
  confidence: "high" | "medium" | "low";
  isUnclearImage?: boolean;
  components: WasteComponent[];
  customPrepSteps: string[];
  detectedItems?: Array<{ id: string; name: string; material: string }>;
  clarificationQuestion: string | null;
  needsClarification?: boolean;
  candidateOptions?: Array<{ id: string; label: string; material: string }>;
}

const SYSTEM_INSTRUCTION = `You are WasteWise's multimodal waste identification & material decomposition engine.
Your task is to analyze ANY waste object (from camera photo, packaging, label, or text) and output a structured, evidence-grounded decomposition.

You must follow a STRICT 3-STEP SCANNING CONTRACT for every single item:

### STEP 1: ITEM IDENTIFICATION
- Accurately name the precise item detected with high technical specificity (e.g., "32700 Lithium-Ion Battery Cells", "Cracked Ceramic Coffee Mug", "Clean Corrugated Cardboard Box", "Greasy Pizza Delivery Box"). NEVER use generic placeholders like "Captured Waste Item" or "Scanned Object".
- Break down the item into its physical components and constituent materials (e.g., Steel Outer Casing, Copper/Aluminum Terminals, Lithium Iron Phosphate).

### STEP 2: WASTE CLASSIFICATION (ONE OF 8 UNIVERSAL MUNICIPAL STREAMS)
Classify into ONE AND ONLY ONE of the following 8 universal municipal streams:
- HAZARDOUS_EWASTE: MUST trigger for all batteries (lithium-ion, alkaline, button cells, 32700 cells), electronic devices, charging cables, power banks, vapes, e-cigarettes, CFL/LED bulbs, chemicals, paint. (CRITICAL SAFETY RULE: NEVER classify batteries or electronics as RECYCLABLE_CLEAN or RESIDUAL_LANDFILL!).
- RECYCLABLE_CLEAN: Clean rigid plastics (#1 PET, #2 HDPE, #5 PP), aluminum beverage cans, steel food tins, container glass bottles/jars, dry clean paper/cardboard.
- COMPOST_ORGANIC: Food scraps, vegetable/fruit peels, coffee grounds, greasy/soiled paper & pizza boxes, organic biomass.
- MEDICAL_SANITARY: Medicine blister packs, expired pharmaceuticals, syringes, sharps, test strips, masks, bandages, diapers.
- TEXTILE_DONATION: Clothing, shoes, fabrics, wearable garments, bed linens, towels.
- CONSTRUCTION_INERT: Broken ceramics, porcelain mugs/plates, window/mirror glass, clay pots, concrete, tiles, masonry.
- SOFT_PLASTIC_SPECIAL: Plastic grocery bags, flexible wrappers, chip packets, bubble wrap, multi-layer foil pouches.
- RESIDUAL_LANDFILL: Poly-coated single-use hot paper cups, heavily contaminated packaging, composite non-recyclable trash.

### STEP 3: PROPER DISPOSAL & PREPARATION
- Provide clear, item-specific safety and preparation instructions tailored to the detected object.
- For HAZARDOUS_EWASTE (especially batteries): explicitly include:
  1. "Do not place in regular trash or recycling due to fire risk."
  2. "Tape terminals with clear tape."
  3. "Drop off at an authorized E-Waste center."

OUTPUT JSON SCHEMA:
Return ONLY a valid JSON object matching this schema:
{
  "itemName": "string",
  "material": "string",
  "universalStream": "HAZARDOUS_EWASTE" | "RECYCLABLE_CLEAN" | "COMPOST_ORGANIC" | "MEDICAL_SANITARY" | "TEXTILE_DONATION" | "CONSTRUCTION_INERT" | "SOFT_PLASTIC_SPECIAL" | "RESIDUAL_LANDFILL",
  "confidence": "high" | "medium" | "low",
  "components": [
    { "name": "string", "material": "string", "recyclability": "string" }
  ],
  "customPrepSteps": ["string", "string", "string"],
  "needsClarification": boolean,
  "clarificationQuestion": string or null
}`;

/**
 * Fallback universal heuristic classifier for offline / mock testing when no valid Gemini key is configured
 */
export function fallbackUniversalExtraction(queryOrHint: string): IdentificationResult {
  const q = queryOrHint.toLowerCase();

  if (q.includes("battery") || q.includes("lithium") || q.includes("alkaline") || q.includes("32700") || q.includes("cell")) {
    return {
      name: "32700 Lithium-Ion Battery Cells",
      itemName: "32700 Lithium-Ion Battery Cells",
      material: "Lithium Iron Phosphate (LiFePO4) & Steel Casing",
      universalStream: "HAZARDOUS_EWASTE",
      confidence: "high",
      components: [
        { name: "Steel Outer Casing", material: "Nickel-Plated Steel", recyclability: "Special Hazardous E-Waste Stream" },
        { name: "Electrode Terminals", material: "Copper & Aluminum Contacts", recyclability: "Special Hazardous E-Waste Stream" }
      ],
      customPrepSteps: [
        "1. Do not place in regular trash or recycling due to fire risk.",
        "2. Tape terminals with clear tape.",
        "3. Drop off at an authorized E-Waste center."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (q.includes("ceramic") || q.includes("mug") || q.includes("porcelain") || q.includes("plate") || q.includes("dish") || q.includes("pottery")) {
    return {
      name: "Broken Ceramic Coffee Mug",
      itemName: "Broken Ceramic Coffee Mug",
      material: "Glazed Stoneware Ceramic",
      universalStream: "CONSTRUCTION_INERT",
      confidence: "high",
      components: [
        { name: "Mug Body & Handle", material: "Glazed Ceramic", recyclability: "Non-Recyclable Inert Mineral Material" }
      ],
      customPrepSteps: [
        "Wrap broken sharp fragments securely in newspaper or cardboard to protect sanitation workers.",
        "Do NOT place in the blue glass recycling bin as ceramics melt at a much higher temperature than bottle glass.",
        "Dispose of with municipal inert masonry waste or general residual landfill stream."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (q.includes("pizza") || q.includes("greasy") || q.includes("cheese")) {
    return {
      name: "Greasy Cardboard Pizza Box",
      itemName: "Greasy Cardboard Pizza Box",
      material: "Food-Soiled Corrugated Cardboard",
      universalStream: "COMPOST_ORGANIC",
      confidence: "high",
      components: [
        { name: "Greasy Bottom Box", material: "Oil-Soiled Cardboard", recyclability: "Compostable Organics" },
        { name: "Clean Lid (if torn off)", material: "Unsoiled Cardboard", recyclability: "Dry Paper Recycling" }
      ],
      customPrepSteps: [
        "Remove any plastic dip containers, plastic box supports (pizza savers), and aluminum foil.",
        "Place the food-soiled greasy cardboard portion into the Green Compost / Organics bin.",
        "Tear off any completely clean, oil-free cardboard lid sections and place them in the Blue Recycling bin."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (q.includes("shirt") || q.includes("cloth") || q.includes("textile") || q.includes("jeans") || q.includes("apparel") || q.includes("cotton")) {
    return {
      name: "Worn Cotton Textile T-Shirt",
      itemName: "Worn Cotton Textile T-Shirt",
      material: "100% Cotton Knitted Fabric",
      universalStream: "TEXTILE_DONATION",
      confidence: "high",
      components: [
        { name: "Fabric Body", material: "Cotton Fiber", recyclability: "Textile Reuse & Shredding" }
      ],
      customPrepSteps: [
        "Ensure garment is dry and free from hazardous or wet kitchen grease.",
        "If wearable, donate to a local charity bin, thrift partner, or campus clothes swap.",
        "If worn or torn, drop off at a specialized textile recovery or rag collection point."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (q.includes("blister") || q.includes("medicine") || q.includes("pill") || q.includes("pharmaceutical") || q.includes("paracetamol")) {
    return {
      name: "Pharmaceutical Medicine Blister Pack",
      itemName: "Pharmaceutical Medicine Blister Pack",
      material: "Aluminum Foil / PVC Plastic Composite",
      universalStream: "MEDICAL_SANITARY",
      confidence: "high",
      components: [
        { name: "Push-Through Foil", material: "Aluminum Foil", recyclability: "Non-Separable Composite" },
        { name: "Blister Tray", material: "Thermoformed Polyvinyl Chloride (PVC)", recyclability: "Non-Separable Composite" }
      ],
      customPrepSteps: [
        "Ensure all remaining pills, tablets, or medications are removed.",
        "Return unused or expired medicines to participating pharmacy take-back programs.",
        "Do NOT place foil blister packaging in household blue recycling; dispose in sanitary residual waste."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (q.includes("bottle") || q.includes("pet") || q.includes("water bottle")) {
    return {
      name: "Plastic Water Bottle",
      itemName: "Plastic Water Bottle",
      material: "Polyethylene Terephthalate (#1 PET)",
      universalStream: "RECYCLABLE_CLEAN",
      confidence: "high",
      components: [
        { name: "Bottle Body", material: "Clear PET (#1)", recyclability: "Standard Blue Bin Recycling" },
        { name: "Screw Cap", material: "High-Density Polyethylene (#2 HDPE)", recyclability: "Recyclable with Bottle" }
      ],
      customPrepSteps: [
        "Empty all liquid completely and give a quick rinse.",
        "Crush the bottle lightly to save collection space.",
        "Screw the cap back onto the bottle and place into the Blue Recycling bin."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (q.includes("banana") || q.includes("peel") || q.includes("apple") || q.includes("food") || q.includes("organic")) {
    return {
      name: "Banana Peel",
      itemName: "Banana Peel",
      material: "Organic Plant Matter",
      universalStream: "COMPOST_ORGANIC",
      confidence: "high",
      components: [
        { name: "Fruit Skin", material: "Biodegradable Biomass", recyclability: "Municipal Compost" }
      ],
      customPrepSteps: [
        "Remove any plastic stickers or price labels from the peel.",
        "Drain excess liquids.",
        "Place into the Green Wet Waste / Compost bin without plastic bags."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (q.includes("noodle") || q.includes("ramen") || q.includes("sachet") || q.includes("snack wrapper")) {
    return {
      name: "Instant Noodle Multi-Layer Packaging",
      itemName: "Instant Noodle Multi-Layer Packaging",
      material: "Polypropylene Film & Foil Sachet",
      universalStream: "SOFT_PLASTIC_SPECIAL",
      confidence: "medium",
      components: [
        { name: "Outer Bag", material: "Flexible Plastic Film", recyclability: "Store Drop-off Soft Plastics" },
        { name: "Seasoning Sachet", material: "Foil-Lined Plastic Laminate", recyclability: "Residual Landfill" }
      ],
      customPrepSteps: [
        "Separate the outer clear wrapper from the inner seasoning and oil sachets.",
        "Empty all food seasoning residue completely.",
        "Check local store collection for soft flexible film; place soiled oil foil sachets in general trash."
      ],
      clarificationQuestion: "Which component are you disposing of: the outer plastic wrapper or the inner foil seasoning pouch?",
      needsClarification: true
    };
  }

  if (q.includes("coffee cup") || q.includes("hot cup") || q.includes("takeaway cup")) {
    return {
      name: "Disposable Takeaway Coffee Cup",
      itemName: "Disposable Takeaway Coffee Cup",
      material: "Poly-Coated Paperboard & Plastic Lid",
      universalStream: "RESIDUAL_LANDFILL",
      confidence: "high",
      components: [
        { name: "Cup Body", material: "Polyethylene-Lined Paperboard", recyclability: "Residual Landfill" },
        { name: "Sip Lid", material: "Polypropylene Plastic (#5)", recyclability: "Blue Bin Recycling" }
      ],
      customPrepSteps: [
        "Separate the plastic lid from the paper cup.",
        "Rinse and place the rigid plastic lid in the Blue Recycling Bin.",
        "Place the poly-coated cup body in the Landfill Bin (poly-coating prevents standard paper pulping)."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  // Generic fallback with realistic classification
  const title = queryOrHint.trim() || "Household Packaging Item";
  return {
    name: title,
    itemName: title,
    material: "Commercial Packaging",
    universalStream: "RESIDUAL_LANDFILL",
    confidence: "medium",
    components: [
      { name: "Main Enclosure", material: "Composite Material", recyclability: "Check Local Collection" }
    ],
    customPrepSteps: [
      "Ensure the item is completely empty of contents.",
      "Check packaging labels for resin recycling codes or local take-back instructions.",
      "Place into general residual waste if multi-material components cannot be separated."
    ],
    clarificationQuestion: null,
    needsClarification: false
  };
}

/**
 * Universal Gemini Multimodal Vision Extraction
 */
export async function analyzeWasteImageWithGemini(
  base64Image: string,
  mimeType: string,
  textOrRegionHint?: string
): Promise<IdentificationResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback if key missing, placeholder, or invalid
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE" || apiKey.startsWith("dummy") || apiKey.length < 10) {
    return fallbackUniversalExtraction(textOrRegionHint || "Scanned Waste Item");
  }

  // 1. Clean Base64: Strip any data URL prefix
  let cleanBase64 = base64Image;
  const prefixMatch = base64Image.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
  if (prefixMatch) {
    if (prefixMatch[1]) mimeType = prefixMatch[1];
    cleanBase64 = prefixMatch[2];
  } else {
    cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, "");
  }

  // 2. Validate MIME type
  if (!mimeType || mimeType === "image/*") {
    mimeType = "image/jpeg";
  }

  const ai = new GoogleGenAI({ apiKey });

  // 3. Multi-model resilience: try gemini-3.8-flash, with automatic fallback to 2.5 and 1.5
  const candidateModels = [
    process.env.GEMINI_MODEL || "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-2.0-flash"
  ];
  // Deduplicate
  const modelsToTry = Array.from(new Set(candidateModels));

  const promptText = `Follow the strict 3-step waste scanning contract:
- Step 1: Item Identification: Accurately name the precise item detected (e.g., if batteries or cylindrical cells are visible, specify "32700 Lithium-Ion Battery Cells") and physical materials.
- Step 2: Waste Classification: Classify into EXACTLY ONE universal stream. If any battery, cell, electronics, cable, or vape is detected, it MUST be classified as HAZARDOUS_EWASTE (NEVER RECYCLABLE_CLEAN or RESIDUAL_LANDFILL).
- Step 3: Proper Disposal & Preparation: Provide clear item-specific steps (for batteries: 1. Do not place in regular trash or recycling due to fire risk. 2. Tape terminals with clear tape. 3. Drop off at an authorized E-Waste center).
${textOrRegionHint ? `User context/hint: "${textOrRegionHint}"` : ""}`;

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: cleanBase64, mimeType } },
              { text: promptText }
            ]
          }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json"
        }
      });

      const rawText = response.text || "";
      let parsed: any;
      try {
        let cleaned = rawText.trim();
        if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
        parsed = JSON.parse(cleaned);
      } catch (e) {
        continue;
      }

      if (parsed && (parsed.itemName || parsed.name)) {
        let itemName = (parsed.itemName || parsed.name || "Scanned Waste Item").trim();
        let universalStream = [
          "RECYCLABLE_CLEAN",
          "COMPOST_ORGANIC",
          "HAZARDOUS_EWASTE",
          "MEDICAL_SANITARY",
          "TEXTILE_DONATION",
          "CONSTRUCTION_INERT",
          "SOFT_PLASTIC_SPECIAL",
          "RESIDUAL_LANDFILL"
        ].includes(parsed.universalStream)
          ? parsed.universalStream
          : "RESIDUAL_LANDFILL";

        // Safety enforcement: If the item name, material, or components indicate battery, lithium, 32700, cell, or electronics, lock onto HAZARDOUS_EWASTE
        const combinedSafetyCheck = `${itemName} ${parsed.material || ""} ${(parsed.components || []).map((c: any) => `${c.name} ${c.material}`).join(" ")}`.toLowerCase();
        if (/battery|lithium|32700|18650|cell|power bank|accumulator|charger|circuit board|vape/i.test(combinedSafetyCheck)) {
          universalStream = "HAZARDOUS_EWASTE";
        }

        let customPrepSteps = Array.isArray(parsed.customPrepSteps) && parsed.customPrepSteps.length > 0
          ? parsed.customPrepSteps
          : [];

        if (universalStream === "HAZARDOUS_EWASTE") {
          const hasFire = customPrepSteps.some((s: string) => /fire|trash|recycling/i.test(s));
          const hasTape = customPrepSteps.some((s: string) => /tape|terminal/i.test(s));
          const hasDrop = customPrepSteps.some((s: string) => /drop|e-waste|kiosk|depot|center/i.test(s));
          const safetySteps: string[] = [];
          if (!hasFire) safetySteps.push("1. Do not place in regular trash or recycling due to fire risk.");
          if (!hasTape) safetySteps.push("2. Tape terminals with clear tape.");
          if (!hasDrop) safetySteps.push("3. Drop off at an authorized E-Waste center.");
          if (safetySteps.length > 0) {
            customPrepSteps = [...safetySteps, ...customPrepSteps];
          }
        }

        return {
          name: itemName,
          itemName,
          material: parsed.material || "Identified Material",
          universalStream: universalStream as UniversalWasteStream,
          confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "high",
          isUnclearImage: Boolean(parsed.isUnclearImage),
          components: Array.isArray(parsed.components) && parsed.components.length > 0
            ? parsed.components.map((c: any) => ({
                name: c.name || "Main Component",
                material: c.material || "Material",
                recyclability: c.recyclability || "Municipal Stream"
              }))
            : [{ name: "Main Body", material: parsed.material || "Material", recyclability: universalStream }],
          customPrepSteps: customPrepSteps.length > 0
            ? customPrepSteps
            : ["Empty contents and check local guidelines before binning."],
          clarificationQuestion: parsed.clarificationQuestion || null,
          needsClarification: Boolean(parsed.needsClarification)
        };
      }
    } catch (err: any) {
      lastError = err;
      // If 404 or model not found, try next candidate model
      if (err?.message?.includes("404") || err?.message?.includes("NOT_FOUND") || err?.message?.includes("not available")) {
        continue;
      }
      break;
    }
  }

  console.warn("Gemini vision API error, applying universal heuristic classification:", lastError?.message || lastError);
  return fallbackUniversalExtraction(textOrRegionHint || "Scanned Waste Item");
}
