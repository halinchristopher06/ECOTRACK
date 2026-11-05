package com.ecotrack.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank(message = "Email is required.")
        String email,
        @NotBlank(message = "Please enter the reset code we emailed you.")
        String otp,
        @NotBlank(message = "Please enter a new password.")
        @Size(min = 8, max = 72, message = "New password must be between 8 and 72 characters.")
        String newPassword
) {
}
