import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import KnowledgeBase, KnowledgeChunk
from .serializers import KnowledgeBaseSerializer, KnowledgeChunkSerializer
from .rag import SovereignRAGIndexer, SovereignRAGRetriever
from apps.accounts.permissions import IsAnalystOrAbove

logger = logging.getLogger("apps.knowledge")


class KnowledgeViewSet(viewsets.ModelViewSet):
    """
    Endpoints for listing, creating, and updating confidential knowledge collections.
    Includes RAG indexing and retrieval sub-actions.
    """
    queryset = KnowledgeBase.objects.all().order_by("-created_at")
    serializer_class = KnowledgeBaseSerializer
    permission_classes = [permissions.IsAuthenticated, IsAnalystOrAbove]

    # ------------------------------------------------------------------
    # POST /api/knowledge/{id}/index/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="index")
    def index_knowledge_base(self, request, pk=None):
        """
        Triggers the Sovereign RAG indexing pipeline for this knowledge base.
        Accepts an optional 'text' body field; falls back to a seeded demo corpus.
        """
        kb = self.get_object()
        text = request.data.get("text", "")

        if not text.strip():
            # Use a realistic sovereign demo corpus if no text provided
            text = (
                f"Knowledge Base: {kb.name}\n\n"
                f"{kb.description}\n\n"
                "This knowledge collection contains classified industrial specifications, "
                "material standards, safety thresholds, operational telemetry, and process "
                "documentation relevant to sovereign industrial AI analysis. "
                "All data is processed exclusively within the air-gapped perimeter. "
                "No data leaves the on-premise hardware boundary. "
                "Sovereign cryptographic receipts are generated for every inference operation. "
                "Engineers, analysts, and operators are granted differentiated access tiers. "
                "Automated toolchains invoke CAD stress analyzers, weld seam detectors, "
                "SCADA telemetry analyzers, and P&ID blueprint parsers. "
                "Compliance with IS/ISO industrial safety standards is continuously verified."
            )

        source_name = request.data.get("source_name", kb.name)

        indexer = SovereignRAGIndexer(knowledge_base_id=str(kb.id))
        chunks_indexed = indexer.index_text(text=text, source_name=source_name)

        kb.refresh_from_db()
        logger.info(
            "RAG indexing complete for KB '%s': %d chunks indexed.", kb.name, chunks_indexed
        )
        return Response({
            "success": True,
            "knowledge_base": str(kb.id),
            "chunks_indexed": chunks_indexed,
            "total_chunk_count": kb.chunk_count,
            "rag_indexed": kb.rag_indexed,
        }, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # POST /api/knowledge/{id}/retrieve/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="retrieve")
    def retrieve_chunks(self, request, pk=None):
        """
        Runs a local RAG retrieval query against this knowledge base.
        Body: { "query": "...", "top_k": 5 }
        Returns top-k most relevant chunks with similarity scores.
        """
        kb = self.get_object()
        query = request.data.get("query", "").strip()
        top_k = int(request.data.get("top_k", 5))

        if not query:
            return Response(
                {"success": False, "error": "Query string is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not kb.rag_indexed:
            return Response(
                {"success": False, "error": "Knowledge base has not been indexed yet. Call /index/ first."},
                status=status.HTTP_409_CONFLICT,
            )

        # Rehydrate in-memory vector store from DB (handles server restarts)
        indexer = SovereignRAGIndexer(knowledge_base_id=str(kb.id))
        indexer.rehydrate_from_db()

        retriever = SovereignRAGRetriever(knowledge_base_id=str(kb.id), top_k=top_k)
        chunks = retriever.retrieve(query)

        logger.info(
            "RAG retrieval: query='%s...' returned %d chunks from KB '%s'.",
            query[:60], len(chunks), kb.name
        )
        return Response({
            "success": True,
            "knowledge_base": str(kb.id),
            "query": query,
            "chunks_returned": len(chunks),
            "results": chunks,
            "external_egress": False,
            "network_status": "AIR_GAPPED_LOCAL",
        }, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # GET /api/knowledge/{id}/chunks/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["get"], url_path="chunks")
    def list_chunks(self, request, pk=None):
        """Lists all persisted chunks for a knowledge base."""
        kb = self.get_object()
        chunks = KnowledgeChunk.objects.filter(knowledge_base=kb)
        serializer = KnowledgeChunkSerializer(chunks, many=True)
        return Response({
            "knowledge_base": str(kb.id),
            "chunk_count": chunks.count(),
            "chunks": serializer.data,
        })
