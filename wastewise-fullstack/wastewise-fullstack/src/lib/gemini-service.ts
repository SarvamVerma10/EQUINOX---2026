import { GoogleGenAI, type Model } from "@google/genai";

export type UniversalWasteStream =
  | "RECYCLABLE_CLEAN"
  | "COMPOST_ORGANIC"
  | "HAZARDOUS_EWASTE"
  | "MEDICAL_SANITARY"
  | "TEXTILE_DONATION"
  | "CONSTRUCTION_INERT"
  | "SOFT_PLASTIC_SPECIAL"
  | "RESIDUAL_LANDFILL"
  | "UNRESOLVED";

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

export function isGeminiModelOverloaded(error: unknown): boolean {
  if (error && typeof error === "object") {
    const providerError = error as { status?: unknown; code?: unknown };
    if (providerError.status === 503 || providerError.code === 503) return true;
  }

  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "";
  return /"code"\s*:\s*503\b|"status"\s*:\s*"UNAVAILABLE"|503\s*(?:Service Unavailable|UNAVAILABLE)|high demand/i.test(message);
}

export function isGeminiModelNotFound(error: unknown): boolean {
  if (error && typeof error === "object") {
    const providerError = error as { status?: unknown; code?: unknown };
    if (providerError.status === 404 || providerError.code === 404) return true;
  }

  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "";
  return /"code"\s*:\s*404\b|"status"\s*:\s*"NOT_FOUND"|404\s*(?:Not Found|NOT_FOUND)/i.test(message);
}

export function isGeminiModelTimedOut(error: unknown): boolean {
  if (error && typeof error === "object") {
    const providerError = error as { status?: unknown; code?: unknown };
    if (providerError.status === 504 || providerError.code === 504) return true;
  }

  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "";
  return /"code"\s*:\s*504\b|"status"\s*:\s*"DEADLINE_EXCEEDED"|deadline expired|timed out|operation was aborted|aborterror/i.test(message);
}

export function selectAvailableFlashModels(models: Model[], unavailableModel: string): string[] {
  const normalizedUnavailableModel = unavailableModel.replace(/^models\//, "");
  const eligibleModels = models
    .filter((model) => {
      const modelName = model.name?.replace(/^models\//, "").toLowerCase();
      const supportedActions = model.supportedActions?.map((action) => action.toLowerCase()) ?? [];
      if (!modelName || modelName === normalizedUnavailableModel.toLowerCase()) return false;
      if (!supportedActions.includes("generatecontent") || !/^gemini-\d+(?:\.\d+)?-flash(?:-|$)/.test(modelName)) return false;
      return !/(?:^|[-.])(?:2\.5|2\.0)(?:[-.]|$)|preview|image|audio|live|tts|embedding/i.test(modelName);
    })
    .sort((a, b) => {
      const nameA = a.name?.replace(/^models\//, "") ?? "";
      const nameB = b.name?.replace(/^models\//, "") ?? "";
      const litePriority = Number(nameB.includes("lite")) - Number(nameA.includes("lite"));
      if (litePriority !== 0) return litePriority;
      const versionA = Number(nameA.match(/^gemini-(\d+(?:\.\d+)?)-/)?.[1] ?? 0);
      const versionB = Number(nameB.match(/^gemini-(\d+(?:\.\d+)?)-/)?.[1] ?? 0);
      return versionB - versionA;
    });

  return eligibleModels
    .map((model) => model.name?.replace(/^models\//, ""))
    .filter((name): name is string => Boolean(name));
}

let availableFlashModelsCache: { models: Model[]; expiresAt: number } | null = null;

async function getAvailableFallbackModels(ai: GoogleGenAI, unavailableModel: string): Promise<string[]> {
  if (!availableFlashModelsCache || availableFlashModelsCache.expiresAt <= Date.now()) {
    const models: Model[] = [];
    const pager = await ai.models.list({
      config: {
        pageSize: 100,
        httpOptions: { timeout: 5_000, retryOptions: { attempts: 1 } }
      }
    });
    for await (const model of pager) {
      models.push(model);
    }
    availableFlashModelsCache = { models, expiresAt: Date.now() + 5 * 60_000 };
  }

  return selectAvailableFlashModels(availableFlashModelsCache.models, unavailableModel);
}

const SYSTEM_INSTRUCTION = `You are a multimodal waste-material identification assistant. Identify the actual object in the image, not just its broad appearance. Waste can be any household, commercial, industrial, agricultural, medical, construction, electronic, or hazardous item. Name the item specifically when the evidence supports it; describe each visibly distinct material/component separately. Distinguish container glass from window/mirror glass, rigid plastic from film, clean recyclables from contaminated items, and ordinary products from batteries, electronics, chemicals, medicines, and sharps.

Choose one universal stream only when the object/material evidence supports it: RECYCLABLE_CLEAN (clean paper/cardboard, container glass, accepted rigid plastics, and metals); COMPOST_ORGANIC (food scraps, yard trimmings, and compostable organics); HAZARDOUS_EWASTE (batteries, electronics, chemicals, paints, oils, lamps, and other hazardous waste); MEDICAL_SANITARY (medicines, sharps, clinical and sanitary waste); TEXTILE_DONATION (clothing and textiles); CONSTRUCTION_INERT (ceramics, masonry, and inert construction debris); SOFT_PLASTIC_SPECIAL (flexible films, bags, and wrappers); RESIDUAL_LANDFILL (known non-recoverable or contaminated residual waste). These are broad sorting streams, not claims that every locality accepts the item.

Never infer an unseen resin, chemical, contamination state, or local collection route. Never send batteries/electronics/chemicals/sharps to ordinary recycling or landfill, or food scraps to recycling. If the object, material, or relevant condition cannot be distinguished, set confidence to low, needsClarification to true, and explain what is uncertain. Return only valid JSON matching the requested schema.`;

/**
 * Fallback universal heuristic classifier for offline / mock testing when no valid Gemini key is configured
 */
export function fallbackUniversalExtraction(queryOrHint: string): IdentificationResult {
  const q = queryOrHint.toLowerCase();

  if (/\b(batter(?:y|ies)|lithium(?:-ion)?|alkaline|32700|18650|button cell|coin cell|power bank|accumulator)\b/.test(q)) {
    const batteryName = queryOrHint.trim() || "Battery";
    const batteryMaterial = /\balkaline\b/.test(q)
      ? "Alkaline electrochemical cell with a steel casing"
      : /\blithium\b|\b32700\b|\b18650\b/.test(q)
        ? "Lithium-based electrochemical cell; exact chemistry not verified"
        : "Battery chemistry and casing materials not identified";
    return {
      name: batteryName,
      itemName: batteryName,
      material: batteryMaterial,
      universalStream: "HAZARDOUS_EWASTE",
      confidence: "medium",
      components: [
        { name: "Battery casing", material: "Metal or polymer casing; exact material not verified", recyclability: "Dedicated battery collection" },
        { name: "Electrochemical cell", material: batteryMaterial, recyclability: "Dedicated battery collection" }
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

  if (/\b(ceramic|mug|porcelain|stoneware|pottery|clay pot|ceramic plate|ceramic dish)\b/.test(q)) {
    const itemName = queryOrHint.trim() || "Ceramic item";
    return {
      name: itemName,
      itemName,
      material: "Ceramic or porcelain",
      universalStream: "CONSTRUCTION_INERT",
      confidence: "medium",
      components: [
        { name: "Main item", material: "Ceramic or porcelain", recyclability: "Separate inert-material collection" }
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

  if (/\b(pizza box|greasy cardboard|food-soiled paper|food soiled paper)\b/.test(q)) {
    return {
      name: "Greasy Cardboard Pizza Box",
      itemName: "Greasy Cardboard Pizza Box",
      material: "Food-Soiled Corrugated Cardboard",
      universalStream: "COMPOST_ORGANIC",
      confidence: "medium",
      components: [
        { name: "Greasy Bottom Box", material: "Oil-Soiled Cardboard", recyclability: "Compostable Organics" },
        { name: "Clean Lid (if torn off)", material: "Unsoiled Cardboard", recyclability: "Dry Paper Recycling" }
      ],
      customPrepSteps: [
        "Remove food and any non-paper packaging.",
        "Separate clean, dry cardboard from grease-soiled portions when practical.",
        "Check the local guide for whether food-soiled cardboard belongs in organics or residual waste."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (/\b(shirt|clothing|clothes|textile|jeans|apparel|garment|fabric|cotton|linen|towel|bedding|shoes)\b/.test(q)) {
    const itemName = queryOrHint.trim() || "Textile item";
    return {
      name: itemName,
      itemName,
      material: /\bcotton\b/.test(q) ? "Cotton textile (blend/composition not verified)" : "Textile; fiber composition not verified",
      universalStream: "TEXTILE_DONATION",
      confidence: "medium",
      components: [
        { name: "Textile item", material: /\bcotton\b/.test(q) ? "Cotton textile; blend not verified" : "Textile; fiber not verified", recyclability: "Textile reuse or recovery" }
      ],
      customPrepSteps: [
        "Keep textiles dry and separate from wet or hazardous waste.",
        "Reuse or donate wearable items where a local program accepts them.",
        "Check local textile collection for damaged or unwearable items."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (/\b(blister pack|medicine|medication|pill|pharmaceutical|prescription|paracetamol|syringe|needle|sharps|bandage|diaper|nappy|sanitary pad)\b/.test(q)) {
    const itemName = queryOrHint.trim() || "Medical or sanitary waste";
    return {
      name: itemName,
      itemName,
      material: "Medical or sanitary waste; exact material composition not verified",
      universalStream: "MEDICAL_SANITARY",
      confidence: "medium",
      components: [
        { name: "Medical or sanitary item", material: "Composition not verified", recyclability: "Dedicated safe collection" }
      ],
      customPrepSteps: [
        "Keep medicines, sharps, and contaminated clinical items away from children.",
        "Do not place medical waste or mixed medicine packaging in ordinary recycling.",
        "Use a locally authorized pharmacy, clinical, or sanitary collection route."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (/\b(pet(?:\s*#?\s*1|\s+plastic|\s+bottle)|hdpe|plastic water bottle|plastic bottle|beverage bottle|glass bottle|glass jar|aluminum can|aluminium can|steel can|tin can|cardboard|clean paper|newspaper|office paper|metal can)\b/.test(q)) {
    const itemName = queryOrHint.trim() || "Recyclable container";
    const material = /\bglass\b/.test(q) ? "Container glass" :
      /\baluminum\b|\baluminium\b/.test(q) ? "Aluminum" :
      /\bsteel\b|\btin\b|\bmetal\b/.test(q) ? "Steel or metal; alloy not verified" :
      /\bpaper\b|\bcardboard\b/.test(q) ? "Paper or cardboard" :
      /\bhdpe\b/.test(q) ? "HDPE plastic" :
      /\bpet(?:\s*#?\s*1|\s+plastic|\s+bottle)\b/.test(q) ? "PET plastic" : "Plastic; resin not verified";
    return {
      name: itemName,
      itemName,
      material,
      universalStream: "RECYCLABLE_CLEAN",
      confidence: "medium",
      components: [
        { name: "Main item", material, recyclability: "Clean dry recycling if accepted locally" }
      ],
      customPrepSteps: [
        "Empty the item and remove food or liquid residue.",
        "Keep the material clean and dry.",
        "Confirm local acceptance before placing it in recycling."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (/\b(banana peel|fruit peel|apple core|fruit scraps|vegetable scraps|vegetable peel|food scraps|food waste|kitchen scraps|coffee grounds|tea leaves|tea bags|yard waste|grass clippings|leaves for compost|compostable organics)\b/.test(q) || (/\bbanana\b/.test(q) && /\bpeel\b/.test(q))) {
    const itemName = queryOrHint.trim() || "Organic waste";
    return {
      name: itemName,
      itemName,
      material: /\bgrass\b|\bleaves\b|\byard\b/.test(q) ? "Yard and plant matter" : "Food or plant-based organic matter",
      universalStream: "COMPOST_ORGANIC",
      confidence: "medium",
      components: [
        { name: "Organic material", material: /\bgrass\b|\bleaves\b|\byard\b/.test(q) ? "Plant and yard matter" : "Food or plant-based organic matter", recyclability: "Organics collection if accepted locally" }
      ],
      customPrepSteps: [
        "Keep organic material free from plastic and other non-compostable items.",
        "Drain excess liquid when applicable.",
        "Follow the local guide for accepted food and yard-organics collection."
      ],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (/\b(noodle packaging|instant noodle|ramen packaging|snack wrapper|plastic wrapper|foil pouch|flexible film|plastic bag|plastic grocery bag|bubble wrap|soft plastic)\b/.test(q)) {
    const itemName = queryOrHint.trim() || "Flexible plastic packaging";
    return {
      name: itemName,
      itemName,
      material: "Flexible plastic film or multilayer packaging; resin not verified",
      universalStream: "SOFT_PLASTIC_SPECIAL",
      confidence: "medium",
      components: /\b(noodle|ramen)\b/.test(q)
        ? [
            { name: "Outer wrapper", material: "Flexible plastic film; resin not verified", recyclability: "Soft-plastic recovery if locally accepted" },
            { name: "Inner sachet", material: "Possible multilayer laminate; composition not verified", recyclability: "Check local guide" }
          ]
        : [{ name: "Flexible item", material: "Plastic film; resin not verified", recyclability: "Soft-plastic recovery if locally accepted" }],
      customPrepSteps: [
        "Separate the outer clear wrapper from the inner seasoning and oil sachets.",
        "Empty all food seasoning residue completely.",
        "Check local store collection for soft flexible film; place soiled oil foil sachets in general trash."
      ],
      clarificationQuestion: /\b(noodle|ramen)\b/.test(q)
        ? "Which component are you disposing of: the outer wrapper or an inner sachet?"
        : null,
      needsClarification: /\b(noodle|ramen)\b/.test(q)
    };
  }

  if (/\b(coffee cup|hot cup|takeaway cup|polystyrene cup|styrofoam cup)\b/.test(q)) {
    const itemName = queryOrHint.trim() || "Disposable cup";
    return {
      name: itemName,
      itemName,
      material: "Disposable cup; lining and lid materials not verified",
      universalStream: "RESIDUAL_LANDFILL",
      confidence: "medium",
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

  if (/\b(e-waste|electronic waste|electronics|smartphone|mobile phone|cell phone|laptop|computer|tablet|circuit board|charger|usb cable|electrical cable|power adapter|vape|cfl|fluorescent lamp|led bulb)\b/.test(q)) {
    const title = queryOrHint.trim();
    return {
      name: title || "Electronic waste",
      itemName: title || "Electronic waste",
      material: "Electronic components and mixed materials; exact composition not verified",
      universalStream: "HAZARDOUS_EWASTE",
      confidence: "medium",
      components: [{ name: "Electronic item", material: "Mixed electronic materials", recyclability: "Dedicated e-waste collection" }],
      customPrepSteps: ["Do not place electronics in household recycling or general waste.", "Keep the item intact and dry.", "Use an authorized local e-waste collection route."],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (/\b(paint|pesticide|solvent|chemical|motor oil|engine oil|antifreeze|fuel|mercury|asbestos|hazardous waste|aerosol can)\b/.test(q)) {
    const title = queryOrHint.trim();
    return {
      name: title || "Potentially hazardous waste",
      itemName: title || "Potentially hazardous waste",
      material: "Potentially hazardous substance; contents must be confirmed",
      universalStream: "HAZARDOUS_EWASTE",
      confidence: "medium",
      components: [{ name: "Container or material", material: "Potentially hazardous; contents not verified", recyclability: "Household hazardous-waste collection" }],
      customPrepSteps: ["Do not pour the contents into drains or place them in ordinary bins.", "Keep the container closed and labeled if safe to do so.", "Contact the local household hazardous-waste program for its accepted drop-off route."],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (/\b(ceramic|porcelain|brick|bricks|concrete|masonry|rubble|construction debris|roof tile|floor tile|window glass|mirror glass)\b/.test(q)) {
    const title = queryOrHint.trim();
    return {
      name: title || "Ceramic or inert construction material",
      itemName: title || "Ceramic or inert construction material",
      material: "Ceramic, glass, or inert mineral material; verify the specific item",
      universalStream: "CONSTRUCTION_INERT",
      confidence: "medium",
      components: [{ name: "Main material", material: "Ceramic or inert mineral", recyclability: "Separate inert-material route" }],
      customPrepSteps: ["Keep inert construction material separate from container-glass recycling.", "Contain sharp fragments safely.", "Check local rules for inert or construction-waste drop-off."],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (/\b(aluminum foil|aluminium foil|steel|stainless steel|aluminum|aluminium|metal scrap|scrap metal|glass bottle|glass jar|clean paper|cardboard|paperboard|plastic resin|pet #?1|hdpe #?2|pp #?5|recyclable packaging)\b/.test(q)) {
    const title = queryOrHint.trim();
    return {
      name: title || "Clean recyclable material",
      itemName: title || "Clean recyclable material",
      material: "Material requires local acceptance and cleanliness verification",
      universalStream: "RECYCLABLE_CLEAN",
      confidence: "medium",
      components: [{ name: "Main material", material: title || "Paper, metal, glass, or identified plastic", recyclability: "Clean dry recycling if accepted locally" }],
      customPrepSteps: ["Empty the item and keep it clean and dry.", "Separate different materials when practical.", "Confirm that the item and material are accepted by the local recycling guide."],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  if (/\b(styrofoam|expanded polystyrene|cigarette butt|cigarette filter|contaminated waste|non-recyclable residue|general residual waste)\b/.test(q)) {
    const title = queryOrHint.trim();
    return {
      name: title || "Residual waste",
      itemName: title || "Residual waste",
      material: "Non-recoverable or contaminated residual material",
      universalStream: "RESIDUAL_LANDFILL",
      confidence: "medium",
      components: [{ name: "Main item", material: "Residual or contaminated material", recyclability: "Not identified as accepted recycling" }],
      customPrepSteps: ["Keep this material separate from clean recyclables and organics.", "Check the local guide for specialized collection options.", "Use residual disposal only when no safer recovery route is available."],
      clarificationQuestion: null,
      needsClarification: false
    };
  }

  const title = queryOrHint.trim() || "Unidentified waste item";
  return {
    name: title || "Unidentified waste item",
    itemName: title || "Unidentified waste item",
    material: "Unknown; visual or material identification is required",
    universalStream: "UNRESOLVED",
    confidence: "low",
    isUnclearImage: true,
    components: [],
    customPrepSteps: [],
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
          const m = raw.match(/^\s*GEMINI_API_KEY\s*=\s*(['"]?)([^'"\r\n]*?)\1\s*(?:#.*)?$/m);
          const configuredKey = m?.[2]?.trim();
          if (configuredKey && configuredKey.length > 10 && !configuredKey.includes("YOUR_")) {
            apiKey = configuredKey;
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

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 20_000,
      retryOptions: { attempts: 1 }
    }
  });

  const modelName = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const promptText = `Inspect the whole image and identify the most likely waste item, every visually distinguishable material/component, and its broad universal sorting stream. Consider ordinary, commercial, agricultural, construction, textile, medical, electronic, chemical, and industrial waste—not only common packaging.

Use exactly one stream when the evidence is sufficient: RECYCLABLE_CLEAN (accepted clean paper/cardboard, metal, container glass, rigid plastics); COMPOST_ORGANIC (food scraps, yard trimmings); HAZARDOUS_EWASTE (batteries, electronics, chemicals, oils, paints, lamps); MEDICAL_SANITARY (medicines, sharps, clinical/sanitary waste); TEXTILE_DONATION (clothing/fabrics); CONSTRUCTION_INERT (ceramics, masonry, inert building debris, window/mirror glass); SOFT_PLASTIC_SPECIAL (flexible films, bags, wrappers); RESIDUAL_LANDFILL (known contaminated or non-recoverable residuals). If the item, composition, or condition cannot be reliably distinguished, set universalStream to "UNRESOLVED", confidence to "low", needsClarification to true, and ask one concise question instead of guessing.

Report observable materials only; do not infer exact resin codes or chemical contents without visible evidence. Treat mixed products as separate components. Never classify batteries, electronics, chemicals, or sharps as ordinary recycling/landfill; never classify food scraps as recycling. Give concise, safe handling steps, but do not claim a local bin or collection route is verified. The local guide is checked separately.

LOW-QUALITY / BLURRY IMAGE RECOVERY: If the image is blurry, motion-blurred, dark, pixelated, or partially occluded, mentally reconstruct the object using shape silhouette, specular highlights (metallic vs. matte plastic vs. organic texture), color gradients, and partial packaging typography to accurately identify the specific itemName and universalStream instead of returning an unknown/generic label.
${textOrRegionHint ? `User-provided item context: "${textOrRegionHint}"` : ""}`;

  try {
      const contents = [
        {
          role: "user" as const,
          parts: [
            { inlineData: { data: cleanBase64, mimeType } },
            { text: promptText }
          ]
        }
      ];
      const configForModel = (model: string) => ({
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              itemName: { type: "string" },
              material: { type: "string" },
              universalStream: {
                type: "string",
                enum: [
                  "RECYCLABLE_CLEAN",
                  "COMPOST_ORGANIC",
                  "HAZARDOUS_EWASTE",
                  "MEDICAL_SANITARY",
                  "TEXTILE_DONATION",
                  "CONSTRUCTION_INERT",
                  "SOFT_PLASTIC_SPECIAL",
                  "RESIDUAL_LANDFILL",
                  "UNRESOLVED"
                ]
              },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              components: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    material: { type: "string" },
                    recyclability: { type: "string" }
                  },
                  required: ["name", "material", "recyclability"]
                }
              },
              customPrepSteps: { type: "array", items: { type: "string" } },
              clarificationQuestion: { type: "string", nullable: true },
              needsClarification: { type: "boolean" }
            },
            required: [
              "itemName",
              "material",
              "universalStream",
              "confidence",
              "components",
              "customPrepSteps",
              "clarificationQuestion",
              "needsClarification"
            ]
          },
          maxOutputTokens: 384,
          temperature: 0.1,
          ...(model === "gemini-3.8-flash" ? { thinkingLevel: "minimal" as const } : {}),
          ...(model === "gemini-2.5-flash" ? { thinkingConfig: { thinkingBudget: 0 } } : {})
      });
      const response = await (async () => {
        try {
          return await ai.models.generateContent({
            model: modelName,
            contents,
            config: configForModel(modelName)
          });
        } catch (error) {
          const modelTimedOut = isGeminiModelTimedOut(error);
          if (!isGeminiModelOverloaded(error) && !isGeminiModelNotFound(error) && !modelTimedOut) throw error;

          let fallbackModels: string[];
          try {
            fallbackModels = await getAvailableFallbackModels(ai, modelName);
          } catch (catalogError) {
            console.warn("Could not discover an available Gemini fallback model.", catalogError);
            throw error;
          }
          if (fallbackModels.length === 0) throw error;

          let lastFallbackError: unknown = error;
          const fallbackClient = modelTimedOut
            ? new GoogleGenAI({
                apiKey,
                httpOptions: { timeout: 12_000, retryOptions: { attempts: 1 } }
              })
            : ai;
          const maxFallbacks = modelTimedOut ? 1 : 2;
          for (const fallbackModel of fallbackModels.slice(0, maxFallbacks)) {
            console.warn(`Gemini model ${modelName} is unavailable; trying listed model ${fallbackModel}.`);
            try {
              return await fallbackClient.models.generateContent({
                model: fallbackModel,
                contents,
                config: configForModel(fallbackModel)
              });
            } catch (fallbackError) {
              lastFallbackError = fallbackError;
              if (
                !isGeminiModelOverloaded(fallbackError) &&
                !isGeminiModelNotFound(fallbackError) &&
                !isGeminiModelTimedOut(fallbackError)
              ) {
                throw fallbackError;
              }
            }
          }
          throw lastFallbackError;
        }
      })();

      const rawText = response.text || "";
      let parsed: any;
      try {
        let cleaned = rawText.trim();
        if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error("Gemini returned an invalid identification response. Please retry with a clearer photo.");
      }

      if (!parsed || !(parsed.itemName || parsed.name)) {
        throw new Error("Gemini could not identify the item. Please retry with a clearer photo.");
      }

        let itemName = (parsed.itemName || parsed.name || "Scanned Waste Item").trim();
        const isValidStream = [
          "RECYCLABLE_CLEAN",
          "COMPOST_ORGANIC",
          "HAZARDOUS_EWASTE",
          "MEDICAL_SANITARY",
          "TEXTILE_DONATION",
          "CONSTRUCTION_INERT",
          "SOFT_PLASTIC_SPECIAL",
          "RESIDUAL_LANDFILL"
        ].includes(parsed.universalStream);
        let universalStream: UniversalWasteStream = isValidStream
          ? parsed.universalStream
          : "UNRESOLVED";

        // Double-Lock Safety Rules:
        const combinedSafetyCheck = `${itemName} ${parsed.material || ""} ${(parsed.components || []).map((c: any) => `${c.name} ${c.material}`).join(" ")}`.toLowerCase();

        // Override unsafe model output only when an explicit hazardous item is identified.
        if (/\b(battery|batteries|lithium|32700|18650|power bank|accumulator|charger|circuit board|electronic waste|e-waste|vape|pesticide|solvent|paint|mercury|asbestos)\b/i.test(combinedSafetyCheck)) {
          universalStream = "HAZARDOUS_EWASTE";
        }

        if (/\b(banana peel|fruit peel|apple core|vegetable scraps|food scraps|kitchen scraps|citrus rind|tea leaves|coffee grounds)\b/i.test(combinedSafetyCheck) && universalStream !== "HAZARDOUS_EWASTE") {
          universalStream = "COMPOST_ORGANIC";
        }

        let customPrepSteps = Array.isArray(parsed.customPrepSteps) && parsed.customPrepSteps.length > 0
          ? parsed.customPrepSteps
          : [];

        const isBattery = /\b(battery|batteries|lithium|32700|18650|button cell|coin cell|power bank|accumulator)\b/i.test(combinedSafetyCheck);
        if (universalStream === "HAZARDOUS_EWASTE" && isBattery) {
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
          confidence: isValidStream && ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
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
          clarificationQuestion: isValidStream ? (parsed.clarificationQuestion || null) : null,
          needsClarification: isValidStream && Boolean(parsed.needsClarification)
        };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "provider unavailable";
    throw new Error(`Gemini waste identification failed: ${message}`);
  }
}
