"""
Sovereign RAG Pipeline
======================
Provides local, air-gapped Retrieval-Augmented Generation:
  1. ChunkingEngine     — splits text into overlapping windows
  2. SovereignRAGIndexer — embeds chunks and persists them (DB + in-memory vector store)
  3. SovereignRAGRetriever — retrieves top-k chunks by cosine similarity

All operations use only local adapters. Zero external network calls are made.
"""
import math
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("apps.knowledge.rag")


# ---------------------------------------------------------------------------
# 1. ChunkingEngine
# ---------------------------------------------------------------------------

class ChunkingEngine:
    """
    Splits a long document body into overlapping word-level chunks.

    Args:
        chunk_size: Number of words per chunk (default 150).
        overlap: Number of words shared between adjacent chunks (default 30).
    """

    def __init__(self, chunk_size: int = 150, overlap: int = 30):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def split(self, text: str, source_name: str = "") -> List[Dict[str, Any]]:
        """
        Returns a list of dicts:
          { "chunk_index": int, "content": str, "source_name": str }
        """
        words = text.split()
        if not words:
            return []

        chunks = []
        step = max(1, self.chunk_size - self.overlap)
        idx = 0
        chunk_index = 0

        while idx < len(words):
            chunk_words = words[idx: idx + self.chunk_size]
            chunks.append({
                "chunk_index": chunk_index,
                "content": " ".join(chunk_words),
                "source_name": source_name,
            })
            chunk_index += 1
            idx += step

        logger.debug(
            "ChunkingEngine: split '%s' (%d words) into %d chunks.",
            source_name, len(words), len(chunks)
        )
        return chunks


# ---------------------------------------------------------------------------
# 2. SovereignRAGIndexer
# ---------------------------------------------------------------------------

class SovereignRAGIndexer:
    """
    Orchestrates the full chunk → embed → store pipeline for a KnowledgeBase.

    Uses:
      - AdapterRegistry.get_embedding_adapter() for local embedding
      - AdapterRegistry.get_vector_db_adapter() for in-memory cosine store
      - KnowledgeChunk Django model for persistent storage
    """

    def __init__(self, knowledge_base_id: str):
        from apps.models.adapters.registry import AdapterRegistry
        self.knowledge_base_id = str(knowledge_base_id)
        self.embedding_adapter = AdapterRegistry.get_embedding_adapter()
        self.vector_db = AdapterRegistry.get_vector_db_adapter()
        self.chunker = ChunkingEngine()
        self.collection_name = f"kb_{self.knowledge_base_id}"

    def index_text(self, text: str, source_name: str = "inline") -> int:
        """
        Chunks, embeds, persists to DB and vector store.
        Returns number of chunks indexed.
        """
        from .models import KnowledgeBase, KnowledgeChunk

        chunks = self.chunker.split(text, source_name=source_name)
        if not chunks:
            return 0

        try:
            kb = KnowledgeBase.objects.get(id=self.knowledge_base_id)
        except KnowledgeBase.DoesNotExist:
            logger.error("KnowledgeBase %s not found.", self.knowledge_base_id)
            return 0

        indexed = 0
        for chunk_meta in chunks:
            vector = self.embedding_adapter.embed_text(chunk_meta["content"])

            # Persist to DB
            kc = KnowledgeChunk.objects.create(
                knowledge_base=kb,
                source_document_name=chunk_meta["source_name"],
                chunk_index=chunk_meta["chunk_index"],
                content=chunk_meta["content"],
                embedding=vector,
            )

            # Insert into in-memory vector store
            self.vector_db.insert(
                collection_name=self.collection_name,
                doc_id=str(kc.id),
                vector=vector,
                metadata={
                    "chunk_id": str(kc.id),
                    "chunk_index": kc.chunk_index,
                    "source_document_name": kc.source_document_name,
                    "content_preview": kc.content[:200],
                },
            )
            indexed += 1

        # Mark KB as indexed
        kb.rag_indexed = True
        kb.chunk_count = KnowledgeChunk.objects.filter(knowledge_base=kb).count()
        kb.save(update_fields=["rag_indexed", "chunk_count"])

        logger.info(
            "SovereignRAGIndexer: indexed %d chunks for KB '%s'.",
            indexed, kb.name
        )
        return indexed

    def rehydrate_from_db(self) -> int:
        """
        Re-populates the in-memory vector store from persisted KnowledgeChunk rows.
        Call this on server start to restore vector index without re-embedding.
        """
        from .models import KnowledgeChunk
        chunks = KnowledgeChunk.objects.filter(
            knowledge_base_id=self.knowledge_base_id
        )
        restored = 0
        for kc in chunks:
            if kc.embedding:
                self.vector_db.insert(
                    collection_name=self.collection_name,
                    doc_id=str(kc.id),
                    vector=kc.embedding,
                    metadata={
                        "chunk_id": str(kc.id),
                        "chunk_index": kc.chunk_index,
                        "source_document_name": kc.source_document_name,
                        "content_preview": kc.content[:200],
                    },
                )
                restored += 1
        logger.info("SovereignRAGIndexer: rehydrated %d chunks for KB %s.", restored, self.knowledge_base_id)
        return restored


# ---------------------------------------------------------------------------
# 3. SovereignRAGRetriever
# ---------------------------------------------------------------------------

class SovereignRAGRetriever:
    """
    Retrieves the top-k most relevant chunks for a given query string.
    Uses local embedding + in-memory cosine similarity (no external calls).
    """

    def __init__(self, knowledge_base_id: str, top_k: int = 5):
        from apps.models.adapters.registry import AdapterRegistry
        self.knowledge_base_id = str(knowledge_base_id)
        self.collection_name = f"kb_{self.knowledge_base_id}"
        self.embedding_adapter = AdapterRegistry.get_embedding_adapter()
        self.vector_db = AdapterRegistry.get_vector_db_adapter()
        self.top_k = top_k

    def retrieve(self, query: str) -> List[Dict[str, Any]]:
        """
        Returns list of dicts:
          { "chunk_id", "score", "chunk_index", "source_document_name", "content_preview" }
        """
        if not query.strip():
            return []

        query_vector = self.embedding_adapter.embed_text(query)
        results = self.vector_db.query(
            collection_name=self.collection_name,
            vector=query_vector,
            top_k=self.top_k,
        )

        # Enrich with full content from DB
        enriched = []
        for r in results:
            from .models import KnowledgeChunk
            try:
                kc = KnowledgeChunk.objects.get(id=r["metadata"]["chunk_id"])
                enriched.append({
                    "chunk_id": str(kc.id),
                    "score": r["score"],
                    "chunk_index": kc.chunk_index,
                    "source_document_name": kc.source_document_name,
                    "content": kc.content,
                })
            except KnowledgeChunk.DoesNotExist:
                # Chunk was deleted; use preview from metadata
                enriched.append({
                    "chunk_id": r["metadata"].get("chunk_id", ""),
                    "score": r["score"],
                    "chunk_index": r["metadata"].get("chunk_index", 0),
                    "source_document_name": r["metadata"].get("source_document_name", ""),
                    "content": r["metadata"].get("content_preview", ""),
                })

        logger.debug(
            "SovereignRAGRetriever: retrieved %d chunks for query '%s...' from KB %s.",
            len(enriched), query[:60], self.knowledge_base_id
        )
        return enriched


# ---------------------------------------------------------------------------
# Convenience helper — build context string from retrieved chunks
# ---------------------------------------------------------------------------

def build_rag_context(chunks: List[Dict[str, Any]]) -> str:
    """Formats retrieved chunks into a structured prompt context block."""
    if not chunks:
        return ""
    lines = ["=== SOVEREIGN RAG CONTEXT (Local Retrieval — Zero External Egress) ==="]
    for i, c in enumerate(chunks, start=1):
        lines.append(
            f"\n[Chunk {i} | Source: {c['source_document_name']} | Score: {c['score']:.4f}]\n"
            f"{c['content']}"
        )
    lines.append("\n=== END RAG CONTEXT ===")
    return "\n".join(lines)
