import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { env } from '../config/env.js';
import type {
  GuideRecord,
  RuleChunkRecord,
  AnalysisRecord,
  DisposalHistoryRecord,
  CorrectionRecord
} from '../types/domain.js';

let firestoreInstance: Firestore | null = null;
let useInMemory = false;

// In-Memory store for offline/local/test deterministic execution
class InMemoryStore {
  guides = new Map<string, GuideRecord>();
  ruleChunks = new Map<string, RuleChunkRecord>();
  analyses = new Map<string, AnalysisRecord>();
  disposalHistory = new Map<string, DisposalHistoryRecord>();
  corrections = new Map<string, CorrectionRecord>();

  reset() {
    this.guides.clear();
    this.ruleChunks.clear();
    this.analyses.clear();
    this.disposalHistory.clear();
    this.corrections.clear();
  }
}

export const inMemoryDb = new InMemoryStore();

export function initFirestore(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  // If running in test mode or no credentials/emulator provided, default to inMemory mode
  if (process.env.NODE_ENV === 'test' && !process.env.FIRESTORE_EMULATOR_HOST && !env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    useInMemory = true;
    return null;
  }

  try {
    if (getApps().length === 0) {
      if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        let certObj;
        try {
          certObj = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY);
        } catch {
          certObj = env.FIREBASE_SERVICE_ACCOUNT_KEY;
        }
        initializeApp({
          credential: cert(certObj),
          projectId: env.FIREBASE_PROJECT_ID
        });
      } else if (process.env.FIRESTORE_EMULATOR_HOST) {
        initializeApp({
          projectId: env.FIREBASE_PROJECT_ID || 'demo-wastewise'
        });
      } else {
        // Fallback to in-memory if no explicit GCP service account
        useInMemory = true;
        return null;
      }
    }
    firestoreInstance = getFirestore();
    return firestoreInstance;
  } catch (err) {
    console.warn('Firebase init fallback to in-memory store:', err);
    useInMemory = true;
    return null;
  }
}

export function isUsingInMemory(): boolean {
  return useInMemory;
}

export function setForceInMemory(val: boolean) {
  useInMemory = val;
}

export const dbService = {
  // Guides
  async saveGuide(guide: GuideRecord): Promise<void> {
    if (useInMemory || !firestoreInstance) {
      // Mark others as inactive if this is active
      if (guide.isActive) {
        for (const [id, g] of inMemoryDb.guides.entries()) {
          if (g.localityId === guide.localityId) {
            inMemoryDb.guides.set(id, { ...g, isActive: false });
          }
        }
      }
      inMemoryDb.guides.set(guide.guideId, guide);
      return;
    }

    const batch = firestoreInstance.batch();
    if (guide.isActive) {
      const activeGuidesSnapshot = await firestoreInstance
        .collection('guides')
        .where('localityId', '==', guide.localityId)
        .where('isActive', '==', true)
        .get();

      activeGuidesSnapshot.forEach((doc: QueryDocumentSnapshot) => {
        batch.update(doc.ref, { isActive: false });
      });
    }

    const guideRef = firestoreInstance.collection('guides').doc(guide.guideId);
    batch.set(guideRef, guide);
    await batch.commit();
  },

  async getActiveGuide(localityId: string): Promise<GuideRecord | null> {
    if (useInMemory || !firestoreInstance) {
      for (const guide of inMemoryDb.guides.values()) {
        if (guide.localityId === localityId && guide.isActive) {
          return guide;
        }
      }
      return null;
    }

    const snapshot = await firestoreInstance
      .collection('guides')
      .where('localityId', '==', localityId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as GuideRecord;
  },

  async getGuideById(guideId: string): Promise<GuideRecord | null> {
    if (useInMemory || !firestoreInstance) {
      return inMemoryDb.guides.get(guideId) || null;
    }
    const doc = await firestoreInstance.collection('guides').doc(guideId).get();
    return doc.exists ? (doc.data() as GuideRecord) : null;
  },

  // RuleChunks
  async saveRuleChunks(chunks: RuleChunkRecord[]): Promise<void> {
    if (useInMemory || !firestoreInstance) {
      for (const chunk of chunks) {
        inMemoryDb.ruleChunks.set(chunk.chunkId, chunk);
      }
      return;
    }

    // Firestore batch limit is 500
    const chunkSize = 400;
    for (let i = 0; i < chunks.length; i += chunkSize) {
      const batch = firestoreInstance.batch();
      const currentBatch = chunks.slice(i, i + chunkSize);
      for (const chunk of currentBatch) {
        const docRef = firestoreInstance.collection('ruleChunks').doc(chunk.chunkId);
        batch.set(docRef, chunk);
      }
      await batch.commit();
    }
  },

  async getRuleChunksByGuide(guideId: string): Promise<RuleChunkRecord[]> {
    if (useInMemory || !firestoreInstance) {
      return Array.from(inMemoryDb.ruleChunks.values()).filter(c => c.guideId === guideId);
    }
    const snapshot = await firestoreInstance
      .collection('ruleChunks')
      .where('guideId', '==', guideId)
      .get();
    return snapshot.docs.map((d: QueryDocumentSnapshot) => d.data() as RuleChunkRecord);
  },

  async searchRuleChunks(guideId: string, keywords: string[]): Promise<RuleChunkRecord[]> {
    const allChunks = await this.getRuleChunksByGuide(guideId);
    if (keywords.length === 0) return allChunks;

    const lowerKeywords = keywords.map(k => k.toLowerCase().trim()).filter(Boolean);

    // Score each chunk
    const scored = allChunks.map(chunk => {
      let score = 0;
      const lowerAliases = chunk.itemAliases.map(a => a.toLowerCase());
      const lowerMaterials = chunk.applicableMaterials.map(m => m.toLowerCase());
      const lowerCategory = chunk.categoryName.toLowerCase();
      const lowerExcerpt = chunk.sourceExcerpt.toLowerCase();

      for (const kw of lowerKeywords) {
        // Exact alias match: highest weight
        if (lowerAliases.some(a => a === kw)) {
          score += 20;
        } else if (lowerAliases.some(a => a.includes(kw) || kw.includes(a))) {
          score += 10;
        }

        // Exact material match
        if (lowerMaterials.some(m => m === kw)) {
          score += 15;
        } else if (lowerMaterials.some(m => m.includes(kw) || kw.includes(m))) {
          score += 8;
        }

        // Excerpt or category match
        if (lowerExcerpt.includes(kw)) {
          score += 5;
        }
        if (lowerCategory.includes(kw)) {
          score += 3;
        }
      }

      return { chunk, score };
    });

    const filtered = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);

    if (filtered.length > 0) {
      return filtered.slice(0, 15).map(s => s.chunk);
    }
    return [];
  },

  // Analyses
  async saveAnalysis(analysis: AnalysisRecord): Promise<void> {
    if (useInMemory || !firestoreInstance) {
      inMemoryDb.analyses.set(analysis.analysisId, analysis);
      return;
    }
    await firestoreInstance.collection('analyses').doc(analysis.analysisId).set(analysis);
  },

  async getAnalysis(analysisId: string): Promise<AnalysisRecord | null> {
    if (useInMemory || !firestoreInstance) {
      return inMemoryDb.analyses.get(analysisId) || null;
    }
    const doc = await firestoreInstance.collection('analyses').doc(analysisId).get();
    return doc.exists ? (doc.data() as AnalysisRecord) : null;
  },

  // Disposal History
  async saveHistory(history: DisposalHistoryRecord): Promise<void> {
    if (useInMemory || !firestoreInstance) {
      inMemoryDb.disposalHistory.set(history.historyId, history);
      return;
    }
    await firestoreInstance.collection('disposalHistory').doc(history.historyId).set(history);
  },

  async getHistoryBySession(sessionId: string): Promise<DisposalHistoryRecord[]> {
    if (useInMemory || !firestoreInstance) {
      return Array.from(inMemoryDb.disposalHistory.values())
        .filter(h => h.sessionId === sessionId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    const snapshot = await firestoreInstance
      .collection('disposalHistory')
      .where('sessionId', '==', sessionId)
      .orderBy('timestamp', 'desc')
      .get();
    return snapshot.docs.map((d: QueryDocumentSnapshot) => d.data() as DisposalHistoryRecord);
  },

  // Corrections
  async saveCorrection(correction: CorrectionRecord): Promise<void> {
    if (useInMemory || !firestoreInstance) {
      inMemoryDb.corrections.set(correction.correctionId, correction);
      return;
    }
    await firestoreInstance.collection('corrections').doc(correction.correctionId).set(correction);
  }
};
