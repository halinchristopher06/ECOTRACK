package com.ecotrack.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record SendLoginOtpRequest(
        @NotBlank(message = "Channel is required")
        String channel,
        @NotBlank(message = "Email is required")
        String target
) {
}
