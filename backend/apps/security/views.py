from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import SovereigntyReceipt
from .serializers import SovereigntyReceiptSerializer
from .receipts import verify_receipt_integrity


class SovereigntyReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoints for inspecting and cryptographically verifying sovereign execution receipts.
    """
    queryset = SovereigntyReceipt.objects.all().order_by("-created_at")
    serializer_class = SovereigntyReceiptSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=["get"], url_path="verify")
    def verify(self, request, pk=None):
        """
        Cryptographically verifies the SHA-256 seal of the receipt to prove zero tampering.
        """
        receipt = self.get_object()
        verification = verify_receipt_integrity(receipt)
        return Response(verification, status=status.HTTP_200_OK)
