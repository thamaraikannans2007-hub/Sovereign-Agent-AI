import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser


class Role(models.TextChoices):
    ADMIN = "Admin", "Admin"
    ENGINEER = "Engineer", "Engineer"
    ANALYST = "Analyst", "Analyst"
    OPERATOR = "Operator", "Operator"


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OPERATOR,
        help_text="Role-based access level for sovereign confidential workspace",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def is_admin_role(self) -> bool:
        return self.role == Role.ADMIN or self.is_superuser

    @property
    def is_engineer_role(self) -> bool:
        return self.role in [Role.ADMIN, Role.ENGINEER] or self.is_superuser
