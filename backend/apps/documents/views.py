from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models import Document
from .serializers import DocumentSerializer
from apps.accounts.permissions import IsSelfOrAdmin, IsAnalystOrAbove


class DocumentViewSet(viewsets.ModelViewSet):
    """
    Endpoint for uploading, viewing, and managing confidential documents.
    Accessible to Analysts, Engineers, and Admins.
    """
    queryset = Document.objects.all().order_by("-created_at")
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAnalystOrAbove]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin_role:
            return Document.objects.all().order_by("-created_at")
        return Document.objects.filter(uploaded_by=user).order_by("-created_at")
