from django.urls import path
from .views import HealthCheckView, WorkbenchStatsView

urlpatterns = [
    path("", HealthCheckView.as_view(), name="health_check"),
    path("stats/", WorkbenchStatsView.as_view(), name="workbench_stats"),
]
