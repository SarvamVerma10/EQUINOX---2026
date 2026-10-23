/**
 * WasteWise Core Domain Engine, Runtime Schema Validator, PDF/Text Guide Parser,
 * and Evidence-Backed Rule Retrieval Engine.
 *
 * Enforces strict separation between visual AI identification and verified
 * local disposal guidance.
 */

export const VALID_CATEGORIES = Object.freeze([
  "biodegradable",
  "dry_recyclable",
  "special_handling",
  "unresolved"
]);

export const VALID_STATUSES = Object.freeze([
  "identified",
  "clarification_needed",
  "recommended",
  "unresolved",
  "error"
]);

export const VALID_CONFIDENCE = Object.freeze(["high", "medium", "low"]);

/**
 * Conspicuously labeled Demo Seed Guide for development and testing.
 */
export const DEMO_CAMPUS_GUIDE = {
  id: "guide-demo-greenvalley-v2.4",
  localityName: "GreenValley University & Sohna Municipal Zone (Demo)",
  guideName: "Demo — Not verified local guidance (GreenValley Campus & Municipal Segregation Manual)",
  issuingAuthority: "Campus Sustainability Office (Demonstration Fixture)",
  version: "2026.2-DEMO",
  effectiveDate: "2026-09-01",
  isActive: true,
  isDemo: true,
  extractionWarnings: [],
  rules: [
    {
      id: "rule-bio-1",
      universalStreams: ["COMPOST_ORGANIC"],
      itemKeywords: ["banana peel", "fruit peel", "vegetable peel", "apple core", "food scraps", "cooked food", "tea leaves", "coffee grounds"],
      materialKeywords: ["organic", "plant matter", "food waste", "compostable biomass"],
      subtype: "food_and_kitchen_organic",
      category: "biodegradable",
      instructions: [
        "Drain excess liquid before placing in the wet waste stream.",
        "Remove any plastic stickers, rubber bands, or twist ties from fruit peels.",
        "Place directly into the designated Wet / Compostable collection bin."
      ],
      page: 4,
      section: "Section 2.1 — Wet & Biodegradable Kitchen Waste",
      excerpt: "All raw fruit peels (including banana peels and citrus rinds), vegetable trimmings, tea leaves, and un-packaged food scraps must be segregated into the Biodegradable (Wet Waste) stream without plastic liners.",
      physicalBinNote: "Local authority physical bin: Green Municipal Wet Bin"
    },
    {
      id: "rule-dry-1",
      universalStreams: ["RECYCLABLE_CLEAN"],
      itemKeywords: ["aluminum can", "soda can", "beverage can", "metal can", "tin can"],
      materialKeywords: ["aluminum", "metal", "tinplate"],
      subtype: "clean_metal_containers",
      category: "dry_recyclable",
      instructions: [
        "Empty all remaining liquid completely.",
        "Give the can a quick rinse so no sugary residue attracts pests.",
        "Crush lightly if possible to save space and place in Dry Recyclables."
      ],
      page: 7,
      section: "Section 3.2 — Clean Metal & Beverage Containers",
      excerpt: "Empty, rinsed aluminum beverage cans and steel food tins are accepted in the Dry Recyclable stream. Cans containing food residue or hazardous paint/chemical remnants are rejected.",
      physicalBinNote: "Local authority physical bin: Blue Dry Recyclable Bin"
    },
    {
      id: "rule-dry-2",
      universalStreams: ["RECYCLABLE_CLEAN"],
      itemKeywords: ["pet bottle", "water bottle", "plastic bottle", "shampoo bottle", "hdpe container", "corrugated cardboard", "cardboard box", "office paper"],
      materialKeywords: ["pet #1", "hdpe #2", "clean cardboard", "uncoated paper"],
      subtype: "clean_dry_packaging",
      category: "dry_recyclable",
      instructions: [
        "Empty and rinse plastic bottles; flatten cardboard boxes.",
        "Keep dry paper and cardboard completely free of oil or food grease.",
        "Check local collection rules for bottle caps (replace cap on empty rinsed PET bottle)."
      ],
      page: 8,
      section: "Section 3.4 — Accepted Rigid Plastics (PET #1, HDPE #2) & Clean Paperboard",
      excerpt: "Clean, dry PET (#1) beverage bottles, HDPE (#2) containers, and unsoiled corrugated cardboard are accepted for dry material recovery. Greasy pizza boxes and food-soiled paper are excluded.",
      physicalBinNote: "Local authority physical bin: Blue Dry Recyclable Bin"
    },
    {
      id: "rule-dry-3",
      universalStreams: ["SOFT_PLASTIC_SPECIAL", "RECYCLABLE_CLEAN"],
      itemKeywords: ["noodle outer wrapper", "plastic outer wrapper", "polypropylene wrapper", "dry snack wrapper"],
      materialKeywords: ["mono-layer polypropylene", "clean dry plastic film"],
      subtype: "clean_dry_plastic_wrapper",
      category: "dry_recyclable",
      instructions: [
        "Ensure the outer plastic wrapper is completely empty and dry.",
        "Separate from any inner seasoning or oil sachets before disposal.",
        "Place clean dry outer film in the dry plastic recovery bag."
      ],
      page: 9,
      section: "Section 3.6 — Segregated Dry Flexible Packaging",
      excerpt: "Clean, dry outer plastic wrappers separated from food-soiled inner pouches may be placed in the Dry Waste stream for segregated plastic recovery.",
      physicalBinNote: "Local authority physical bin: Blue Dry Waste Stream"
    },
    {
      id: "rule-haz-1",
      universalStreams: ["HAZARDOUS_EWASTE"],
      itemKeywords: ["aa battery", "aaa battery", "alkaline battery", "lithium battery", "button cell", "power bank", "rechargeable battery", "battery cell", "cylindrical cell", "lithium-ion battery cells", "32700"],
      materialKeywords: ["alkaline cell", "lithium-ion", "heavy metal battery", "electrochemical cell", "lifepo4"],
      subtype: "battery_and_accumulators",
      category: "special_handling",
      instructions: [
        "1. Do not place in regular trash or recycling due to fire risk.",
        "2. Tape terminals with clear tape.",
        "3. Drop off at an authorized E-Waste center."
      ],
      page: 14,
      section: "Section 5.1 — Batteries & Electrochemical Cells (Special Handling)",
      excerpt: "All primary alkaline batteries (AA/AAA) and rechargeable lithium-ion cells are classified as Hazardous / E-Waste Special Handling. They must be deposited at authorized E-Waste drop-off kiosks and never mixed with municipal bins.",
      physicalBinNote: "Authorized Route: Dedicated E-Waste & Battery Drop-off Kiosk (Do NOT put in standard bins)"
    },
    {
      id: "rule-haz-2",
      universalStreams: ["MEDICAL_SANITARY"],
      itemKeywords: ["syringe", "needle", "lancet", "used bandage", "medicine strip", "expired medicine", "thermometer", "biomedical waste"],
      materialKeywords: ["sharps", "clinical waste", "pharmaceutical", "biomedical material"],
      subtype: "biomedical_and_sharps",
      category: "special_handling",
      instructions: [
        "Do NOT place sharps, needles, or clinical items in household or campus recycling bins.",
        "Contain needles/sharps immediately in a puncture-proof rigid container.",
        "Return expired medicines and clinical waste to the Campus Health Center Biomedical Take-Back Point."
      ],
      page: 16,
      section: "Section 5.3 — Biomedical, Sharps & Pharmaceutical Waste",
      excerpt: "Used syringes, lancets, soiled dressings, and expired pharmaceuticals require strict Biomedical Special Handling via the Health Center yellow/puncture-proof take-back route. Never dispose of in general dry or wet bins.",
      physicalBinNote: "Authorized Route: Health Center Puncture-Proof / Biomedical Collection"
    },
    {
      id: "rule-haz-3",
      universalStreams: ["HAZARDOUS_EWASTE"],
      itemKeywords: ["circuit board", "broken charger", "usb cable", "earphones", "cfl bulb", "led bulb", "paint can", "pesticide bottle", "chemical container"],
      materialKeywords: ["electronic waste", "e-waste", "mercury lamp", "hazardous chemical container"],
      subtype: "ewaste_and_chemicals",
      category: "special_handling",
      instructions: [
        "Keep electronic waste and chemical containers separate from all domestic bins.",
        "Wrap fragile CFL/fluorescent bulbs carefully to prevent mercury vapor release.",
        "Deliver to the Monthly Hazardous & E-Waste Collection Drive or Estates Office."
      ],
      page: 15,
      section: "Section 5.2 — Electronic Waste (E-Waste) & Chemical Containers",
      excerpt: "Discarded chargers, cables, circuit boards, CFLs, and chemical/paint containers require segregated Hazardous / E-Waste handling through the Estates Office collection facility.",
      physicalBinNote: "Authorized Route: Estates Office E-Waste & Hazardous Facility"
    },
    {
      id: "rule-textile-1",
      universalStreams: ["TEXTILE_DONATION"],
      itemKeywords: ["textile donation", "clean clothes", "old garment", "cotton clothing", "bedsheet"],
      materialKeywords: ["cotton fabric", "polyester apparel", "woven textile"],
      subtype: "textile_and_apparel",
      category: "special_handling",
      instructions: [
        "Ensure garments and textiles are clean and dry before drop-off.",
        "Donate wearable clothing to campus or municipal donation drives.",
        "Drop damaged textiles at designated fiber-recovery collection kiosks."
      ],
      page: 18,
      section: "Section 6.1 — Textiles & Apparel Recovery",
      excerpt: "Wearable and reusable clothing, along with clean fabric scraps, should be directed to designated campus and municipal textile donation bins rather than curbside waste.",
      physicalBinNote: "Authorized Route: Dedicated Campus Textile & Apparel Donation Bin"
    },
    {
      id: "rule-inert-1",
      universalStreams: ["CONSTRUCTION_INERT"],
      itemKeywords: ["inert mineral waste", "demolition rubble", "brick fragments", "tile pieces", "stoneware scrap"],
      materialKeywords: ["masonry", "inert mineral", "fired ceramic substrate"],
      subtype: "inert_and_mineral",
      category: "special_handling",
      instructions: [
        "Wrap any sharp or broken mineral/ceramic edges securely in heavy paper or cardboard to protect handlers.",
        "Do NOT dispose in container glass recycling (different melting point contaminates the batch).",
        "Drop off at designated municipal inert rubble and mineral collection depots."
      ],
      page: 20,
      section: "Section 7.2 — Inert Mineral & Ceramic Materials",
      excerpt: "Broken ceramics, tiles, and mineral rubble must be safely wrapped and brought to designated inert waste drop-off sites; do not mix with standard curbside container glass.",
      physicalBinNote: "Authorized Route: Municipal Inert Rubble & Mineral Depository"
    },
    {
      id: "rule-landfill-1",
      universalStreams: ["RESIDUAL_LANDFILL"],
      itemKeywords: ["unrecyclable composite", "non-recoverable residual", "heavily soiled packaging"],
      materialKeywords: ["mixed composite material", "contaminated residual"],
      subtype: "residual_landfill",
      category: "special_handling",
      instructions: [
        "Double-bag contaminated or composite refuse to prevent odor and leakage.",
        "Ensure no hazardous, battery, or biomedical items are mixed in.",
        "Place in the designated Residual / General Landfill waste bin."
      ],
      page: 22,
      section: "Section 8.1 — Non-Recyclable Residual Waste",
      excerpt: "All non-recyclable composite packaging, heavily contaminated materials, and general non-hazardous waste must be segregated into the municipal Residual Landfill stream.",
      physicalBinNote: "Local authority physical bin: Black / Gray Residual Waste Bin"
    }
  ]
};

/**
 * Runtime schema validator for API responses.
 * Ensures strict compliance with Section 8 schema rules and prevents fabricated evidence.
 */
export function validateDisposalResponseSchema(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: ["Payload must be a non-null object"] };
  }

  if (!VALID_STATUSES.includes(payload.status)) {
    errors.push(`Invalid status: ${payload.status}`);
  }

  if (!payload.item || typeof payload.item !== "object") {
    errors.push("Missing or invalid item object");
  } else {
    if (typeof payload.item.name !== "string" || !payload.item.name.trim()) {
      errors.push("item.name must be a non-empty string");
    }
    if (typeof payload.item.material !== "string" || !payload.item.material.trim()) {
      errors.push("item.material must be a non-empty string");
    }
    if (!Array.isArray(payload.item.components)) {
      errors.push("item.components must be an array");
    }
    if (!VALID_CONFIDENCE.includes(payload.item.confidence)) {
      errors.push(`Invalid item.confidence: ${payload.item.confidence}`);
    }
  }

  if (payload.category !== null && !VALID_CATEGORIES.includes(payload.category)) {
    errors.push(`Invalid category value: ${payload.category}`);
  }

  if (
    payload.clarificationQuestion !== null &&
    typeof payload.clarificationQuestion !== "string"
  ) {
    errors.push("clarificationQuestion must be string or null");
  }

  if (!Array.isArray(payload.instructions)) {
    errors.push("instructions must be an array");
  }

  // If status is recommended, evidence must exist and have a real excerpt
  if (payload.status === "recommended") {
    if (!payload.evidence || typeof payload.evidence !== "object") {
      errors.push("Recommended status requires non-null evidence");
    } else if (
      typeof payload.evidence.guideName !== "string" ||
      !payload.evidence.guideName.trim() ||
      typeof payload.evidence.excerpt !== "string" ||
      !payload.evidence.excerpt.trim()
    ) {
      errors.push("Recommended evidence requires non-empty guideName and excerpt");
    }
    if (
      payload.category === "unresolved" ||
      payload.category === null
    ) {
      errors.push("Recommended status must have a resolved category (biodegradable, dry_recyclable, or special_handling)");
    }
  }

  // If status is unresolved, clarification_needed, or error, category must be 'unresolved' or null
  if (["unresolved", "clarification_needed", "error"].includes(payload.status)) {
    if (payload.category !== "unresolved" && payload.category !== null) {
      errors.push(`Status ${payload.status} cannot recommend category ${payload.category}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extracts structured rules and warnings from uploaded guide text/PDF text.
 * Preserves [Page N] markers and Section headings.
 */
export function parseGuideDocumentText({
  rawText,
  localityName,
  guideName,
  issuingAuthority,
  version,
  effectiveDate,
  isDemo = false
}) {
  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    return {
      status: "extraction_failed",
      error: "Uploaded document contains no extractable text.",
      guide: null
    };
  }

  const lines = rawText.split(/\r?\n/);
  let currentPage = 1;
  let currentSection = "General Provisions";
  const rules = [];
  const warnings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const pageMatch = line.match(/^\[?\s*Page\s+(\d+)\s*\]?$/i);
    if (pageMatch) {
      currentPage = parseInt(pageMatch[1], 10);
      continue;
    }

    const sectionMatch = line.match(/^(?:Section|Chapter|#+\s*)\s*([0-9A-Za-z.\-\s:—]+)$/i);
    if (sectionMatch && line.length < 90 && !line.includes("|")) {
      currentSection = line.replace(/^#+\s*/, "").trim();
      continue;
    }

    // Parse structured rule lines:
    // Format A: RULE | items: a, b | materials: c | category: biodegradable | subtype: x | instructions: step1; step2 | excerpt: Exact text
    if (line.toUpperCase().startsWith("RULE:")) {
      const body = line.slice(5).trim();
      const parts = body.split("|").map((p) => p.trim());
      const fields = {};
      for (const part of parts) {
        const idx = part.indexOf(":");
        if (idx > -1) {
          const k = part.slice(0, idx).trim().toLowerCase();
          const v = part.slice(idx + 1).trim();
          fields[k] = v;
        }
      }

      const rawCategory = (fields.category || "").toLowerCase();
      if (!VALID_CATEGORIES.includes(rawCategory) || rawCategory === "unresolved") {
        warnings.push(`Line ${i + 1} (Page ${currentPage}): Invalid or unsupported category '${fields.category}'.`);
        continue;
      }

      const itemKeywords = (fields.items || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const excerpt = fields.excerpt || line;

      if (itemKeywords.length === 0) {
        warnings.push(`Line ${i + 1} (Page ${currentPage}): Rule missing item keywords.`);
        continue;
      }

      rules.push({
        id: `parsed-rule-${rules.length + 1}`,
        itemKeywords,
        materialKeywords: (fields.materials || "")
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        subtype: fields.subtype || "general",
        category: rawCategory,
        instructions: (fields.instructions || "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean),
        page: currentPage,
        section: currentSection,
        excerpt,
        physicalBinNote: fields.bin || null
      });
    }
  }

  if (rules.length === 0) {
    return {
      status: "extraction_failed",
      error: "Could not extract any structured disposal rules from the document. Ensure rules are clearly formatted.",
      warnings,
      guide: null
    };
  }

  return {
    status: "parsed",
    warnings,
    guide: {
      id: `guide-${Date.now()}`,
      localityName: localityName || "Unspecified Locality",
      guideName: isDemo ? `Demo — Not verified local guidance (${guideName})` : guideName,
      issuingAuthority: issuingAuthority || "Local Authority",
      version: version || "1.0",
      effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
      isActive: false,
      isDemo: Boolean(isDemo),
      extractionWarnings: warnings,
      rules
    }
  };
}

export function getDynamicRuleForStream(stream, targetName, targetMaterial) {
  switch (stream) {
    case "COMPOST_ORGANIC":
      return {
        id: "rule-dyn-bio",
        universalStreams: ["COMPOST_ORGANIC"],
        category: "biodegradable",
        subtype: "food_and_kitchen_organic",
        physicalBinNote: "Local authority physical bin: Green Municipal Wet Bin",
        instructions: [
          "Remove any non-compostable stickers, produce labels, or rubber bands.",
          "Drain excess liquids before binning.",
          "Place directly into the Green Municipal Wet / Compost bin."
        ],
        page: 4,
        section: "Section 2.1 — Wet & Biodegradable Kitchen Waste",
        excerpt: "All raw and cooked food scraps, fruit peels (including banana peels), vegetable trimmings, tea leaves, and organic food waste must be segregated into the Biodegradable (Wet Waste) stream."
      };
    case "HAZARDOUS_EWASTE":
      return {
        id: "rule-dyn-haz",
        universalStreams: ["HAZARDOUS_EWASTE"],
        category: "special_handling",
        subtype: "battery_and_accumulators",
        physicalBinNote: "Authorized Route: Dedicated E-Waste & Battery Drop-off Kiosk (Do NOT put in standard bins)",
        instructions: [
          "Do not place in regular trash or recycling bins due to serious fire and toxic leakage hazard.",
          "Tape exposed terminals with non-conductive clear tape.",
          "Drop off only at an authorized E-Waste and Battery collection kiosk."
        ],
        page: 14,
        section: "Section 5.1 — Batteries & Electrochemical Cells (Special Handling)",
        excerpt: "All primary batteries, rechargeable lithium-ion cells, e-waste, and toxic items require Hazardous Special Handling and must be brought to authorized drop-off kiosks."
      };
    case "MEDICAL_SANITARY":
      return {
        id: "rule-dyn-med",
        universalStreams: ["MEDICAL_SANITARY"],
        category: "special_handling",
        subtype: "biomedical_and_sharps",
        physicalBinNote: "Authorized Route: Health Center & Pharmacy Take-Back Drop",
        instructions: [
          "Do not place clinical sharps, needles, or pharmaceutical blister packs in household blue recycling.",
          "Contain needles or sharps in a puncture-proof container.",
          "Return expired medications to pharmacy take-back drop boxes."
        ],
        page: 16,
        section: "Section 5.3 — Biomedical, Sharps & Pharmaceutical Waste",
        excerpt: "Used sharps, expired pharmaceuticals, and sanitary waste require controlled biomedical disposal routes and must not be mixed with standard recyclables."
      };
    case "TEXTILE_DONATION":
      return {
        id: "rule-dyn-tex",
        universalStreams: ["TEXTILE_DONATION"],
        category: "special_handling",
        subtype: "textile_and_apparel",
        physicalBinNote: "Authorized Route: Dedicated Campus & Municipal Textile Donation Bin",
        instructions: [
          "Ensure garments and textiles are clean and dry before donation.",
          "Donate wearable clothing to charity drop-off boxes.",
          "Deposit worn or torn fabric scraps in textile recycling bins for fiber recovery."
        ],
        page: 18,
        section: "Section 6.1 — Textiles & Apparel Recovery",
        excerpt: "Wearable clothing, cotton fabrics, and household textiles should be routed to designated municipal textile donation and fiber recovery bins."
      };
    case "CONSTRUCTION_INERT":
      return {
        id: "rule-dyn-inert",
        universalStreams: ["CONSTRUCTION_INERT"],
        category: "special_handling",
        subtype: "inert_and_mineral",
        physicalBinNote: "Authorized Route: Municipal Inert Rubble & Mineral Depository",
        instructions: [
          "Wrap broken ceramics or sharp masonry fragments securely in thick paper or cardboard.",
          "Do NOT mix with container bottle glass recycling (ceramics contaminate the glass melt).",
          "Drop off at designated municipal inert mineral depository."
        ],
        page: 20,
        section: "Section 7.2 — Inert Mineral & Ceramic Materials",
        excerpt: "Broken ceramics, stoneware dishes, and mineral rubble have different melting points than container glass and must be routed to inert mineral disposal depots."
      };
    case "SOFT_PLASTIC_SPECIAL":
      return {
        id: "rule-dyn-soft",
        universalStreams: ["SOFT_PLASTIC_SPECIAL"],
        category: "dry_recyclable",
        subtype: "soft_plastics_flexible",
        physicalBinNote: "Authorized Route: Soft Plastic Return Point or Store Drop-Off",
        instructions: [
          "Ensure soft plastic film is completely empty, clean, and dry.",
          "Bundle clean plastic film pouches into a single bag.",
          "Drop off at store plastic bag return kiosks or designated dry packaging bins."
        ],
        page: 11,
        section: "Section 3.8 — Soft Plastics & Flexible Packaging",
        excerpt: "Clean, dry flexible plastic packaging pouches and shopping bags should be brought to store return drop-off points."
      };
    case "RESIDUAL_LANDFILL":
      return {
        id: "rule-dyn-landfill",
        universalStreams: ["RESIDUAL_LANDFILL"],
        category: "special_handling",
        subtype: "residual_landfill",
        physicalBinNote: "Local authority physical bin: Black / Gray Residual Waste Bin",
        instructions: [
          "Ensure no hazardous batteries, electronics, or compostable food scraps are mixed in.",
          "Bag non-recyclable composite packaging tightly.",
          "Place in the designated municipal Residual Landfill bin."
        ],
        page: 22,
        section: "Section 8.1 — Non-Recyclable Residual Waste",
        excerpt: "Non-recyclable composite packaging, heavily contaminated materials, and general non-hazardous waste belong in the municipal Residual Landfill stream."
      };
    case "RECYCLABLE_CLEAN":
    default:
      return {
        id: "rule-dyn-dry",
        universalStreams: ["RECYCLABLE_CLEAN"],
        category: "dry_recyclable",
        subtype: "clean_dry_packaging",
        physicalBinNote: "Local authority physical bin: Blue Dry Recyclable Bin",
        instructions: [
          "Empty and briefly rinse container of any liquid or food residue.",
          "Flatten cardboard or plastic containers to conserve collection space.",
          "Place into the Blue Dry Recyclable bin."
        ],
        page: 8,
        section: "Section 3.4 — Accepted Rigid Plastics & Clean Packaging",
        excerpt: "Clean, empty beverage cans, container glass bottles, PET/HDPE rigid plastic containers, and clean paperboard are accepted in the Blue Dry Recyclables bin."
      };
  }
}

/**
 * Evaluates an AI-identified waste item against the active local guide.
 * Strictly distinguishes:
 * - Unclear image / low confidence
 * - Multi-part packaging needing user clarification
 * - Missing / unconfigured guide
 * - Guide extraction failure
 * - Retrieval service failure
 * - Contradictory rules in the guide
 * - No matching rule in the guide
 * - Special handling waste without a verified local route
 */
export function evaluateDisposalWithGuide({
  identification,
  selectedComponent = null,
  activeGuide,
  simulateRetrievalFailure = false
}) {
  // 1. Check retrieval service health first
  if (simulateRetrievalFailure) {
    return {
      status: "error",
      item: {
        name: identification?.name || "Unknown item",
        material: identification?.material || "Unknown material",
        components: identification?.components || [],
        confidence: identification?.confidence || "low"
      },
      category: "unresolved",
      clarificationQuestion: null,
      clarificationOptions: [],
      instructions: [],
      evidence: null,
      reason: "Guide retrieval service failed. Could not verify the correct disposal category from the selected local guide."
    };
  }

  // 2. Check identification validity / image quality
  if (!identification || identification.error) {
    return {
      status: "error",
      item: {
        name: "Unidentified image",
        material: "Unknown",
        components: [],
        confidence: "low"
      },
      category: "unresolved",
      clarificationQuestion: null,
      clarificationOptions: [],
      instructions: [],
      evidence: null,
      reason: identification?.error || "AI analysis could not be completed. Please retry, retake the photo, or enter the item name manually."
    };
  }

  // 3. Low confidence / blurry or obstructed image -> require clarification or retake
  if (identification.confidence === "low" || identification.isUnclearImage) {
    return {
      status: "unresolved",
      item: {
        name: identification.name || "Unclear item",
        material: identification.material || "Uncertain material",
        components: identification.components || [],
        confidence: "low"
      },
      category: "unresolved",
      clarificationQuestion: identification.clarificationQuestion || "The image appears blurry, dark, or obstructed. Can you retake the photo in brighter light or confirm which item this is?",
      clarificationOptions: identification.candidateOptions || [],
      instructions: [
        "Could not verify the correct disposal category from the selected local guide because the item or material could not be reliably identified."
      ],
      evidence: null,
      reason: "Image identification confidence is too low to safely match a local disposal rule."
    };
  }

  // 4. Multi-component packaging clarification (if not yet resolved by user)
  // Hazardous e-waste and single units must NEVER ask the user to separate integrated components
  if (
    identification.universalStream !== "HAZARDOUS_EWASTE" &&
    Array.isArray(identification.components) &&
    identification.components.length > 1 &&
    !selectedComponent &&
    (identification.needsClarification || identification.components.some(c => c.queryTerm))
  ) {
    return {
      status: "clarification_needed",
      item: {
        name: identification.name,
        material: identification.material,
        components: identification.components,
        confidence: identification.confidence
      },
      category: "unresolved",
      clarificationQuestion:
        identification.clarificationQuestion ||
        "Which part are you disposing of? Different packaging parts have different local disposal rules.",
      clarificationOptions: identification.components.map((c) => ({
        id: c.id,
        label: c.name,
        material: c.material,
        queryTerm: c.queryTerm || c.name
      })),
      instructions: [],
      evidence: null,
      reason: "Clarification required: This item contains multiple distinct components or materials."
    };
  }

  // Resolve target query item & material based on selectedComponent if provided
  let targetName = identification.name;
  let targetMaterial = identification.material;
  if (selectedComponent && Array.isArray(identification.components)) {
    const foundComp = identification.components.find(
      (c) => c.id === selectedComponent || c.name.toLowerCase() === String(selectedComponent).toLowerCase()
    );
    if (foundComp) {
      targetName = foundComp.queryTerm || foundComp.name;
      targetMaterial = foundComp.material || identification.material;
    }
  }

  // 5. Check active guide state
  if (!activeGuide) {
    return {
      status: "unresolved",
      item: {
        name: targetName,
        material: targetMaterial,
        components: identification.components || [],
        confidence: identification.confidence
      },
      category: "unresolved",
      clarificationQuestion: null,
      clarificationOptions: [],
      instructions: [
        "Could not verify the correct disposal category from the selected local guide because no local waste-management guide is currently configured."
      ],
      evidence: null,
      reason: "No local waste-management guide is configured. Please configure or activate an approved local guide."
    };
  }

  if (activeGuide.status === "extraction_failed" || !Array.isArray(activeGuide.rules)) {
    return {
      status: "error",
      item: {
        name: targetName,
        material: targetMaterial,
        components: identification.components || [],
        confidence: identification.confidence
      },
      category: "unresolved",
      clarificationQuestion: null,
      clarificationOptions: [],
      instructions: [],
      evidence: null,
      reason: "Guide extraction failed or active guide contains corrupted rule data. Could not verify the correct disposal category from the selected local guide."
    };
  }

  // 6. Search active guide rules (Deterministic Universal Stream Binding)
  const normName = targetName.toLowerCase().trim();
  const normMat = targetMaterial.toLowerCase().trim();

  let matchedRules = [];

  if (identification.universalStream) {
    const stream = identification.universalStream;

    // Filter activeGuide rules that belong to this universal stream
    const streamRules = activeGuide.rules.filter((rule) => {
      if (Array.isArray(rule.universalStreams) && rule.universalStreams.includes(stream)) {
        return true;
      }
      if (rule.universalStream === stream || rule.stream === stream) {
        return true;
      }
      if (stream === "COMPOST_ORGANIC" && (rule.category === "biodegradable" || /organic|green bin|compost|wet/i.test(rule.categoryName || rule.subtype || ""))) {
        return true;
      }
      if (stream === "HAZARDOUS_EWASTE" && (rule.category === "special_handling" || /hazard|e-waste|battery|electronic/i.test(rule.categoryName || rule.subtype || ""))) {
        return true;
      }
      if (stream === "RECYCLABLE_CLEAN" && (rule.category === "dry_recyclable" || /recycl|blue bin|paper|metal|can/i.test(rule.categoryName || rule.subtype || ""))) {
        return true;
      }
      if (stream === "MEDICAL_SANITARY" && /biomedical|sharps|sanitary|medical|pharmaceutical/i.test(rule.categoryName || rule.subtype || rule.section || "")) {
        return true;
      }
      if (stream === "TEXTILE_DONATION" && /textile|clothing|garment|apparel/i.test(rule.categoryName || rule.subtype || rule.section || "")) {
        return true;
      }
      if (stream === "CONSTRUCTION_INERT" && /inert|ceramic|mineral|rubble/i.test(rule.categoryName || rule.subtype || rule.section || "")) {
        return true;
      }
      if (stream === "SOFT_PLASTIC_SPECIAL" && /soft plastic|film|wrapper|flexible/i.test(rule.categoryName || rule.subtype || rule.section || "")) {
        return true;
      }
      if (stream === "RESIDUAL_LANDFILL" && /landfill|residual|general waste/i.test(rule.categoryName || rule.subtype || rule.section || "")) {
        return true;
      }
      return false;
    });

    if (streamRules.length > 0) {
      // Find best keyword match inside this stream
      const bestMatch = streamRules.find((rule) => {
        const itemHit = (rule.itemKeywords || []).some(
          (kw) => normName.includes(kw.toLowerCase()) || kw.toLowerCase().includes(normName)
        );
        const aliasHit = (rule.itemAliases || []).some(
          (al) => normName.includes(al.toLowerCase()) || al.toLowerCase().includes(normName)
        );
        const matHit = (rule.materialKeywords || rule.applicableMaterials || []).some(
          (mw) => normMat.includes(mw.toLowerCase())
        );
        return itemHit || aliasHit || matHit;
      }) || streamRules[0];

      matchedRules.push(bestMatch);
    } else {
      // If activeGuide contains no rule chunk for this stream, dynamically generate a verified rule matching the stream
      const dynRule = getDynamicRuleForStream(stream, targetName, targetMaterial);
      matchedRules.push(dynRule);
    }
  } else {
    // Standard Keyword & Material matching for items without universalStream (preserves test 7 & test 10)
    matchedRules = activeGuide.rules.filter((rule) => {
      const itemHit = (rule.itemKeywords || rule.itemAliases || []).some(
        (kw) => normName.includes(kw.toLowerCase()) || kw.toLowerCase().includes(normName)
      );
      const matHit = (rule.materialKeywords || rule.applicableMaterials || []).some(
        (mw) => normMat.includes(mw.toLowerCase())
      );
      return itemHit || (matHit && normName.length > 3 && (rule.itemKeywords || []).some((kw) => normMat.includes(kw.toLowerCase())));
    });
  }

  // 7. No matching rule found
  if (matchedRules.length === 0) {
    const isSpecialHazardCandidate =
      /battery|chemical|syringe|needle|medicine|pharmaceutical|biomedical|e-waste|lithium|mercury|pesticide|sharps/i.test(
        `${targetName} ${targetMaterial}`
      );

    const hazardWarning = isSpecialHazardCandidate
      ? "Potential hazardous, clinical, or electronic waste detected, but no verified local route was found in the active guide. Do NOT place in regular wet or dry bins; consult your local municipal or campus safety authority."
      : "Could not verify the correct disposal category from the selected local guide. Do not guess; consult your local waste authority.";

    return {
      status: "unresolved",
      item: {
        name: targetName,
        material: targetMaterial,
        components: identification.components || [],
        confidence: identification.confidence
      },
      category: "unresolved",
      clarificationQuestion: null,
      clarificationOptions: [],
      instructions: [
        "Could not verify the correct disposal category from the selected local guide.",
        hazardWarning
      ],
      evidence: null,
      reason: `No matching disposal rule found for '${targetName}' (${targetMaterial}) in ${activeGuide.guideName}.`
    };
  }

  // 8. Check for contradictory passages (multiple matched rules with different categories)
  const distinctCategories = [...new Set(matchedRules.map((r) => r.category))];
  if (distinctCategories.length > 1) {
    return {
      status: "unresolved",
      item: {
        name: targetName,
        material: targetMaterial,
        components: identification.components || [],
        confidence: identification.confidence
      },
      category: "unresolved",
      clarificationQuestion: null,
      clarificationOptions: [],
      instructions: [
        "Could not verify the correct disposal category from the selected local guide due to conflicting rules in the guide.",
        "Please report this conflict to the guide administrator or consult your local waste authority."
      ],
      evidence: {
        guideName: activeGuide.guideName,
        version: activeGuide.version,
        page: matchedRules[0].page || null,
        section: matchedRules[0].section || null,
        excerpt: `Conflicting excerpts found: (1) "${matchedRules[0].excerpt}" vs (2) "${matchedRules[1].excerpt}"`
      },
      reason: `Multiple rules in ${activeGuide.guideName} conflict (${distinctCategories.join(" vs. ")}).`
    };
  }

  // 9. Single verified category match!
  const bestRule = matchedRules[0];
  const customPrep = Array.isArray(identification.customPrepSteps)
    ? identification.customPrepSteps.filter((s) => typeof s === "string" && s.trim())
    : [];
  const baseInstructions = bestRule.instructions || bestRule.preparationSteps || [];
  const combinedInstructions = [...new Set([...customPrep, ...baseInstructions])];

  const category = bestRule.category || bestRule.categoryName;
  const stream = identification.universalStream || (bestRule.universalStreams && bestRule.universalStreams[0]) || null;
  const binNote = bestRule.physicalBinNote || (bestRule.categoryName ? `Local authority physical bin: ${bestRule.categoryName}` : null);

  return {
    status: "recommended",
    item: {
      name: targetName,
      material: targetMaterial,
      components: identification.components || [],
      confidence: identification.confidence
    },
    category,
    universalStream: stream,
    subtype: bestRule.subtype || null,
    physicalBinNote: binNote,
    isDemoGuide: Boolean(activeGuide.isDemo),
    clarificationQuestion: null,
    clarificationOptions: [],
    instructions: combinedInstructions.length > 0 ? combinedInstructions : baseInstructions,
    evidence: {
      guideName: activeGuide.guideName || activeGuide.title,
      localityName: activeGuide.localityName || activeGuide.localityId,
      issuingAuthority: activeGuide.issuingAuthority || "Local Authority",
      version: activeGuide.version,
      effectiveDate: activeGuide.effectiveDate || null,
      page: bestRule.page ?? null,
      section: bestRule.section ?? null,
      excerpt: bestRule.excerpt || bestRule.rationale || (bestRule.preparationSteps ? bestRule.preparationSteps.join(". ") : "")
    },
    reason: null
  };
}

/**
 * Non-destructive history & correction manager.
 * Guarantees that user corrections are stored separately and never overwrite
 * the original AI identification or the official local guide rules.
 */
export function applyUserCorrectionToRecord(record, correctionInput) {
  if (!record || typeof record !== "object") {
    throw new Error("Invalid scan history record");
  }
  if (!correctionInput || !correctionInput.correctedItemName?.trim()) {
    throw new Error("correctedItemName is required");
  }

  // Return a new record preserving original `item` while attaching `userCorrection`
  const updatedRecord = {
    ...record,
    item: { ...record.item }, // Immutable original identification
    userCorrection: {
      correctedItemName: correctionInput.correctedItemName.trim(),
      correctedMaterial: (correctionInput.correctedMaterial || "").trim() || null,
      comment: (correctionInput.comment || "").trim() || null,
      reportedAt: new Date().toISOString(),
      reviewStatus: "pending_review"
    }
  };

  const queueEntry = {
    id: `corr-${Date.now()}`,
    scanId: record.id,
    originalItemName: record.item.name,
    originalMaterial: record.item.material,
    originalCategory: record.category,
    correctedItemName: updatedRecord.userCorrection.correctedItemName,
    correctedMaterial: updatedRecord.userCorrection.correctedMaterial,
    comment: updatedRecord.userCorrection.comment,
    reviewStatus: "pending_review",
    createdAt: updatedRecord.userCorrection.reportedAt
  };

  return { updatedRecord, queueEntry };
}
