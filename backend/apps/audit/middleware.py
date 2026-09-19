import logging
from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger("apps.audit")


class AuditLoggingMiddleware(MiddlewareMixin):
    """
    Middleware that records audit entries for mutating actions
    and critical resource interactions in the sovereign workbench.
    """

    def process_response(self, request, response):
        if not request.path.startswith("/api/") or request.path.startswith("/api/health/"):
            return response

        # Only audit mutating methods or login/auth requests
        if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
            try:
                user = getattr(request, "user", None)
                if not (user and user.is_authenticated):
                    # Attempt JWT authentication from header for DRF requests
                    try:
                        jwt_auth = JWTAuthentication()
                        auth_res = jwt_auth.authenticate(request)
                        if auth_res:
                            user = auth_res[0]
                    except Exception:
                        user = None

                user_instance = user if (user and user.is_authenticated) else None

                ip_address = request.META.get("HTTP_X_FORWARDED_FOR")
                if ip_address:
                    ip_address = ip_address.split(",")[0].strip()
                else:
                    ip_address = request.META.get("REMOTE_ADDR")

                # Defer import to avoid circular imports during startup
                from apps.audit.models import AuditLog

                action_type = f"{request.method}_{request.resolver_match.url_name if request.resolver_match else 'REQUEST'}"
                resource_name = request.path.split("/")[2] if len(request.path.split("/")) > 2 else "api"

                AuditLog.objects.create(
                    user=user_instance,
                    action=action_type.upper()[:100],
                    resource=resource_name[:100],
                    metadata={
                        "path": request.path,
                        "method": request.method,
                        "status_code": response.status_code,
                    },
                    ip_address=ip_address,
                )
            except Exception as e:
                logger.warning(f"Audit log recording skipped due to error: {e}")

        return response
