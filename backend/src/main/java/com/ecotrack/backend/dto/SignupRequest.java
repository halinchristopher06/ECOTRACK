package com.ecotrack.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank(message = "Please enter your full name.")
        @Size(max = 120, message = "Full name must be at most 120 characters.")
        String fullName,
        @Email(message = "Enter a valid email address.")
        @NotBlank(message = "Email is required.")
        String email,
        @NotBlank(message = "Password is required.")
        @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters.")
        String password,
        String role,
        String birthdate,
        String address,
        String utilityCompany,
        String photoDataUrl
) {
}
