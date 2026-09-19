from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.workbench.views import DashboardView

urlpatterns = [
    # Sovereign Workbench Operations Dashboard (Air-Gapped UI)
    path("", DashboardView.as_view(), name="workbench_dashboard"),
    path("workbench/", DashboardView.as_view(), name="workbench_dashboard_alias"),

    path("admin/", admin.site.urls),
    
    # Core health & workbench overview
    path("api/health/", include("apps.workbench.urls")),
    
    # Authentication & User Management
    path("api/auth/", include("apps.accounts.urls_auth")),
    path("api/users/", include("apps.accounts.urls")),
    
    # Confidential Resource & Agent Vaults
    path("api/documents/", include("apps.documents.urls")),
    path("api/knowledge/", include("apps.knowledge.urls")),
    path("api/agents/", include("apps.agents.urls")),
    path("api/models/", include("apps.models.urls")),
    path("api/tools/", include("apps.tools.urls")),
    path("api/audit/", include("apps.audit.urls")),
    path("api/receipts/", include("apps.security.urls")),
]

from django.contrib.staticfiles.urls import staticfiles_urlpatterns

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += staticfiles_urlpatterns()
