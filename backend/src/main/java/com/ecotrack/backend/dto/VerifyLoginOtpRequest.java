package com.ecotrack.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyLoginOtpRequest(
        @NotBlank(message = "Channel is required")
        String channel,
        @NotBlank(message = "Email is required")
        String target,
        @NotBlank(message = "OTP is required")
        String otp
) {
}
