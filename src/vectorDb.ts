import crypto from "crypto";

export interface VectorChunk {
  id: string;
  kb_id: string;
  doc_name: string;
  section: string;
  text: string;
  embedding: number[];
  created_at: string;
}

export interface SearchResult {
  id: string;
  kb_id: string;
  doc_name: string;
  section: string;
  text: string;
  score: number; // Cosine similarity: 0.0 to 1.0
  distance: number; // Cosine distance: 1 - similarity
}

export interface HNSWNode {
  id: string;
  vector: number[];
  level: number;
  neighbors: Map<number, Set<string>>; // level -> set of neighbor node IDs
  metadata: Record<string, any>;
}

/**
 * Deterministic local dense vector embedder (128 dimensions).
 * Operates purely on-premise with zero external network egress.
 */
export class LocalSovereignEmbedder {
  public static readonly DIMENSION = 128;

  // Technical and industrial vocabulary weights for higher semantic signal
  private static readonly VOCAB_WEIGHTS: Record<string, number> = {
    stress: 2.5,
    pressure: 2.2,
    von_mises: 3.0,
    weld: 2.5,
    porosity: 2.8,
    crack: 3.0,
    scada: 2.5,
    telemetry: 2.4,
    vibration: 2.8,
    temperature: 2.2,
    safety: 2.0,
    interlock: 2.7,
    bypass: 2.3,
    valve: 2.1,
    turbine: 2.4,
    nuclear: 2.8,
    asme: 3.0,
    iso: 2.8,
    iec: 2.8,
    sil3: 3.2,
    failure: 2.6,
    fatigue: 2.7,
    tolerance: 2.2,
    fillet: 2.5,
    ultrasonic: 2.8,
    anomaly: 2.6,
    conformance: 2.4,
    airgap: 3.0,
    sovereign: 2.5,
    thermal: 2.3,
    sensor: 2.0,
    flow: 2.0,
    pressure_vessel: 3.2,
    ndt: 2.9
  };

  /**
   * Generates a 128-dimensional dense vector embedding from text
   */
  public static embed(text: string): number[] {
    const vector = new Array<number>(this.DIMENSION).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9_\s]/g, " ");
    const words = normalized.split(/\s+/).filter(w => w.length > 1);

    if (words.length === 0) {
      return vector;
    }

    // 1. Term frequency & semantic domain weighting
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const weight = this.VOCAB_WEIGHTS[word] || 1.0;

      // Hash word to multiple dimension projections
      for (let k = 0; k < 4; k++) {
        const hash = crypto.createHash("sha256").update(`${word}_${k}`).digest();
        const dim = (hash.readUInt16BE(0) + i * 3) % this.DIMENSION;
        const sign = hash.readUInt8(2) % 2 === 0 ? 1 : -1;
        const mag = (hash.readUInt8(3) / 255.0) * weight;

        vector[dim] += sign * mag;
      }

      // Subword/n-gram hashing for spelling and morphologic variance
      for (let n = 3; n <= Math.min(6, word.length); n++) {
        for (let j = 0; j <= word.length - n; j++) {
          const ngram = word.substring(j, j + n);
          const hashN = crypto.createHash("md5").update(ngram).digest();
          const dimN = hashN.readUInt16BE(0) % this.DIMENSION;
          const signN = hashN.readUInt8(2) % 2 === 0 ? 1 : -1;
          vector[dimN] += signN * 0.35 * weight;
        }
      }
    }

    // 2. L2 Normalization (Unit vector for high-speed cosine similarity)
    let norm = 0;
    for (let i = 0; i < this.DIMENSION; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.DIMENSION; i++) {
        vector[i] = Number((vector[i] / norm).toFixed(6));
      }
    }

    return vector;
  }

  /**
   * Calculates cosine similarity between two unit vectors (range: 0.0 - 1.0)
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    // Clamp to [0, 1] for unit vectors
    return Math.max(0, Math.min(1, (dot + 1) / 2));
  }

  /**
   * Calculates cosine distance (range: 0.0 - 1.0)
   */
  public static cosineDistance(a: number[], b: number[]): number {
    return 1 - this.cosineSimilarity(a, b);
  }
}

/**
 * Hierarchical Navigable Small World (HNSW) Vector Index
 * Implemented in pure TypeScript for reliable zero-egress vector similarity search.
 */
export class HNSWVectorIndex {
  private M: number; // Max connections per element
  private M0: number; // Max connections for bottom layer
  private efConstruction: number; // Construction candidate size
  private efSearch: number; // Search candidate size
  private mL: number; // Normalization factor for level generation
  private enterPointId: string | null = null;
  private maxLevel: number = -1;
  private nodes: Map<string, HNSWNode> = new Map();

  constructor(options?: {
    M?: number;
    efConstruction?: number;
    efSearch?: number;
  }) {
    this.M = options?.M || 16;
    this.M0 = this.M * 2;
    this.efConstruction = options?.efConstruction || 64;
    this.efSearch = options?.efSearch || 32;
    this.mL = 1 / Math.log(this.M);
  }

  private randomLevel(): number {
    const r = Math.random();
    if (r === 0) return 0;
    return Math.floor(-Math.log(r) * this.mL);
  }

  public size(): number {
    return this.nodes.size;
  }

  public getStats() {
    return {
      node_count: this.nodes.size,
      max_level: this.maxLevel,
      dimension: LocalSovereignEmbedder.DIMENSION,
      m: this.M,
      ef_search: this.efSearch,
      algorithm: "HNSW (Hierarchical Navigable Small World)",
      distance_metric: "COSINE_SIMILARITY",
      air_gapped: true
    };
  }

  /**
   * Insert a point into the HNSW index
   */
  public addPoint(id: string, vector: number[], metadata: Record<string, any> = {}): void {
    const targetLevel = this.randomLevel();
    const newNode: HNSWNode = {
      id,
      vector,
      level: targetLevel,
      neighbors: new Map(),
      metadata
    };

    for (let l = 0; l <= targetLevel; l++) {
      newNode.neighbors.set(l, new Set());
    }

    // First node in index
    if (!this.enterPointId) {
      this.nodes.set(id, newNode);
      this.enterPointId = id;
      this.maxLevel = targetLevel;
      return;
    }

    let currObj = this.nodes.get(this.enterPointId)!;
    let currDist = LocalSovereignEmbedder.cosineDistance(vector, currObj.vector);

    // 1. Search through upper layers to find closest entry point to targetLevel
    for (let level = this.maxLevel; level > targetLevel; level--) {
      let changed = true;
      while (changed) {
        changed = false;
        const neighbors = currObj.neighbors.get(level) || new Set<string>();
        for (const neighborId of neighbors) {
          const neighbor = this.nodes.get(neighborId);
          if (!neighbor) continue;
          const d = LocalSovereignEmbedder.cosineDistance(vector, neighbor.vector);
          if (d < currDist) {
            currDist = d;
            currObj = neighbor;
            changed = true;
          }
        }
      }
    }

    // 2. Search and connect from targetLevel down to 0
    let candidates: Array<{ id: string; dist: number }> = [{ id: currObj.id, dist: currDist }];

    for (let level = Math.min(targetLevel, this.maxLevel); level >= 0; level--) {
      candidates = this.searchLayer(vector, candidates, this.efConstruction, level);
      const maxM = level === 0 ? this.M0 : this.M;
      
      // Select best neighbors
      const bestNeighbors = candidates.slice(0, maxM);
      const neighborSet = newNode.neighbors.get(level) || new Set<string>();

      for (const candidate of bestNeighbors) {
        neighborSet.add(candidate.id);
        const candNode = this.nodes.get(candidate.id);
        if (candNode) {
          const candNeighbors = candNode.neighbors.get(level) || new Set<string>();
          candNeighbors.add(id);

          // Prune neighbors if capacity exceeded
          if (candNeighbors.size > maxM) {
            this.pruneNeighbors(candNode, level, maxM);
          }
        }
      }
      newNode.neighbors.set(level, neighborSet);
    }

    this.nodes.set(id, newNode);

    if (targetLevel > this.maxLevel) {
      this.maxLevel = targetLevel;
      this.enterPointId = id;
    }
  }

  private searchLayer(
    queryVector: number[],
    enterPoints: Array<{ id: string; dist: number }>,
    ef: number,
    level: number
  ): Array<{ id: string; dist: number }> {
    const visited = new Set<string>();
    const candidates: Array<{ id: string; dist: number }> = [];
    const results: Array<{ id: string; dist: number }> = [];

    for (const ep of enterPoints) {
      visited.add(ep.id);
      candidates.push(ep);
      results.push(ep);
    }

    candidates.sort((a, b) => a.dist - b.dist);
    results.sort((a, b) => a.dist - b.dist);

    while (candidates.length > 0) {
      const current = candidates.shift()!;
      const furthestResult = results[results.length - 1];

      if (current.dist > furthestResult.dist && results.length >= ef) {
        break;
      }

      const currNode = this.nodes.get(current.id);
      if (!currNode) continue;

      const neighbors = currNode.neighbors.get(level) || new Set<string>();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          const neighborNode = this.nodes.get(neighborId);
          if (!neighborNode) continue;

          const dist = LocalSovereignEmbedder.cosineDistance(queryVector, neighborNode.vector);
          if (dist < furthestResult.dist || results.length < ef) {
            candidates.push({ id: neighborId, dist });
            results.push({ id: neighborId, dist });
            results.sort((a, b) => a.dist - b.dist);
            candidates.sort((a, b) => a.dist - b.dist);

            if (results.length > ef) {
              results.pop();
            }
          }
        }
      }
    }

    return results;
  }

  private pruneNeighbors(node: HNSWNode, level: number, maxM: number): void {
    const neighbors = node.neighbors.get(level);
    if (!neighbors || neighbors.size <= maxM) return;

    const list: Array<{ id: string; dist: number }> = [];
    for (const nId of neighbors) {
      const neighbor = this.nodes.get(nId);
      if (neighbor) {
        list.push({
          id: nId,
          dist: LocalSovereignEmbedder.cosineDistance(node.vector, neighbor.vector)
        });
      }
    }

    list.sort((a, b) => a.dist - b.dist);
    const pruned = new Set<string>(list.slice(0, maxM).map(item => item.id));
    node.neighbors.set(level, pruned);
  }

  /**
   * Search for nearest neighbors using HNSW graph traversal with exhaustive fallback
   */
  public searchKnn(queryVector: number[], k: number = 5, filter?: (metadata: Record<string, any>) => boolean): SearchResult[] {
    if (this.nodes.size === 0) {
      return [];
    }

    // For smaller collections (<50 nodes), exact k-NN is both ultra-fast (<0.1ms) and 100% recall perfect
    if (this.nodes.size <= 50 || !this.enterPointId) {
      const allResults: SearchResult[] = [];
      for (const [id, node] of this.nodes.entries()) {
        if (filter && !filter(node.metadata)) continue;
        const similarity = LocalSovereignEmbedder.cosineSimilarity(queryVector, node.vector);
        allResults.push({
          id,
          kb_id: node.metadata.kb_id || "",
          doc_name: node.metadata.doc_name || "",
          section: node.metadata.section || "",
          text: node.metadata.text || "",
          score: Number(similarity.toFixed(4)),
          distance: Number((1 - similarity).toFixed(4))
        });
      }
      allResults.sort((a, b) => b.score - a.score);
      return allResults.slice(0, k);
    }

    // Multi-layer HNSW graph search
    let currObj = this.nodes.get(this.enterPointId)!;
    let currDist = LocalSovereignEmbedder.cosineDistance(queryVector, currObj.vector);

    for (let level = this.maxLevel; level > 0; level--) {
      let changed = true;
      while (changed) {
        changed = false;
        const neighbors = currObj.neighbors.get(level) || new Set<string>();
        for (const neighborId of neighbors) {
          const neighbor = this.nodes.get(neighborId);
          if (!neighbor) continue;
          const d = LocalSovereignEmbedder.cosineDistance(queryVector, neighbor.vector);
          if (d < currDist) {
            currDist = d;
            currObj = neighbor;
            changed = true;
          }
        }
      }
    }

    const candidates = this.searchLayer(queryVector, [{ id: currObj.id, dist: currDist }], Math.max(this.efSearch, k * 2), 0);
    const results: SearchResult[] = [];

    for (const cand of candidates) {
      const node = this.nodes.get(cand.id);
      if (!node) continue;
      if (filter && !filter(node.metadata)) continue;

      const similarity = LocalSovereignEmbedder.cosineSimilarity(queryVector, node.vector);
      results.push({
        id: node.id,
        kb_id: node.metadata.kb_id || "",
        doc_name: node.metadata.doc_name || "",
        section: node.metadata.section || "",
        text: node.metadata.text || "",
        score: Number(similarity.toFixed(4)),
        distance: Number((1 - similarity).toFixed(4))
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }
}

/**
 * Pre-seeded industrial engineering documents for local RAG knowledge bases
 */
export const INDUSTRIAL_CORPUS = [
  {
    kb_id: "kb-nuclear-01",
    doc_name: "ASME_Section_III_Nuclear_Components.txt",
    section: "3.1.2 Fillet Weld & Casement Stress Limits",
    content: "ASME Section III Division 1 subsection NB establishes mandatory safety standards for nuclear steam supply system pressure vessels. The maximum allowable Von Mises equivalent stress at turbine casing transition fillets shall not exceed 250.0 MPa under normal continuous operating loads at 140 bar steam pressure. Safety factor must remain >= 2.0 at all times. Thermal cyclic fatigue limits mandate continuous monitoring with an inspection threshold before 100,000 thermal cycles."
  },
  {
    kb_id: "kb-nuclear-01",
    doc_name: "ASME_Section_III_Nuclear_Components.txt",
    section: "3.4.1 Pressure Boundary Containment",
    content: "Containment boundary isolation protocols require dual redundant valve seating with verified zero micro-fracture propagation across all high-pressure feed loops. Any micro-fissure exceeding 15 micrometers depth requires immediate component replacement and ultrasonic re-certification."
  },
  {
    kb_id: "kb-weld-02",
    doc_name: "ISO_17640_NDT_Ultrasonic_Weld_Inspection.txt",
    section: "4.2 Porosity & Lack of Fusion Limits",
    content: "ISO 17640 sets ultrasonic non-destructive testing requirements for industrial fusion welded joints in metallic casing. Total volumetric porosity must remain strictly below 0.10% across the weld seam cross-section. Lack of Fusion (LoF) flaws of any measurable length are strictly prohibited in Class 1 aerospace and turbine casings. Heat-affected zone (HAZ) grain bounds must maintain uniform microstructural integrity without localized embrittlement."
  },
  {
    kb_id: "kb-weld-02",
    doc_name: "ISO_17640_NDT_Ultrasonic_Weld_Inspection.txt",
    section: "4.5 Ultrasonic Echo Amplitude Calibration",
    content: "Calibration of ultrasonic transducer sensitivity must utilize standard reference blocks with 2.0 mm diameter flat-bottom holes. Echo attenuation exceeding 3.5 dB across the seam interface triggers automatic rejection and manual dye-penetrant re-inspection."
  },
  {
    kb_id: "kb-scada-03",
    doc_name: "IEEE_1459_SCADA_Telemetry_Standards.txt",
    section: "5.1 Coolant Loop Temperature & Vibration Boundaries",
    content: "IEEE 1459 operational limits for turbine thermal loops: Coolant Loop sensor TC-201 temperature nominal operating window is 305.0°C to 325.0°C. Transient spikes above 330.0°C require coolant pump ramp-up. Turbine shaft peak-to-peak vibration amplitude threshold: warning at 1.50 mm/s peak velocity, critical emergency trip at 2.80 mm/s. Divergence factor must remain under 0.020 to prevent thermodynamic flutter."
  },
  {
    kb_id: "kb-scada-03",
    doc_name: "IEEE_1459_SCADA_Telemetry_Standards.txt",
    section: "5.3 Valve Stiction and Flow Coefficient Tracking",
    content: "Telemetry sampling rate for primary feed loops shall not be less than 10 Hz. Real-time divergence algorithms track valve hysteresis and stiction indices. Flow deviation surpassing +/- 3.5% indicates mechanical scale accumulation or seal degradation."
  },
  {
    kb_id: "kb-pid-04",
    doc_name: "IEC_61508_SIL3_Emergency_Interlocks.txt",
    section: "2.1 Redundant Bypass & Emergency Shutdown (ESD)",
    content: "IEC 61508 Safety Integrity Level 3 (SIL-3) standard requires 1oo2D (1-out-of-2 with diagnostics) or 2oo3 voting architecture for nuclear and chemical emergency shutdown interlocks. Redundant bypass lines must engage within 180 milliseconds of anomalous pressure boundary divergence. High-pressure isolation loops must enforce dual-valve positive isolation with independent power actuators."
  },
  {
    kb_id: "kb-pid-04",
    doc_name: "IEC_61508_SIL3_Emergency_Interlocks.txt",
    section: "2.4 Proof Testing and Safe Failure Fraction (SFF)",
    content: "Safe Failure Fraction (SFF) for mission-critical interlocks must exceed 99.0%. Diagnostic coverage for automatic valve positioners must verify full-stroke and partial-stroke testing intervals without interrupting primary reactor containment cooling."
  }
];

/**
 * Singleton Local Vector Database manager
 */
export class LocalVectorDatabase {
  private static instance: LocalVectorDatabase;
  private index: HNSWVectorIndex;
  private chunks: Map<string, VectorChunk> = new Map();

  private constructor() {
    this.index = new HNSWVectorIndex({
      M: 16,
      efConstruction: 64,
      efSearch: 32
    });
    this.seedDefaultCorpus();
  }

  public static getInstance(): LocalVectorDatabase {
    if (!LocalVectorDatabase.instance) {
      LocalVectorDatabase.instance = new LocalVectorDatabase();
    }
    return LocalVectorDatabase.instance;
  }

  /**
   * Seeds the initial industrial standard documents into the HNSW index
   */
  public seedDefaultCorpus(): void {
    for (const item of INDUSTRIAL_CORPUS) {
      this.indexDocumentChunk(item.kb_id, item.doc_name, item.section, item.content);
    }
  }

  /**
   * Index a text document with automatic chunking and HNSW vector insertion
   */
  public indexDocumentChunk(kbId: string, docName: string, section: string, text: string): string {
    const chunkId = `chk_${crypto.randomUUID().replace(/-/g, "").substring(0, 12)}`;
    const embedding = LocalSovereignEmbedder.embed(`${section} ${text}`);

    const chunk: VectorChunk = {
      id: chunkId,
      kb_id: kbId,
      doc_name: docName,
      section,
      text,
      embedding,
      created_at: new Date().toISOString()
    };

    this.chunks.set(chunkId, chunk);
    this.index.addPoint(chunkId, embedding, {
      kb_id: kbId,
      doc_name: docName,
      section,
      text
    });

    return chunkId;
  }

  /**
   * Chunks and indexes a full text payload with granular telemetry for progress tracking
   */
  public indexDocumentWithDetails(
    kbId: string,
    docName: string,
    fullText: string,
    chunkSize: number = 300,
    overlap: number = 50
  ): {
    chunks: Array<{
      id: string;
      section: string;
      snippet: string;
      length: number;
      embedding_dim: number;
      level: number;
      created_at: string;
    }>;
    total_chunks: number;
    embedding_dimension: number;
    index_stats: any;
  } {
    const paragraphs = fullText.split(/\n\n+/).filter(p => p.trim().length > 0);
    const createdChunks: Array<{
      id: string;
      section: string;
      snippet: string;
      length: number;
      embedding_dim: number;
      level: number;
      created_at: string;
    }> = [];

    const processChunk = (section: string, text: string) => {
      const chunkId = `chk_${crypto.randomUUID().replace(/-/g, "").substring(0, 12)}`;
      const embedding = LocalSovereignEmbedder.embed(`${section} ${text}`);

      const chunk: VectorChunk = {
        id: chunkId,
        kb_id: kbId,
        doc_name: docName,
        section,
        text,
        embedding,
        created_at: new Date().toISOString()
      };

      this.chunks.set(chunkId, chunk);
      this.index.addPoint(chunkId, embedding, {
        kb_id: kbId,
        doc_name: docName,
        section,
        text
      });

      createdChunks.push({
        id: chunkId,
        section,
        snippet: text.length > 80 ? text.substring(0, 77) + "..." : text,
        length: text.length,
        embedding_dim: LocalSovereignEmbedder.DIMENSION,
        level: 0,
        created_at: chunk.created_at
      });
    };

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const para = paragraphs[pIdx].trim();
      if (para.length <= chunkSize) {
        processChunk(`Section ${pIdx + 1}`, para);
      } else {
        let start = 0;
        let subIdx = 1;
        while (start < para.length) {
          const end = Math.min(start + chunkSize, para.length);
          const chunkText = para.substring(start, end).trim();
          if (chunkText.length > 20) {
            processChunk(`Section ${pIdx + 1}.${subIdx}`, chunkText);
          }
          start += (chunkSize - overlap);
          subIdx++;
        }
      }
    }

    return {
      chunks: createdChunks,
      total_chunks: createdChunks.length,
      embedding_dimension: LocalSovereignEmbedder.DIMENSION,
      index_stats: this.getStats()
    };
  }

  /**
   * Chunks and indexes a full text payload
   */
  public indexText(kbId: string, docName: string, fullText: string, chunkSize: number = 300, overlap: number = 50): number {
    const paragraphs = fullText.split(/\n\n+/).filter(p => p.trim().length > 0);
    let chunksAdded = 0;

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const para = paragraphs[pIdx].trim();
      if (para.length <= chunkSize) {
        this.indexDocumentChunk(kbId, docName, `Section ${pIdx + 1}`, para);
        chunksAdded++;
      } else {
        // Sliding window chunker
        let start = 0;
        let subIdx = 1;
        while (start < para.length) {
          const end = Math.min(start + chunkSize, para.length);
          const chunkText = para.substring(start, end).trim();
          if (chunkText.length > 20) {
            this.indexDocumentChunk(kbId, docName, `Section ${pIdx + 1}.${subIdx}`, chunkText);
            chunksAdded++;
          }
          start += (chunkSize - overlap);
          subIdx++;
        }
      }
    }

    return chunksAdded;
  }

  /**
   * Perform vector similarity query over the HNSW vector database
   */
  public query(queryText: string, kbId?: string, topK: number = 3): SearchResult[] {
    const queryVector = LocalSovereignEmbedder.embed(queryText);
    const filter = kbId ? (metadata: Record<string, any>) => metadata.kb_id === kbId : undefined;
    return this.index.searchKnn(queryVector, topK, filter);
  }

  /**
   * Get all chunks for a specific knowledge base
   */
  public getChunksByKb(kbId: string): VectorChunk[] {
    const results: VectorChunk[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.kb_id === kbId) {
        results.push(chunk);
      }
    }
    return results;
  }

  public getStats() {
    return {
      ...this.index.getStats(),
      total_chunks: this.chunks.size
    };
  }
}
