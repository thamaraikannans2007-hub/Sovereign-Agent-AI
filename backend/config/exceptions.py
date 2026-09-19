from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger("apps.exceptions")


def custom_exception_handler(exc, context):
    """
    Standardized sovereign API exception handler.
    Ensures clean JSON responses across 4xx and 5xx errors.
    """
    response = exception_handler(exc, context)

    if response is not None:
        custom_data = {
            "success": False,
            "status_code": response.status_code,
            "error": response.data,
        }
        response.data = custom_data
    else:
        logger.exception("Unhandled server exception: %s", str(exc))
        response = Response(
            {
                "success": False,
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "error": {
                    "detail": "An internal sovereign server error occurred.",
                    "code": "server_error"
                },
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response
