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

const SYSTEM_INSTRUCTION = `You are WasteWise's expert computer vision waste auditor and material decomposition engine.
Your task is to visually inspect the pixels of the uploaded waste image (or text description) and output an accurate, structured, evidence-grounded classification.

You must follow a STRICT 3-STEP SCANNING CONTRACT for every single item:

### STEP 1: ITEM IDENTIFICATION
- Visually inspect the object in the photo. Accurately name the precise item detected with high technical specificity (e.g., "32700 Lithium-Ion Battery Cells", "Banana Peel", "Greasy Cardboard Pizza Box", "Aluminum Beverage Can", "Cracked Ceramic Coffee Mug", "Pharmaceutical Blister Pack", "Cotton T-Shirt").
- CRITICAL: NEVER output generic placeholders like "Captured Waste Item", "Scanned Object", or "General Packaging Material".
- Decompose the item into its physical constituent parts in the "components" array (e.g., [{ "name": "Main Body", "material": "Organic Plant Matter" }]).

### STEP 2: WASTE CLASSIFICATION (ONE OF 8 UNIVERSAL MUNICIPAL STREAMS)
Classify into ONE AND ONLY ONE of these exact 8 municipal categories:
1. COMPOST_ORGANIC: MUST trigger for all fruit peels (including banana peels, apple cores, citrus rinds), vegetable trimmings, food scraps, cooked food, coffee grounds, tea bags, and food-soiled/greasy paper & pizza boxes. (CRITICAL: NEVER classify food scraps, fruit matter, or banana peels as RECYCLABLE_CLEAN!).
2. HAZARDOUS_EWASTE: MUST trigger for all batteries (lithium-ion cells, 32700 cells, alkaline AA/AAA, button cells), electronics, power banks, chargers, cables, vapes, e-cigarettes, CFL/LED bulbs, chemicals, paint. (ABSOLUTE SAFETY RULE: NEVER classify batteries or electronics as RECYCLABLE_CLEAN or RESIDUAL_LANDFILL!).
3. RECYCLABLE_CLEAN: Clean rigid plastics (#1 PET, #2 HDPE, #5 PP), empty clean metal/aluminum cans, container glass bottles/jars, dry unsoiled cardboard/paper.
4. MEDICAL_SANITARY: Medicine blister packs, expired pharmaceuticals, syringes, sharps, test strips, masks, bandages, diapers, sanitary pads.
5. TEXTILE_DONATION: Wearable clothing, shoes, fabric scraps, bed linens, towels, clean garments.
6. CONSTRUCTION_INERT: Broken ceramics, porcelain mugs/plates, window/mirror glass, clay pots, concrete, bricks, tiles.
7. SOFT_PLASTIC_SPECIAL: Plastic grocery bags, flexible wrappers, chip packets, bubble wrap, multi-layer foil pouches.
8. RESIDUAL_LANDFILL: Poly-coated hot paper cups, heavily contaminated unrecyclable items, composite non-recyclable trash.

### STEP 3: PROPER DISPOSAL & PREPARATION
- Provide 2 to 3 actionable, item-specific preparation and disposal instructions.
- Examples:
  - For Banana Peel: ["1. Remove any plastic stickers or produce labels.", "2. Drain excess liquids.", "3. Place directly into the Green Municipal Wet / Compost bin."]
  - For Lithium Battery: ["1. Do not place in regular trash or recycling due to fire risk.", "2. Tape terminals with clear tape.", "3. Drop off at an authorized E-Waste center."]

OUTPUT JSON SCHEMA:
Return ONLY a valid JSON object matching:
{
  "itemName": "string",
  "material": "string",
  "universalStream": "COMPOST_ORGANIC" | "HAZARDOUS_EWASTE" | "RECYCLABLE_CLEAN" | "MEDICAL_SANITARY" | "TEXTILE_DONATION" | "CONSTRUCTION_INERT" | "SOFT_PLASTIC_SPECIAL" | "RESIDUAL_LANDFILL",
  "confidence": "high" | "medium" | "low",
  "components": [
    { "name": "string", "material": "string", "recyclability": "string" }
  ],
  "customPrepSteps": ["string", "string"],
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
  let apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  // Fallback: If not found in process.env, check root .env file directly
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE" || apiKey.length < 10) {
    try {
      const fs = require("fs");
      const path = require("path");
      const candidates = [
        path.resolve(process.cwd(), ".env.local"),
        path.resolve(process.cwd(), "../../.env"),
        path.resolve(process.cwd(), "../.env"),
        path.resolve(process.cwd(), ".env")
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, "utf-8");
          const m = raw.match(/GEMINI_API_KEY=([^\r\n]+)/);
          if (m && m[1] && m[1].trim().length > 10 && !m[1].includes("YOUR_")) {
            apiKey = m[1].trim();
            break;
          }
        }
      }
    } catch {}
  }

  // Fallback to offline extraction if still no valid API key
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE" || apiKey.startsWith("dummy") || apiKey.length < 10) {
    return fallbackUniversalExtraction(textOrRegionHint || "Scanned Waste Item");
  }

  // 1. Clean Base64: Strip data URL prefix and whitespace/newlines
  let cleanBase64 = base64Image;
  const prefixMatch = base64Image.match(/^data:([a-zA-Z0-9/+-]+);base64,([\s\S]+)$/);
  if (prefixMatch) {
    if (prefixMatch[1]) mimeType = prefixMatch[1];
    cleanBase64 = prefixMatch[2];
  } else {
    cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, "");
  }
  cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, "");

  // 2. Validate MIME type
  if (!mimeType || mimeType === "image/*" || mimeType === "image/jpg") {
    mimeType = "image/jpeg";
  }

  const ai = new GoogleGenAI({ apiKey });

  // 3. Multi-model resilience: Primary is gemini-3.8-flash
  const candidateModels = [
    process.env.GEMINI_MODEL || "gemini-3.8-flash",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
  ];
  // Deduplicate
  const modelsToTry = Array.from(new Set(candidateModels));

  const promptText = `Analyze the visual pixels of this waste image as an expert municipal waste auditor.
Follow the strict 3-step waste sorting contract:
- Step 1: Item Identification: Accurately name the precise item detected (e.g., "Banana Peel", "32700 Lithium-Ion Battery Cells", "Cracked Ceramic Coffee Mug") and list its physical materials. NEVER use generic names like "Captured Waste Item".
- Step 2: Waste Classification: Classify into EXACTLY ONE universal stream:
  * COMPOST_ORGANIC (for any food scrap, fruit peel, banana peel, vegetable trimmings, greasy paper)
  * HAZARDOUS_EWASTE (for all batteries, cells, electronics, cables, vapes)
  * RECYCLABLE_CLEAN (for clean metal cans, plastic bottles, container glass, clean paper)
  * MEDICAL_SANITARY (for medicine blister packs, needles, diapers)
  * TEXTILE_DONATION (for clothes, fabrics, garments)
  * CONSTRUCTION_INERT (for ceramics, broken mugs, bricks)
  * SOFT_PLASTIC_SPECIAL (for plastic bags, flexible pouches)
  * RESIDUAL_LANDFILL (for composite unrecyclable trash)
- Step 3: Proper Disposal & Preparation: Give 2-3 specific, actionable prep steps.
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

        // Double-Lock Safety Rules:
        const combinedSafetyCheck = `${itemName} ${parsed.material || ""} ${(parsed.components || []).map((c: any) => `${c.name} ${c.material}`).join(" ")}`.toLowerCase();

        // Safety 1: Batteries and Electronics MUST be HAZARDOUS_EWASTE
        if (/battery|lithium|32700|18650|cell|power bank|accumulator|charger|circuit board|vape/i.test(combinedSafetyCheck)) {
          universalStream = "HAZARDOUS_EWASTE";
        }

        // Safety 2: Fruit peels, banana peels, and food scraps MUST be COMPOST_ORGANIC
        if (/banana|peel|fruit|apple|vegetable|kitchen waste|food scrap|citrus|rind|tea bag|coffee ground/i.test(combinedSafetyCheck)) {
          universalStream = "COMPOST_ORGANIC";
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
        } else if (universalStream === "COMPOST_ORGANIC") {
          const hasSticker = customPrepSteps.some((s: string) => /sticker|label/i.test(s));
          const hasWetBin = customPrepSteps.some((s: string) => /green|compost|wet/i.test(s));
          const bioSteps: string[] = [];
          if (!hasSticker) bioSteps.push("1. Remove any plastic produce stickers or rubber bands.");
          if (!hasWetBin) bioSteps.push("2. Place directly into the Green Municipal Wet / Compost bin.");
          if (bioSteps.length > 0) {
            customPrepSteps = [...bioSteps, ...customPrepSteps];
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
